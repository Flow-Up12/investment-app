import os
import sys
import traceback
import pandas as pd
import numpy as np
import json
import requests
import pickle
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

# Import our finnhub service
from finnhub_service import (
    get_stock_price, 
    get_historical_data,
    search_symbol as finnhub_search_symbol,
    get_company_profile,
    get_market_news,
    get_company_news
)

app = Flask(__name__)
CORS(app)

# Common function to fetch real-time price
def fetch_real_time_price(symbol):
    """
    Fetch real-time stock price from Finnhub
    """
    try:
        # Use Finnhub API
        price_data = get_stock_price(symbol)
        if price_data is not None:
            return price_data
        
        # If we get here, something went wrong, return synthetic data
        print(f"Warning: Using synthetic data for {symbol}")
        from finnhub_service import generate_synthetic_price
        return generate_synthetic_price(symbol)
    except Exception as e:
        print(f"Error in fetch_real_time_price for {symbol}: {str(e)}")
        # In case of any errors, return synthetic data
        from finnhub_service import generate_synthetic_price
        return generate_synthetic_price(symbol)

# Function to fetch stock data with fallback
def fetch_stock_data(symbol, start_date, end_date, max_retries=3, use_synthetic_fallback=True):
    """
    Fetch historical stock data with fallback to synthetic data
    """
    # First try to get data from Finnhub
    for attempt in range(max_retries):
        try:
            print(f"Fetching historical data for {symbol} from Finnhub (attempt {attempt+1})")
            stock_data = get_historical_data(symbol, start_date, end_date)
            
            if stock_data is not None and not stock_data.empty:
                print(f"Successfully fetched data for {symbol} from Finnhub")
                # Add flag to indicate real data
                stock_data['Synthetic'] = False
                return stock_data
        except Exception as e:
            print(f"Error fetching data for {symbol} from Finnhub (attempt {attempt+1}): {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(1)  # Wait before retrying
    
    # If we couldn't get data or it's empty, use synthetic data
    if use_synthetic_fallback:
        print(f"Using synthetic data for {symbol}")
        from finnhub_service import generate_synthetic_historical_data
        return generate_synthetic_historical_data(symbol, start_date, end_date)
    else:
        raise ValueError(f"Could not fetch historical data for {symbol}")

# Function to prepare data for modeling
def prepare_data(stock_data):
    """
    Prepare stock data for machine learning model
    """
    # Clean data
    if stock_data is None or len(stock_data) < 10:
        raise ValueError("Insufficient data for prediction")
    
    # Check what columns we have and adapt accordingly
    columns = stock_data.columns
    price_col = 'Close' if 'Close' in columns else 'close'
    
    # Extract just the price data we need
    df = stock_data[[price_col]].copy()
    df.columns = ['Price']
    
    # Create features
    df['Price_1'] = df['Price'].shift(1)
    df['Price_2'] = df['Price'].shift(2)
    df['Price_3'] = df['Price'].shift(3)
    df['Price_4'] = df['Price'].shift(4)
    df['Price_5'] = df['Price'].shift(5)
    
    # Calculate moving averages
    df['MA_5'] = df['Price'].rolling(window=5).mean()
    df['MA_10'] = df['Price'].rolling(window=10).mean()
    
    # Calculate daily return
    df['Return'] = df['Price'].pct_change() * 100
    
    # Drop rows with NaN values
    df = df.dropna()
    
    return df

def fetch_alpha_vantage_data(symbol, start_date_str, end_date_str):
    """
    Fetch stock data from Alpha Vantage API as an alternative to yfinance
    """
    print(f"Attempting to fetch Alpha Vantage data for {symbol}")
    
    try:
        # Convert dates to datetime objects for comparison
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
        
        # Alpha Vantage API endpoint for daily time series with compact output (100 data points)
        # or full output (20+ years of data)
        url = f"https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&outputsize=full&apikey={ALPHA_VANTAGE_API_KEY}"
        
        response = requests.get(url)
        data = response.json()
        
        # Check if we received an error or empty response
        if "Error Message" in data:
            print(f"Alpha Vantage error: {data['Error Message']}")
            return None
            
        if "Time Series (Daily)" not in data:
            print(f"No time series data found in Alpha Vantage response for {symbol}")
            return None
            
        daily_data = data["Time Series (Daily)"]
        
        # Convert to DataFrame
        df = pd.DataFrame.from_dict(daily_data, orient='index')
        df.index = pd.to_datetime(df.index)
        df = df.sort_index()  # Sort by date
        
        # Filter by date range
        df = df[(df.index >= start_date) & (df.index <= end_date)]
        
        # Rename columns to match yfinance format
        df = df.rename(columns={
            '1. open': 'Open',
            '2. high': 'High',
            '3. low': 'Low',
            '4. close': 'Close',
            '5. volume': 'Volume'
        })
        
        # Convert to numeric values
        for col in df.columns:
            df[col] = pd.to_numeric(df[col])
            
        if len(df) < 30:
            print(f"Insufficient data points from Alpha Vantage for {symbol}: only {len(df)} records found")
            return None
            
        print(f"Successfully fetched {len(df)} records from Alpha Vantage for {symbol}")
        return df
        
    except Exception as e:
        print(f"Error fetching data from Alpha Vantage for {symbol}: {str(e)}")
        traceback.print_exc()
        return None

def generate_synthetic_data(symbol, start_date, end_date):
    """
    Generate synthetic stock data as a last resort fallback
    Uses a random walk starting from a base price
    """
    print(f"Generating synthetic data for {symbol}")
    
    # Convert dates to datetime objects
    start = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')
    
    # Create a date range for business days
    date_range = []
    current = start
    while current <= end:
        if current.weekday() < 5:  # 0-4 are Monday to Friday
            date_range.append(current)
        current += timedelta(days=1)
    
    # Generate random stock prices (random walk) with more realistic base prices
    base_price = 100.0  # Default base price
    
    # Use a more accurate mapping of common stock prices
    symbol_price_map = {
        'AAPL': 175.0,
        'MSFT': 410.0,
        'GOOG': 170.0,
        'GOOGL': 170.0,
        'AMZN': 180.0,
        'META': 475.0, 
        'TSLA': 175.0,
        'NVDA': 110.0,
        'JPM': 200.0,
        'BAC': 38.0,
        'SPY': 515.0,
        'QQQ': 450.0,
        'NFLX': 600.0,
        'DIS': 105.0
    }
    
    # Try to get a more accurate base price based on symbol
    if symbol in symbol_price_map:
        base_price = symbol_price_map[symbol]
    else:
        # For unknown symbols use a more reasonable default based on the length of the symbol
        # (Often 3-letter symbols are larger companies/ETFs with higher prices)
        if len(symbol) <= 3:
            base_price = 150.0
        else:
            base_price = 75.0
    
    # Add slight randomization to base price (±5%)
    base_price *= (0.95 + np.random.random() * 0.1)
    
    # Generate price data with a random walk
    np.random.seed(hash(symbol) % 10000)  # Use symbol as seed for consistency
    volatility = 0.008  # Daily volatility - reduced for more realistic values
    daily_returns = np.random.normal(0.0002, volatility, size=len(date_range))
    prices = [base_price]
    
    for ret in daily_returns:
        prices.append(prices[-1] * (1 + ret))
    
    prices = prices[1:]  # Remove the initial seed price
    
    # Create a DataFrame
    df = pd.DataFrame({
        'Close': prices,
        'Open': [p * (1 - np.random.uniform(0, 0.003)) for p in prices],
        'High': [p * (1 + np.random.uniform(0, 0.006)) for p in prices],
        'Low': [p * (1 - np.random.uniform(0, 0.006)) for p in prices],
        'Volume': np.random.randint(1000000, 10000000, size=len(date_range)),
        'Synthetic': [True] * len(date_range)  # Add flag to indicate this is synthetic data
    }, index=date_range)
    
    print(f"Generated synthetic data with {len(df)} rows")
    return df

def build_model(stock_data):
    """
    Build and train a linear regression model
    """
    # Ensure we select only numeric columns for the model
    X = stock_data[['Prev Close', 'Prev Volume', '5d_MA', '10d_MA', '20d_MA']].astype(float)
    y = stock_data['Close']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = LinearRegression()
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    mae = mean_absolute_error(y_test, predictions)
    
    return model, X_test, y_test, predictions, mae

def predict_next_days(model, stock_data, num_days=7):
    """
    Predict stock prices for the next num_days
    """
    predictions = []
    last_row = stock_data.iloc[-1].copy()
    current_date = stock_data.index[-1]
    dates = []

    for i in range(num_days):
        # Advance the date
        current_date = current_date + timedelta(days=1)
        # Skip weekends
        while current_date.weekday() > 4:  # 5 = Saturday, 6 = Sunday
            current_date = current_date + timedelta(days=1)
        
        # Prepare the features for prediction
        features = np.array([[
            last_row['Prev Close'],  # Previous close
            last_row['Prev Volume'],  # Previous volume
            last_row['5d_MA'],  # Use the last 5d MA
            last_row['10d_MA'],  # Use the last 10d MA
            last_row['20d_MA']   # Use the last 20d MA
        ]])
        
        # Make prediction
        prediction = model.predict(features)[0]
        
        # Update the last_row with the new prediction
        last_row['Prev Close'] = last_row['Close']
        last_row['Close'] = prediction
        
        # Simple method to update MAs
        last_row['5d_MA'] = (last_row['5d_MA'] * 4 + prediction) / 5
        last_row['10d_MA'] = (last_row['10d_MA'] * 9 + prediction) / 10
        last_row['20d_MA'] = (last_row['20d_MA'] * 19 + prediction) / 20
        
        predictions.append(prediction)
        dates.append(current_date.strftime('%Y-%m-%d'))
    
    return dates, predictions

@app.route('/predict', methods=['GET'])
def predict_get():
    try:
        # Extract parameters from request.args
        symbol = request.args.get('symbol', 'AAPL')
        days = int(request.args.get('days', 5))
        use_synthetic = request.args.get('use_synthetic', 'false').lower() == 'true'
        
        # Log the request
        print(f"GET Prediction request for {symbol}, {days} days ahead, use_synthetic={use_synthetic}")
        
        # Get current date and calculate date range
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
        
        # Fetch historical data
        try:
            if not use_synthetic:
                # Attempt to get data from Finnhub with fallback to synthetic
                try:
                    df = fetch_stock_data(symbol, start_date, end_date, use_synthetic_fallback=True)
                    # Check if the data is synthetic
                    data_source = "synthetic" if hasattr(df, 'Synthetic') and df.Synthetic.any() else "finnhub"
                except Exception as data_err:
                    print(f"Error fetching Finnhub data: {str(data_err)}")
                    df = generate_synthetic_data(symbol, start_date, end_date)
                    data_source = "synthetic"
            else:
                # If synthetic data is explicitly requested
                print(f"Using synthetic data for {symbol} as requested")
                df = generate_synthetic_data(symbol, start_date, end_date)
                data_source = "synthetic"
        except Exception as e:
            error_details = traceback.format_exc()
            print(f"Error fetching data: {str(e)}\n{error_details}")
            return jsonify({
                'error': f"Failed to fetch stock data: {str(e)}",
                'suggestion': "Try again later or use synthetic data for testing"
            }), 500

        # Get real-time price from Finnhub with fallback to synthetic
        current_price_info = fetch_real_time_price(symbol)

        # Prepare dataframe for modeling
        if df is None or df.empty:
            return jsonify({
                'error': 'No stock data available',
                'suggestion': 'Please try a different stock symbol or use synthetic data'
            }), 400
            
        # Reset index to have date as a column
        df = df.reset_index()
        
        # Create a new feature 'Days' which is the number of days from the start
        if 'Date' in df.columns:
            df['Date'] = pd.to_datetime(df['Date'])
            # Extract the date as numeric for ML
            df['Days'] = (df['Date'] - df['Date'].min()).dt.days
        else:
            # If date is not available (synthetic data)
            df['Days'] = range(len(df))
        
        # Feature engineering: Add moving averages
        df['MA5'] = df['Close'].rolling(window=5).mean()
        df['MA20'] = df['Close'].rolling(window=20).mean()
        
        # Drop NA values created by moving averages
        df = df.dropna()
        
        if len(df) < 30:
            return jsonify({
                'error': 'Insufficient data for prediction',
                'suggestion': 'Please try a different stock symbol or time range'
            }), 400
            
        # Features for prediction
        X = df[['Days', 'MA5', 'MA20']]
        y = df['Close']
        
        # Split the data for training and testing
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Train the model
        model = LinearRegression()
        model.fit(X_train, y_train)
        
        # Evaluate the model
        y_pred = model.predict(X_test)
        mae = mean_absolute_error(y_test, y_pred)
        
        # Calculate future dates
        last_day = df['Days'].max()
        future_days = range(last_day + 1, last_day + days + 1)
        
        # Calculate MA values for future predictions
        # We'll use the last available values as an approximation
        last_ma5 = df['MA5'].iloc[-1]
        last_ma20 = df['MA20'].iloc[-1]
        
        # Create future dataframe
        future_df = pd.DataFrame({
            'Days': future_days,
            'MA5': [last_ma5] * days,
            'MA20': [last_ma20] * days
        })
        
        # Predict future prices
        future_predictions = model.predict(future_df)
        
        # Create a list of dates for the prediction period
        last_date = df['Date'].max() if 'Date' in df.columns else datetime.now()
        future_dates = [
            (last_date + timedelta(days=i+1)).strftime('%Y-%m-%d') 
            for i in range(days)
        ]
        
        # Prepare response data
        historical_data = [{
            'date': row['Date'].strftime('%Y-%m-%d') if 'Date' in df.columns else f"Day {row['Days']}",
            'price': row['Close']
        } for _, row in df.tail(30).iterrows()]
        
        prediction_data = [{
            'date': date,
            'price': float(price)
        } for date, price in zip(future_dates, future_predictions)]
        
        # Get the model's confidence level
        confidence = max(0, min(100, (1 - mae / df['Close'].mean()) * 100))
        
        # Include real-time price information if available
        if current_price_info:
            real_time_info = {
                'current_price': current_price_info['price'],
                'lastUpdated': current_price_info.get('date', 'N/A'),
                'dataSource': current_price_info.get('source', 'Unknown')
            }
        else:
            # Use the most recent historical data point if real-time is not available
            real_time_info = {
                'current_price': df['Close'].iloc[-1] if not df.empty else None,
                'lastUpdated': df['Date'].iloc[-1].strftime('%Y-%m-%d') if 'Date' in df.columns and not df.empty else 'N/A',
                'dataSource': 'historical'
            }
        
        # Format for compatibility with the auto_trader expected structure
        future_predictions_dict = {
            'dates': future_dates,
            'prices': [float(price) for price in future_predictions]
        }
            
        response = {
            'symbol': symbol,
            'historicalData': historical_data,
            'predictions': prediction_data,
            'future_predictions': future_predictions_dict,  # Add for compatibility
            'confidence': confidence,
            'dataType': data_source,
            'modelType': 'Linear Regression',
            'mae': mae,
            **real_time_info
        }
        
        return jsonify(response)
        
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Unexpected error in prediction: {str(e)}\n{error_details}")
        return jsonify({
            'error': f"Prediction failed: {str(e)}",
            'suggestion': "Please check your input parameters and try again"
        }), 500

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        symbol = data.get('symbol', 'AAPL')
        days = int(data.get('days', 5))
        use_real_data = data.get('useRealData', True)  # Default to using real data
        
        print(f"Prediction request for {symbol}, {days} days ahead, use_real_data={use_real_data}")
        
        # Get current date and calculate date range
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
        
        # Fetch historical data
        try:
            if use_real_data:
                df = fetch_stock_data(symbol, start_date, end_date, use_synthetic_fallback=False)
                data_source = "real"
            else:
                # If synthetic data is explicitly requested
                print(f"Using synthetic data for {symbol} as requested")
                df = generate_synthetic_data(symbol, start_date, end_date)
                data_source = "synthetic"
        except Exception as e:
            error_details = traceback.format_exc()
            print(f"Error fetching data: {str(e)}\n{error_details}")
            return jsonify({
                'error': f"Failed to fetch stock data: {str(e)}",
                'suggestion': "Try again later or use synthetic data for testing"
            }), 500

        # Get real-time price if using real data
        current_price_info = None
        if use_real_data:
            try:
                current_price_info = fetch_real_time_price(symbol)
            except Exception as e:
                print(f"Error fetching real-time price: {str(e)}")
                # Continue with prediction even if real-time price fails

        # Prepare dataframe for modeling
        if df is None or df.empty:
            return jsonify({
                'error': 'No stock data available',
                'suggestion': 'Please try a different stock symbol or use synthetic data'
            }), 400
            
        # Reset index to have date as a column
        df = df.reset_index()
        
        # Create a new feature 'Days' which is the number of days from the start
        if 'Date' in df.columns:
            df['Date'] = pd.to_datetime(df['Date'])
            # Extract the date as numeric for ML
            df['Days'] = (df['Date'] - df['Date'].min()).dt.days
        else:
            # If date is not available (synthetic data)
            df['Days'] = range(len(df))
        
        # Feature engineering: Add moving averages
        df['MA5'] = df['Close'].rolling(window=5).mean()
        df['MA20'] = df['Close'].rolling(window=20).mean()
        
        # Drop NA values created by moving averages
        df = df.dropna()
        
        if len(df) < 30:
            return jsonify({
                'error': 'Insufficient data for prediction',
                'suggestion': 'Please try a different stock symbol or time range'
            }), 400
            
        # Features for prediction
        X = df[['Days', 'MA5', 'MA20']]
        y = df['Close']
        
        # Split the data for training and testing
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Train the model
        model = LinearRegression()
        model.fit(X_train, y_train)
        
        # Evaluate the model
        y_pred = model.predict(X_test)
        mae = mean_absolute_error(y_test, y_pred)
        
        # Calculate future dates
        last_day = df['Days'].max()
        future_days = range(last_day + 1, last_day + days + 1)
        
        # Calculate MA values for future predictions
        # We'll use the last available values as an approximation
        last_ma5 = df['MA5'].iloc[-1]
        last_ma20 = df['MA20'].iloc[-1]
        
        # Create future dataframe
        future_df = pd.DataFrame({
            'Days': future_days,
            'MA5': [last_ma5] * days,
            'MA20': [last_ma20] * days
        })
        
        # Predict future prices
        future_predictions = model.predict(future_df)
        
        # Create a list of dates for the prediction period
        last_date = df['Date'].max() if 'Date' in df.columns else datetime.now()
        future_dates = [
            (last_date + timedelta(days=i+1)).strftime('%Y-%m-%d') 
            for i in range(days)
        ]
        
        # Prepare response data
        historical_data = [{
            'date': row['Date'].strftime('%Y-%m-%d') if 'Date' in df.columns else f"Day {row['Days']}",
            'price': row['Close']
        } for _, row in df.tail(30).iterrows()]
        
        prediction_data = [{
            'date': date,
            'price': float(price)
        } for date, price in zip(future_dates, future_predictions)]
        
        # Get the model's confidence level
        confidence = max(0, min(100, (1 - mae / df['Close'].mean()) * 100))
        
        # Include real-time price information if available
        real_time_info = {}
        if current_price_info:
            real_time_info = {
                'currentPrice': current_price_info['price'],
                'lastUpdated': current_price_info.get('date', 'N/A'),
                'dataSource': current_price_info.get('source', 'Unknown')
            }
        else:
            # Use the most recent historical data point if real-time is not available
            real_time_info = {
                'currentPrice': df['Close'].iloc[-1] if not df.empty else None,
                'lastUpdated': df['Date'].iloc[-1].strftime('%Y-%m-%d') if 'Date' in df.columns and not df.empty else 'N/A',
                'dataSource': 'historical'
            }
            
        response = {
            'symbol': symbol,
            'historicalData': historical_data,
            'predictions': prediction_data,
            'confidence': confidence,
            'dataType': data_source,
            'modelType': 'Linear Regression',
            'mae': mae,
            **real_time_info
        }
        
        return jsonify(response)
        
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Unexpected error in prediction: {str(e)}\n{error_details}")
        return jsonify({
            'error': f"Prediction failed: {str(e)}",
            'suggestion': "Please check your input parameters and try again"
        }), 500

@app.route('/stock/price', methods=['GET'])
def get_stock_price_route():
    try:
        symbol = request.args.get('symbol', 'AAPL')
        
        # Try to get the real-time price
        price_info = fetch_real_time_price(symbol)
        
        if price_info:
            return jsonify({
                'symbol': symbol,
                'price': price_info['price'],
                'lastUpdated': price_info.get('date', 'N/A'),
                'dataSource': price_info.get('source', 'Unknown')
            })
        else:
            return jsonify({
                'error': 'Unable to fetch real-time price',
                'suggestion': 'API service may be down or rate limited'
            }), 503
            
    except Exception as e:
        print(f"Error in get_stock_price: {str(e)}")
        return jsonify({
            'error': f"Failed to fetch stock price: {str(e)}"
        }), 500

@app.route('/data-sources', methods=['GET'])
def get_data_sources():
    """
    API endpoint to get information about the data sources used
    """
    sources = [
        {
            "id": "finnhub",
            "name": "Finnhub",
            "description": "Real-time financial market data provider with a robust API for stock market data.",
            "website": "https://finnhub.io/",
            "data_types": ["Stock Prices", "Company Information", "Market News"],
            "is_primary": True,
            "enabled": True
        },
        {
            "id": "synthetic",
            "name": "Synthetic Data Generator",
            "description": "Built-in data synthesis engine that generates realistic market data for testing and demo purposes.",
            "website": null,
            "data_types": ["Stock Prices", "Company Information", "Market News"],
            "is_primary": False,
            "enabled": True
        }
    ]
    
    # Include information about current configuration
    has_finnhub_key = bool(os.environ.get('FINNHUB_API_KEY', ''))
    
    config_info = {
        "primary_source": "finnhub" if has_finnhub_key else "synthetic",
        "has_finnhub_key": has_finnhub_key,
        "fallback_enabled": True
    }
    
    return jsonify({
        "sources": sources,
        "config": config_info,
        "api_note": "Finnhub is used for real-time data. Synthetic data is used as fallback when real data is unavailable."
    })

@app.route('/symbols', methods=['GET'])
def get_symbols():
    """
    API endpoint to get a list of popular stock symbols
    """
    # Extended list of popular stock symbols
    popular_symbols = [
        {"symbol": "AAPL", "name": "Apple Inc."},
        {"symbol": "MSFT", "name": "Microsoft Corporation"},
        {"symbol": "GOOGL", "name": "Alphabet Inc."},
        {"symbol": "AMZN", "name": "Amazon.com, Inc."},
        {"symbol": "META", "name": "Meta Platforms, Inc."},
        {"symbol": "TSLA", "name": "Tesla, Inc."},
        {"symbol": "NVDA", "name": "NVIDIA Corporation"},
        {"symbol": "JPM", "name": "JPMorgan Chase & Co."},
        {"symbol": "BAC", "name": "Bank of America Corporation"},
        {"symbol": "WMT", "name": "Walmart Inc."},
        {"symbol": "JNJ", "name": "Johnson & Johnson"},
        {"symbol": "PG", "name": "Procter & Gamble Co."},
        {"symbol": "DIS", "name": "Walt Disney Co."},
        {"symbol": "HD", "name": "Home Depot Inc."},
        {"symbol": "NFLX", "name": "Netflix Inc."},
        {"symbol": "PYPL", "name": "PayPal Holdings Inc."},
        {"symbol": "INTC", "name": "Intel Corporation"},
        {"symbol": "CSCO", "name": "Cisco Systems Inc."},
        {"symbol": "VZ", "name": "Verizon Communications Inc."},
        {"symbol": "T", "name": "AT&T Inc."},
        {"symbol": "KO", "name": "Coca-Cola Co."},
        {"symbol": "PEP", "name": "PepsiCo Inc."},
        {"symbol": "NKE", "name": "Nike Inc."},
        {"symbol": "MCD", "name": "McDonald's Corp."},
        {"symbol": "SBUX", "name": "Starbucks Corp."},
        {"symbol": "AMD", "name": "Advanced Micro Devices Inc."},
        {"symbol": "IBM", "name": "International Business Machines Corp."},
        {"symbol": "F", "name": "Ford Motor Co."},
        {"symbol": "GM", "name": "General Motors Co."},
        {"symbol": "GS", "name": "Goldman Sachs Group Inc."}
    ]
    
    # Get search query parameter
    search = request.args.get('search', type=str)
    
    # Filter by search term if provided
    if search:
        search_lower = search.lower()
        filtered_symbols = [
            symbol for symbol in popular_symbols
            if search_lower in symbol["symbol"].lower() or search_lower in symbol["name"].lower()
        ]
        return jsonify(filtered_symbols)
    
    return jsonify(popular_symbols)

@app.route('/search-symbol', methods=['GET'])
def search_symbol():
    """
    API endpoint to search for stocks by keyword using Finnhub
    """
    query = request.args.get('q', type=str)
    
    if not query or len(query) < 2:
        return jsonify({"error": "Search query must be at least 2 characters"}), 400
        
    try:
        # Use Finnhub's search capability
        results = finnhub_search_symbol(query)
        
        if results and len(results) > 0:
            # Format the results to match our expected format
            formatted_results = []
            for item in results:
                formatted_results.append({
                    "symbol": item.get("symbol"),
                    "name": item.get("description", "Unknown"),
                    "displaySymbol": item.get("displaySymbol"),
                    "type": item.get("type", "Common Stock")
                })
            return jsonify(formatted_results[:10])  # Limit to 10 results
        else:
            # Fallback to predefined list with filtering
            symbols = get_symbols().json
            filtered = [s for s in symbols if query.upper() in s["symbol"] or query.lower() in s["name"].lower()]
            return jsonify(filtered[:10])  # Limit to 10 results
            
    except Exception as e:
        print(f"Error searching for symbol {query}: {str(e)}")
        return jsonify({"error": f"Failed to search for symbol: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """
    API endpoint to check the health of the prediction service and API integration
    """
    try:
        # Try to fetch recent data for a common stock (AAPL)
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d')
        
        # Try our main fetch method first
        try:
            # Get price from Finnhub
            price_data = get_stock_price('AAPL')
            # Get historical data from Finnhub
            stock_data = get_historical_data('AAPL', start_date, end_date)
            data_retrieval_method = "finnhub_api"
        except Exception as e:
            print(f"Primary method failed in health check: {str(e)}")
            # Use our synthetic data as last resort
            stock_data = generate_synthetic_data('AAPL', start_date, end_date)
            data_retrieval_method = "synthetic_data (fallback)"
        
        return jsonify({
            "status": "healthy",
            "message": "Prediction service is running properly",
            "api_provider": "Finnhub",
            "data_points_retrieved": len(stock_data) if isinstance(stock_data, pd.DataFrame) else 0,
            "data_method_used": data_retrieval_method,
            "synthetic_fallback_available": True,
            "timestamp": datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        error_detail = str(e)
        return jsonify({
            "status": "degraded",
            "message": f"Issues with Finnhub API but service is still operational with synthetic data fallback",
            "error_detail": error_detail,
            "timestamp": datetime.now().isoformat()
        }), 200  # Return 200 since service is still functional with fallbacks

@app.route('/current-price', methods=['GET'])
def get_current_price():
    """
    API endpoint to get the current price of a stock
    """
    symbol = request.args.get('symbol', default='AAPL', type=str)
    
    if not symbol or len(symbol) > 10:
        return jsonify({"error": "Invalid stock symbol provided"}), 400
    
    try:
        # Get price from Finnhub
        real_time_data = fetch_real_time_price(symbol)
        
        if real_time_data:
            current_price = real_time_data["price"]
            # If we have previous close from Finnhub, use it for price change
            if "previous_close" in real_time_data:
                price_change = current_price - real_time_data["previous_close"]
                price_change_percent = (price_change / real_time_data["previous_close"]) * 100 if real_time_data["previous_close"] > 0 else 0
            else:
                # Estimate a small price change for synthetic data
                price_change = current_price * 0.01 * (np.random.random() - 0.5)  # +/- 0.5% change
                price_change_percent = (price_change / current_price) * 100
            
            is_synthetic = real_time_data.get("synthetic", False)
            
            result = {
                'symbol': symbol,
                'current_price': round(float(current_price), 2),
                'price_change': round(float(price_change), 2),
                'price_change_percent': round(price_change_percent, 2),
                'source': real_time_data.get("source", "finnhub"),
                'timestamp': datetime.now().isoformat(),
                'synthetic': is_synthetic
            }
            
            return jsonify(result)
        
        # This should not happen since fetch_real_time_price should always return something
        return jsonify({"error": f"Could not get price data for {symbol}"}), 404
    
    except Exception as e:
        print(f"Error fetching current price for {symbol}: {str(e)}")
        traceback.print_exc()
        
        return jsonify({
            "error": f"Failed to fetch current price for {symbol}: {str(e)}",
            "suggestion": "Please try again later"
        }), 500

@app.route('/bulk-prices', methods=['GET'])
def get_bulk_prices():
    """
    API endpoint to get current prices for multiple stocks
    """
    symbols = request.args.get('symbols', type=str)
    
    if not symbols:
        return jsonify({"error": "No symbols provided"}), 400
        
    symbol_list = symbols.split(',')
    if len(symbol_list) > 20:
        return jsonify({"error": "Too many symbols requested (max 20)"}), 400
    
    try:
        result = {}
        
        # Fetch each symbol's data from Finnhub
        for symbol in symbol_list:
            try:
                # Get price from Finnhub with fallback to synthetic
                price_data = fetch_real_time_price(symbol)
                
                if price_data:
                    current_price = price_data['price']
                    
                    # Calculate price change
                    if 'previous_close' in price_data:
                        price_change = current_price - price_data['previous_close']
                        price_change_percent = (price_change / price_data['previous_close']) * 100 if price_data['previous_close'] > 0 else 0
                    else:
                        # Generate a small random change if no previous close
                        price_change_percent = ((datetime.now().minute % 10) - 5) / 2  # -2.5% to +2.5%
                        price_change = (price_change_percent / 100) * current_price
                    
                    result[symbol] = {
                        'current_price': round(current_price, 2),
                        'price_change': round(price_change, 2),
                        'price_change_percent': round(price_change_percent, 2),
                        'source': price_data.get('source', 'finnhub'),
                        'synthetic': price_data.get('synthetic', False)
                    }
                else:
                    result[symbol] = {
                        'error': 'Failed to fetch price data'
                    }
            except Exception as symbol_error:
                print(f"Error fetching data for symbol {symbol}: {str(symbol_error)}")
                result[symbol] = {
                    'error': str(symbol_error)
                }
                
        return jsonify({
            'prices': result,
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        print(f"Error fetching bulk prices: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to fetch bulk prices: {str(e)}"}), 500

@app.route('/top-movers', methods=['GET'])
def get_top_movers():
    """
    API endpoint to get the top moving stocks
    """
    try:
        # Get real-time price data for popular stocks
        popular_symbols = [
            "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "JPM", 
            "BAC", "WMT", "JNJ", "PG", "DIS", "HD", "NFLX", "PYPL", "INTC"
        ]
        
        # Reduced list for faster response
        symbols_str = ','.join(popular_symbols[:10])  # Limit to 10 most popular
        
        prices = {}
        movers = []
        
        # Get bulk price data
        try:
            # Call bulk_prices endpoint which uses Finnhub
            response = requests.get(f"{request.url_root}bulk-prices?symbols={symbols_str}")
            
            if response.status_code == 200:
                prices_data = response.json()
                for symbol in popular_symbols[:10]:
                    if symbol in prices_data.get('prices', {}):
                        stock_data = prices_data['prices'][symbol]
                        
                        # Skip if error
                        if 'error' in stock_data:
                            continue
                            
                        movers.append({
                            'symbol': symbol,
                            'name': get_company_name(symbol),
                            'price': stock_data['current_price'],
                            'change': stock_data['price_change'],
                            'percentChange': stock_data['price_change_percent'],
                            'source': stock_data.get('source', 'finnhub'),
                            'synthetic': stock_data.get('synthetic', False)
                        })
            else:
                # Fallback to individual price fetching on bulk endpoint failure
                for symbol in popular_symbols[:10]:
                    price_data = fetch_real_time_price(symbol)
                    if price_data:
                        change = price_data.get('change', 0)
                        percent_change = price_data.get('percent_change', 0)
                        
                        if 'percent_change' not in price_data and price_data.get('previous_close', 0) > 0:
                            percent_change = (price_data['price'] - price_data['previous_close']) / price_data['previous_close'] * 100
                            
                        movers.append({
                            'symbol': symbol,
                            'name': get_company_name(symbol),
                            'price': price_data['price'],
                            'change': change,
                            'percentChange': percent_change,
                            'source': price_data.get('source', 'finnhub'),
                            'synthetic': price_data.get('synthetic', False)
                        })
        except Exception as e:
            print(f"Error fetching bulk prices: {str(e)}")
            # Continue with what we have, or use synthetic data if we have nothing
            if not movers:
                movers = generate_synthetic_movers()
        
        # Sort by absolute percentage change (descending)
        movers.sort(key=lambda x: abs(x['percentChange']), reverse=True)
        
        return jsonify(movers)
    
    except Exception as e:
        print(f"Error getting top movers: {str(e)}")
        traceback.print_exc()
        
        # Return synthetic data as fallback
        return jsonify(generate_synthetic_movers())

def get_company_name(symbol):
    """Get company name for a symbol, with fallback to a default name"""
    company_names = {
        "AAPL": "Apple Inc.",
        "MSFT": "Microsoft Corp.",
        "GOOGL": "Alphabet Inc.",
        "GOOG": "Alphabet Inc.",
        "AMZN": "Amazon.com Inc.",
        "META": "Meta Platforms Inc.",
        "TSLA": "Tesla Inc.",
        "NVDA": "NVIDIA Corp.",
        "JPM": "JPMorgan Chase & Co.",
        "BAC": "Bank of America Corp.",
        "WMT": "Walmart Inc.",
        "JNJ": "Johnson & Johnson",
        "PG": "Procter & Gamble Co.",
        "DIS": "Walt Disney Co.",
        "HD": "Home Depot Inc.",
        "NFLX": "Netflix Inc.",
        "PYPL": "PayPal Holdings Inc.",
        "INTC": "Intel Corporation"
    }
    
    return company_names.get(symbol, f"{symbol} Inc.")

def generate_synthetic_movers():
    """Generate synthetic top movers data"""
    movers = [
        { "symbol": "AAPL", "name": "Apple Inc.", "price": 175.14, "change": 5.27, "percentChange": 3.10, "synthetic": True },
        { "symbol": "MSFT", "name": "Microsoft Corp.", "price": 410.56, "change": 2.34, "percentChange": 0.61, "synthetic": True },
        { "symbol": "GOOGL", "name": "Alphabet Inc.", "price": 166.89, "change": -1.12, "percentChange": -0.67, "synthetic": True },
        { "symbol": "AMZN", "name": "Amazon.com Inc.", "price": 182.51, "change": 3.45, "percentChange": 1.93, "synthetic": True },
        { "symbol": "META", "name": "Meta Platforms Inc.", "price": 474.21, "change": 10.35, "percentChange": 2.23, "synthetic": True },
        { "symbol": "TSLA", "name": "Tesla Inc.", "price": 175.12, "change": -8.23, "percentChange": -4.75, "synthetic": True },
        { "symbol": "NVDA", "name": "NVIDIA Corp.", "price": 900.02, "change": 25.37, "percentChange": 2.74, "synthetic": True },
        { "symbol": "JPM", "name": "JPMorgan Chase & Co.", "price": 198.76, "change": -1.89, "percentChange": -0.94, "synthetic": True }
    ]
    
    # Sort by absolute percentage change
    movers.sort(key=lambda x: abs(x['percentChange']), reverse=True)
    return movers

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', debug=True, port=port) 