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

# Configuration
DEFAULT_CONFIG = {
    "api_base_url": "http://localhost:5100/api",
    "prediction_url": "http://localhost:5200",
    "polling_interval": 60,  # seconds
    "symbols_to_track": ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA"],
    "buy_threshold": 1.5,   # Buy if prediction is at least 1.5% higher than current price
    "sell_threshold": -0.5, # Sell if prediction is at least 0.5% lower than current price
    "max_investment_per_stock": 100.0,  # Maximum $ to invest per stock
    "max_daily_investment": 300.0,      # Maximum $ to invest per day
    "trade_cooldown": 24 * 60 * 60,     # Seconds to wait before trading the same stock again
}

class AutoTrader:
    def __init__(self, config=None):
        self.config = config or DEFAULT_CONFIG
        self.last_trades = {}  # Symbol -> timestamp of last trade
        self.daily_investment = 0
        self.reset_day = None
        self.trade_history = []
        logger.info("AutoTrader initialized with config: %s", self.config)

    def reset_daily_limits(self):
        """Reset daily investment limits if it's a new day"""
        today = datetime.date.today()
        if self.reset_day != today:
            self.reset_day = today
            self.daily_investment = 0
            logger.info("Daily investment limit reset for %s", today)

    def get_prediction(self, symbol):
        """Get prediction data for a stock symbol"""
        try:
            url = f"{self.config['prediction_url']}/predict?symbol={symbol}"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error("Failed to get prediction for %s: %s", symbol, response.text)
                return None
        except Exception as e:
            logger.error("Error fetching prediction for %s: %s", symbol, str(e))
            return None

    def get_portfolio(self):
        """Get current portfolio holdings"""
        try:
            url = f"{self.config['api_base_url']}/portfolio"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error("Failed to get portfolio: %s", response.text)
                return []
        except Exception as e:
            logger.error("Error fetching portfolio: %s", str(e))
            return []

    def get_user_balance(self):
        """Get current user balance"""
        try:
            url = f"{self.config['api_base_url']}/users/profile"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                return float(response.json().get('balance', 0))
            else:
                logger.error("Failed to get user balance: %s", response.text)
                return 0
        except Exception as e:
            logger.error("Error fetching user balance: %s", str(e))
            return 0

    def buy_stock(self, symbol, shares):
        """Buy shares of a stock"""
        try:
            url = f"{self.config['api_base_url']}/stocks/buy"
            data = {"symbol": symbol, "shares": shares}
            response = requests.post(url, json=data, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                logger.info("Successfully bought %s shares of %s: %s", shares, symbol, result.get('message'))
                return True
            else:
                logger.error("Failed to buy %s: %s", symbol, response.text)
                return False
        except Exception as e:
            logger.error("Error buying %s: %s", symbol, str(e))
            return False

    def sell_stock(self, symbol, shares):
        """Sell shares of a stock"""
        try:
            url = f"{self.config['api_base_url']}/stocks/sell"
            data = {"symbol": symbol, "shares": shares}
            response = requests.post(url, json=data, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                logger.info("Successfully sold %s shares of %s: %s", shares, symbol, result.get('message'))
                return True
            else:
                logger.error("Failed to sell %s: %s", symbol, response.text)
                return False
        except Exception as e:
            logger.error("Error selling %s: %s", symbol, str(e))
            return False

    def analyze_stock(self, symbol):
        """Analyze a stock and decide whether to buy or sell"""
        prediction_data = self.get_prediction(symbol)
        if not prediction_data:
            return
            
        # Extract relevant data from prediction
        current_price = prediction_data.get('current_price')
        future_prices = prediction_data.get('future_predictions', {}).get('prices', [])
        
        if not current_price or not future_prices or len(future_prices) < 7:
            logger.warning("Incomplete prediction data for %s", symbol)
            return
            
        # Calculate potential gain (7-day forecast)
        future_price = future_prices[6]  # 7-day prediction
        potential_gain_percent = ((future_price - current_price) / current_price) * 100
        
        # Check if this stock was recently traded
        now = time.time()
        last_trade_time = self.last_trades.get(symbol, 0)
        time_since_last_trade = now - last_trade_time
        
        # Skip if in cooldown period
        if time_since_last_trade < self.config['trade_cooldown']:
            logger.info("Skipping %s due to trade cooldown (%.2f hours remaining)", 
                      symbol, (self.config['trade_cooldown'] - time_since_last_trade) / 3600)
            return
            
        # Get portfolio to check if we already own this stock
        portfolio = self.get_portfolio()
        owned_stocks = {item['symbol']: float(item['shares']) for item in portfolio}
        
        # Check current balance
        balance = self.get_user_balance()
        
        # Record trade decision and reasoning
        trade_decision = {
            "timestamp": datetime.datetime.now().isoformat(),
            "symbol": symbol,
            "current_price": current_price,
            "predicted_price": future_price,
            "potential_gain_percent": potential_gain_percent,
            "owned_shares": owned_stocks.get(symbol, 0),
            "action": "HOLD",
            "reason": "Default hold position"
        }
        
        # Buy condition
        if potential_gain_percent >= self.config['buy_threshold']:
            # Check daily investment limit
            if self.daily_investment >= self.config['max_daily_investment']:
                trade_decision["reason"] = "Buy signal, but daily investment limit reached"
                logger.info("%s shows buy signal (%.2f%%), but daily investment limit reached", 
                          symbol, potential_gain_percent)
            
            # Check if we have enough balance
            elif balance < 10:  # Minimum required balance
                trade_decision["reason"] = "Buy signal, but insufficient balance"
                logger.info("%s shows buy signal (%.2f%%), but insufficient balance ($%.2f)", 
                          symbol, potential_gain_percent, balance)
            
            else:
                # Calculate how much to invest
                max_investment = min(
                    balance * 0.9,  # Don't use all balance
                    self.config['max_investment_per_stock'],
                    self.config['max_daily_investment'] - self.daily_investment
                )
                
                if max_investment >= 10:  # Minimum investment
                    shares_to_buy = round(max_investment / current_price, 4)
                    
                    if self.buy_stock(symbol, shares_to_buy):
                        self.last_trades[symbol] = now
                        self.daily_investment += max_investment
                        
                        trade_decision["action"] = "BUY"
                        trade_decision["shares"] = shares_to_buy
                        trade_decision["investment"] = max_investment
                        trade_decision["reason"] = f"Strong upward prediction: +{potential_gain_percent:.2f}%"
                        
                        logger.info("Bought %.4f shares of %s at $%.2f (expected gain: %.2f%%)", 
                                  shares_to_buy, symbol, current_price, potential_gain_percent)
                else:
                    trade_decision["reason"] = "Buy signal, but investment amount too small"
                    logger.info("%s shows buy signal (%.2f%%), but calculated investment too small: $%.2f", 
                              symbol, potential_gain_percent, max_investment)
        
        # Sell condition
        elif potential_gain_percent <= self.config['sell_threshold'] and symbol in owned_stocks:
            owned_shares = owned_stocks[symbol]
            
            if owned_shares > 0:
                # Sell all shares
                if self.sell_stock(symbol, owned_shares):
                    self.last_trades[symbol] = now
                    
                    trade_decision["action"] = "SELL"
                    trade_decision["shares"] = owned_shares
                    trade_decision["reason"] = f"Downward prediction: {potential_gain_percent:.2f}%"
                    
                    logger.info("Sold %.4f shares of %s at $%.2f (expected loss prevention: %.2f%%)", 
                              owned_shares, symbol, current_price, potential_gain_percent)
            else:
                trade_decision["reason"] = "Sell signal, but no shares owned"
        else:
            if symbol in owned_stocks and owned_stocks[symbol] > 0:
                trade_decision["reason"] = f"Hold position, prediction ({potential_gain_percent:.2f}%) within thresholds"
            else:
                trade_decision["reason"] = f"No position, prediction ({potential_gain_percent:.2f}%) not strong enough to buy"
                
        # Record trade decision for dashboard
        self.trade_history.append(trade_decision)
        # Keep only last 100 decisions
        if len(self.trade_history) > 100:
            self.trade_history = self.trade_history[-100:]

    def run(self):
        """Main trading loop"""
        logger.info("Starting automated trading bot")
        
        while True:
            try:
                self.reset_daily_limits()
                
                for symbol in self.config['symbols_to_track']:
                    logger.info("Analyzing %s", symbol)
                    self.analyze_stock(symbol)
                    
                # Export trade history to JSON for the dashboard
                with open('trade_history.json', 'w') as f:
                    json.dump(self.trade_history, f)
                    
                logger.info("Sleeping for %d seconds", self.config['polling_interval'])
                time.sleep(self.config['polling_interval'])
                
            except KeyboardInterrupt:
                logger.info("Trading bot stopped by user")
                break
            except Exception as e:
                logger.error("Unexpected error in trading loop: %s", str(e))
                # Sleep for a shorter time on error
                time.sleep(10)

if __name__ == "__main__":
    trader = AutoTrader()
    trader.run() 