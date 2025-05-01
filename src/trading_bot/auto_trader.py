#!/usr/bin/env python3

import requests
import json
import time
import logging
import os
import datetime
import pandas as pd
import numpy as np
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("auto_trader.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('auto_trader')

# Load environment variables
load_dotenv()

class AutoTrader:
    def __init__(self):
        # API endpoints
        self.api_base_url = os.getenv("API_BASE_URL", "http://localhost:5000/api")
        self.prediction_url = os.getenv("PREDICTION_URL", "http://localhost:5100/api/stocks/predict")
        
        # Default user ID - in a real system this would be configured differently
        self.user_id = 1
        
        # Bot state
        self.bot_config = None
        self.watchlist = []
        self.portfolio = []
        
        logger.info("AutoTrader initialized")

    def get_bot_config(self):
        """Get bot configuration from the database"""
        try:
            url = f"{self.api_base_url}/bot/config"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                self.bot_config = response.json()
                logger.info(f"Bot configuration loaded: active={self.bot_config['isActive']}, "
                           f"buyThreshold={self.bot_config['buyThreshold']}, "
                           f"sellThreshold={self.bot_config['sellThreshold']}")
                return self.bot_config
            else:
                logger.error(f"Failed to get bot config: {response.text}")
                return None
        except Exception as e:
            logger.error(f"Error fetching bot config: {str(e)}")
            return None

    def get_watchlist(self):
        """Get the watchlist of stocks to track"""
        try:
            url = f"{self.api_base_url}/bot/watchlist"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                self.watchlist = response.json()
                symbols = [item['symbol'] for item in self.watchlist if item['isActive']]
                logger.info(f"Watchlist loaded with {len(symbols)} active symbols: {', '.join(symbols)}")
                return self.watchlist
            else:
                logger.error(f"Failed to get watchlist: {response.text}")
                return []
        except Exception as e:
            logger.error(f"Error fetching watchlist: {str(e)}")
            return []

    def get_prediction(self, symbol):
        """Get prediction data for a stock symbol"""
        try:
            url = f"{self.prediction_url}/{symbol}"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                prediction_data = response.json()
                
                # Record the price in the database for historical data
                self.record_stock_price(symbol, prediction_data)
                
                return prediction_data
            else:
                logger.error(f"Failed to get prediction for {symbol}: {response.text}")
                return None
        except Exception as e:
            logger.error(f"Error fetching prediction for {symbol}: {str(e)}")
            return None
    
    def record_stock_price(self, symbol, prediction_data):
        """Record the current stock price in the database"""
        try:
            current_price = prediction_data.get('current_price')
            if not current_price:
                return
                
            # Extract price data
            price_data = {
                'price': current_price,
                'open': prediction_data.get('candle_data', {}).get('o', 0),
                'high': prediction_data.get('candle_data', {}).get('h', 0),
                'low': prediction_data.get('candle_data', {}).get('l', 0)
            }
            
            # Send to API
            url = f"{self.api_base_url}/stocks/prices/record"
            response = requests.post(url, json={
                'symbol': symbol,
                'priceData': price_data
            }, timeout=10)
            
            if response.status_code != 200 and response.status_code != 201:
                logger.warning(f"Failed to record price for {symbol}: {response.text}")
        except Exception as e:
            logger.error(f"Error recording price for {symbol}: {str(e)}")

    def get_portfolio(self):
        """Get current portfolio holdings"""
        try:
            url = f"{self.api_base_url}/stocks/portfolio"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                self.portfolio = response.json()
                return self.portfolio
            else:
                logger.error(f"Failed to get portfolio: {response.text}")
                return []
        except Exception as e:
            logger.error(f"Error fetching portfolio: {str(e)}")
            return []

    def get_bot_stats(self):
        """Get bot statistics"""
        try:
            url = f"{self.api_base_url}/bot/stats"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get bot stats: {response.text}")
                return None
        except Exception as e:
            logger.error(f"Error fetching bot stats: {str(e)}")
            return None

    def update_last_run_time(self):
        """Update the last run time of the bot"""
        try:
            url = f"{self.api_base_url}/bot/config"
            response = requests.put(url, json={
                'isActive': self.bot_config['isActive'],
                'lastRunTime': datetime.datetime.now().isoformat()
            }, timeout=10)
            
            if response.status_code == 200:
                logger.info("Bot last run time updated")
            else:
                logger.error(f"Failed to update last run time: {response.text}")
        except Exception as e:
            logger.error(f"Error updating last run time: {str(e)}")

    def buy_stock(self, symbol, shares):
        """Buy shares of a stock"""
        try:
            url = f"{self.api_base_url}/stocks/buy"
            data = {"symbol": symbol, "shares": shares}
            response = requests.post(url, json=data, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                transaction_id = result.get('transaction', {}).get('id')
                logger.info(f"Successfully bought {shares} shares of {symbol}: {result.get('message')}")
                return transaction_id
            else:
                logger.error(f"Failed to buy {symbol}: {response.text}")
                return None
        except Exception as e:
            logger.error(f"Error buying {symbol}: {str(e)}")
            return None

    def sell_stock(self, symbol, shares):
        """Sell shares of a stock"""
        try:
            url = f"{self.api_base_url}/stocks/sell"
            data = {"symbol": symbol, "shares": shares}
            response = requests.post(url, json=data, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                transaction_id = result.get('transaction', {}).get('id')
                logger.info(f"Successfully sold {shares} shares of {symbol}: {result.get('message')}")
                return transaction_id
            else:
                logger.error(f"Failed to sell {symbol}: {response.text}")
                return None
        except Exception as e:
            logger.error(f"Error selling {symbol}: {str(e)}")
            return None

    def record_bot_action(self, action_data):
        """Record a bot action in the database"""
        try:
            url = f"{self.api_base_url}/bot/actions"
            response = requests.post(url, json=action_data, timeout=10)
            
            if response.status_code != 200 and response.status_code != 201:
                logger.warning(f"Failed to record bot action: {response.text}")
        except Exception as e:
            logger.error(f"Error recording bot action: {str(e)}")

    def update_watchlist_last_trade(self, symbol):
        """Update the last trade time for a symbol in the watchlist"""
        try:
            url = f"{self.api_base_url}/bot/watchlist/{symbol}/last-trade"
            response = requests.put(url, json={
                'lastTradeTime': datetime.datetime.now().isoformat()
            }, timeout=10)
            
            if response.status_code != 200:
                logger.warning(f"Failed to update last trade time for {symbol}: {response.text}")
        except Exception as e:
            logger.error(f"Error updating last trade time for {symbol}: {str(e)}")

    def analyze_stock(self, watchlist_item):
        """Analyze a stock and decide whether to buy or sell"""
        symbol = watchlist_item['symbol']
        
        # Check if this stock has custom thresholds
        buy_threshold = watchlist_item.get('customBuyThreshold', self.bot_config['buyThreshold'])
        sell_threshold = watchlist_item.get('customSellThreshold', self.bot_config['sellThreshold'])
        
        # Get prediction data
        prediction_data = self.get_prediction(symbol)
        if not prediction_data:
            return
            
        # Extract relevant data from prediction
        current_price = prediction_data.get('current_price')
        future_prices = prediction_data.get('future_predictions', {}).get('prices', [])
        
        if not current_price or not future_prices or len(future_prices) < 7:
            logger.warning(f"Incomplete prediction data for {symbol}")
            return
            
        # Calculate potential gain (7-day forecast)
        future_price = future_prices[6]  # 7-day prediction
        potential_gain_percent = ((future_price - current_price) / current_price) * 100
        
        # Check if this stock was recently traded
        last_trade_time = watchlist_item.get('lastTradeTime')
        
        # Skip if in cooldown period and last trade exists
        if last_trade_time:
            last_trade_dt = datetime.datetime.fromisoformat(last_trade_time.replace('Z', '+00:00'))
            now = datetime.datetime.now(datetime.timezone.utc)
            time_since_last_trade = (now - last_trade_dt).total_seconds()
            
            if time_since_last_trade < self.bot_config['tradeCooldown']:
                hours_remaining = (self.bot_config['tradeCooldown'] - time_since_last_trade) / 3600
                logger.info(f"Skipping {symbol} due to trade cooldown ({hours_remaining:.2f} hours remaining)")
                return
            
        # Find if we already own this stock
        owned_stock = next((item for item in self.portfolio if item['symbol'] == symbol), None)
        owned_shares = float(owned_stock['shares']) if owned_stock else 0
        
        # Prepare action data
        action_data = {
            "symbol": symbol,
            "currentPrice": current_price,
            "predictedPrice": future_price,
            "potentialGainPercent": potential_gain_percent,
            "ownedShares": owned_shares,
            "action": "HOLD",
            "reason": "Default hold position"
        }
        
        # Buy condition
        if potential_gain_percent >= buy_threshold:
            # Check if bot has enough allocated funds
            stats = self.get_bot_stats()
            if not stats:
                action_data["reason"] = "Buy signal, but couldn't verify bot funds"
                self.record_bot_action(action_data)
                return
                
            # Calculate available funds (allocated funds minus what's already invested)
            available_funds = float(stats['allocatedFunds']) - float(stats['totalInvested'])
            
            if available_funds < 10:  # Minimum required amount
                action_data["reason"] = f"Buy signal, but insufficient bot funds (${available_funds:.2f})"
                action_data["action"] = "HOLD"
                self.record_bot_action(action_data)
                logger.info(f"{symbol} shows buy signal ({potential_gain_percent:.2f}%), but insufficient bot funds (${available_funds:.2f})")
                return
            
            # Calculate how much to invest
            max_investment = min(
                available_funds,
                float(self.bot_config['maxInvestmentPerStock']),
                float(self.bot_config['maxDailyInvestment'])
            )
            
            if max_investment >= 10:  # Minimum investment
                shares_to_buy = round(max_investment / current_price, 4)
                
                transaction_id = self.buy_stock(symbol, shares_to_buy)
                if transaction_id:
                    # Update watchlist last trade time
                    self.update_watchlist_last_trade(symbol)
                    
                    # Record action
                    action_data["action"] = "BUY"
                    action_data["shares"] = shares_to_buy
                    action_data["investment"] = max_investment
                    action_data["reason"] = f"Strong upward prediction: +{potential_gain_percent:.2f}%"
                    action_data["transactionId"] = transaction_id
                    self.record_bot_action(action_data)
                    
                    logger.info(f"Bought {shares_to_buy:.4f} shares of {symbol} at ${current_price} (expected gain: {potential_gain_percent:.2f}%)")
            else:
                action_data["reason"] = f"Buy signal, but investment amount too small: ${max_investment:.2f}"
                action_data["action"] = "HOLD"
                self.record_bot_action(action_data)
                logger.info(f"{symbol} shows buy signal ({potential_gain_percent:.2f}%), but calculated investment too small: ${max_investment:.2f}")
        
        # Sell condition
        elif potential_gain_percent <= sell_threshold and owned_shares > 0:
            transaction_id = self.sell_stock(symbol, owned_shares)
            if transaction_id:
                # Update watchlist last trade time
                self.update_watchlist_last_trade(symbol)
                
                # Record action
                action_data["action"] = "SELL"
                action_data["shares"] = owned_shares
                action_data["reason"] = f"Downward prediction: {potential_gain_percent:.2f}%"
                action_data["transactionId"] = transaction_id
                self.record_bot_action(action_data)
                
                logger.info(f"Sold {owned_shares:.4f} shares of {symbol} at ${current_price} (expected loss prevention: {potential_gain_percent:.2f}%)")
        else:
            if owned_shares > 0:
                action_data["reason"] = f"Hold position, prediction ({potential_gain_percent:.2f}%) within thresholds"
            else:
                action_data["reason"] = f"No position, prediction ({potential_gain_percent:.2f}%) not strong enough to buy"
            
            # Record hold action
            self.record_bot_action(action_data)

    def run(self):
        """Main trading loop"""
        logger.info("Starting automated trading bot")
        
        while True:
            try:
                # Load configuration and watchlist
                self.get_bot_config()
                
                if not self.bot_config:
                    logger.error("Bot configuration not found, retrying in 60 seconds")
                    time.sleep(60)
                    continue
                
                # Check if bot is active
                if not self.bot_config['isActive']:
                    logger.info("Bot is currently inactive, checking again in 60 seconds")
                    time.sleep(60)
                    continue
                
                # Get watchlist and portfolio
                self.get_watchlist()
                self.get_portfolio()
                
                # Update last run time
                self.update_last_run_time()
                
                # Process each active symbol in the watchlist
                active_symbols = [item for item in self.watchlist if item['isActive']]
                
                if not active_symbols:
                    logger.warning("No active symbols in watchlist, checking again in 60 seconds")
                    time.sleep(60)
                    continue
                    
                for item in active_symbols:
                    logger.info(f"Analyzing {item['symbol']}")
                    self.analyze_stock(item)
                    
                # Sleep before next cycle
                polling_interval = int(self.bot_config.get('pollingInterval', 60))
                logger.info(f"Sleeping for {polling_interval} seconds")
                time.sleep(polling_interval)
                
            except KeyboardInterrupt:
                logger.info("Trading bot stopped by user")
                break
            except Exception as e:
                logger.error(f"Unexpected error in trading loop: {str(e)}")
                # Sleep for a shorter time on error
                time.sleep(10)

if __name__ == "__main__":
    trader = AutoTrader()
    trader.run() 