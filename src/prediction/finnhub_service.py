import os
import requests
import pandas as pd
from datetime import datetime, timedelta
import time
import traceback
import numpy as np
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

# Get API key from environment
FINNHUB_API_KEY = os.environ.get('FINNHUB_API_KEY', 'cpn17dpr01qtggba6n40cpn17dpr01qtggba6n4g')

# Create a session with retry capabilities
def create_session():
    session = requests.Session()
    retry_strategy = Retry(
        total=2,  # Reduced total number of retries
        backoff_factor=0.5,  # Reduced time factor between retries
        status_forcelist=[429, 500, 502, 503, 504],  # HTTP status codes to retry on
        allowed_methods=["GET"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session

def get_stock_price(symbol, retries=2):
    """Get real-time stock price from Finnhub with retry logic"""
    if not FINNHUB_API_KEY:
        print("Finnhub API key not configured")
        return None
    
    session = create_session()    
    
    # Try multiple times with backoff
    for attempt in range(retries):
        try:
            url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={FINNHUB_API_KEY}"
            response = session.get(url, timeout=3)  # Reduced timeout
            
            # Handle rate limiting
            if response.status_code == 429:
                wait_time = min(int(response.headers.get('Retry-After', 2)), 2)  # Cap wait time
                print(f"Rate limited, waiting {wait_time} seconds before retry...")
                time.sleep(wait_time)
                continue
                
            # Handle other status codes
            if response.status_code != 200:
                print(f"Finnhub API error: Status code {response.status_code}")
                if attempt < retries - 1:
                    time.sleep(0.5)  # Reduced sleep time
                    continue
                # If we reach here, create synthetic data
                return generate_synthetic_price(symbol)
                
            data = response.json()
            
            if 'c' in data and data['c'] > 0:
                return {
                    "price": data['c'],  # Current price
                    "previous_close": data['pc'],  # Previous close price
                    "change": data['c'] - data['pc'],  # Price change
                    "percent_change": ((data['c'] - data['pc']) / data['pc']) * 100,  # Percentage change
                    "high": data['h'],  # High price of the day
                    "low": data['l'],  # Low price of the day
                    "open": data['o'],  # Open price of the day
                    "source": "finnhub",
                    "date": datetime.now().strftime('%Y-%m-%d')
                }
            
            # If we got a response but price is 0, might be closed market or other issue
            if 'c' in data and data['c'] == 0:
                print(f"Finnhub returned price of 0 for {symbol}, possibly closed market")
                return generate_synthetic_price(symbol)
            
            if attempt < retries - 1:
                time.sleep(0.5)  # Reduced sleep time
            else:
                return generate_synthetic_price(symbol)
                
        except Exception as e:
            print(f"Error fetching Finnhub price data for {symbol} (attempt {attempt + 1}): {str(e)}")
            if attempt < retries - 1:
                time.sleep(0.5)  # Reduced sleep time
            else:
                traceback.print_exc()
                return generate_synthetic_price(symbol)

def generate_synthetic_price(symbol):
    """Generate synthetic price data as fallback"""
    # Generate a "realistic" price based on the symbol
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
        'NVDA': 900.0,
        'JPM': 200.0,
        'BAC': 38.0
    }
    
    # Try to get a more accurate base price based on symbol
    if symbol in symbol_price_map:
        base_price = symbol_price_map[symbol]
    else:
        # For unknown symbols use a reasonable default
        if len(symbol) <= 3:
            base_price = 150.0
        else:
            base_price = 75.0
    
    # Add slight randomization (±2%)
    current_price = base_price * (0.98 + np.random.random() * 0.04)
    prev_close = current_price * (0.98 + np.random.random() * 0.04)
    
    return {
        "price": current_price,
        "previous_close": prev_close,
        "change": current_price - prev_close,
        "percent_change": ((current_price - prev_close) / prev_close) * 100,
        "high": current_price * 1.02,
        "low": current_price * 0.98,
        "open": prev_close * (0.99 + np.random.random() * 0.02),
        "date": datetime.now().strftime('%Y-%m-%d'),
        "source": "synthetic (Finnhub unavailable)",
        "synthetic": True
    }

def get_historical_data(symbol, start_date, end_date, retries=2):
    """Get historical stock data from Finnhub with retry logic"""
    if not FINNHUB_API_KEY:
        print("Finnhub API key not configured")
        return None
    
    session = create_session()
    
    # Try multiple times with backoff
    for attempt in range(retries):
        try:
            # Convert dates to unix timestamps
            start_timestamp = int(datetime.strptime(start_date, '%Y-%m-%d').timestamp())
            end_timestamp = int(datetime.strptime(end_date, '%Y-%m-%d').timestamp())
            
            # Request historical candles
            url = f"https://finnhub.io/api/v1/stock/candle?symbol={symbol}&resolution=D&from={start_timestamp}&to={end_timestamp}&token={FINNHUB_API_KEY}"
            response = session.get(url, timeout=5)  # Reduced timeout
            
            # Handle rate limiting
            if response.status_code == 429:
                wait_time = min(int(response.headers.get('Retry-After', 2)), 2)  # Cap wait time
                print(f"Rate limited, waiting {wait_time} seconds before retry...")
                time.sleep(wait_time)
                continue
                
            # Handle other status codes
            if response.status_code != 200:
                print(f"Finnhub API error: Status code {response.status_code}")
                if attempt < retries - 1:
                    time.sleep(0.5)  # Reduced sleep time
                    continue
                # Time to generate synthetic data
                return generate_synthetic_historical_data(symbol, start_date, end_date)
            
            data = response.json()
            
            if data.get('s') == 'no_data':
                print(f"No data available for {symbol}")
                return generate_synthetic_historical_data(symbol, start_date, end_date)
                
            # Create DataFrame from candle data
            if 'c' not in data or 'o' not in data or 't' not in data:
                print(f"Incomplete data received from Finnhub for {symbol}")
                if attempt < retries - 1:
                    time.sleep(0.5)  # Reduced sleep time
                    continue
                return generate_synthetic_historical_data(symbol, start_date, end_date)
                
            # Create DataFrame from candle data
            df = pd.DataFrame({
                'Open': data['o'],
                'High': data['h'],
                'Low': data['l'],
                'Close': data['c'],
                'Volume': data['v']
            }, index=pd.to_datetime([datetime.fromtimestamp(ts) for ts in data['t']]))
            
            df = df.sort_index()
            print(f"Successfully fetched {len(df)} records from Finnhub for {symbol}")
            
            # Flag to indicate this is not synthetic data
            df['Synthetic'] = False
            
            return df
            
        except Exception as e:
            print(f"Error fetching Finnhub historical data for {symbol} (attempt {attempt + 1}): {str(e)}")
            if attempt < retries - 1:
                time.sleep(1)  # Longer sleep for historical data
            else:
                traceback.print_exc()
                return generate_synthetic_historical_data(symbol, start_date, end_date)

def generate_synthetic_historical_data(symbol, start_date, end_date):
    """Generate synthetic historical data as a fallback"""
    print(f"Generating synthetic historical data for {symbol}")
    
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
        'NVDA': 900.0,
        'JPM': 200.0,
        'BAC': 38.0
    }
    
    # Try to get a more accurate base price based on symbol
    if symbol in symbol_price_map:
        base_price = symbol_price_map[symbol]
    else:
        # For unknown symbols use a more reasonable default
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

def get_company_profile(symbol, retries=2):
    """Get company profile information from Finnhub"""
    if not FINNHUB_API_KEY:
        print("Finnhub API key not configured")
        return None
    
    session = create_session()
    
    for attempt in range(retries):
        try:
            url = f"https://finnhub.io/api/v1/stock/profile2?symbol={symbol}&token={FINNHUB_API_KEY}"
            response = session.get(url, timeout=3)  # Reduced timeout
            
            if response.status_code == 429:
                wait_time = min(int(response.headers.get('Retry-After', 2)), 2)  # Cap wait time
                print(f"Rate limited, waiting {wait_time} seconds before retry...")
                time.sleep(wait_time)
                continue
                
            if response.status_code != 200:
                print(f"Finnhub API error: Status code {response.status_code}")
                if attempt < retries - 1:
                    time.sleep(0.5)  # Reduced sleep time
                    continue
                return generate_synthetic_profile(symbol)
                
            data = response.json()
            
            if not data or len(data) == 0:
                print(f"No company profile data available for {symbol}")
                return generate_synthetic_profile(symbol)
                
            return data
            
        except Exception as e:
            print(f"Error fetching company profile for {symbol} (attempt {attempt + 1}): {str(e)}")
            if attempt < retries - 1:
                time.sleep(0.5)  # Reduced sleep time
            else:
                return generate_synthetic_profile(symbol)

def generate_synthetic_profile(symbol):
    """Generate a synthetic company profile"""
    profile = {
        "symbol": symbol,
        "name": f"{symbol} Inc.",
        "exchange": "NASDAQ",
        "currency": "USD",
        "country": "US",
        "sector": "Technology",
        "industry": "Software",
        "marketCapitalization": 10000000000,  # 10B
        "ipoDate": "2000-01-01",
        "phone": "+1-123-456-7890",
        "weburl": f"https://www.{symbol.lower()}.com",
        "logo": f"https://logo.clearbit.com/{symbol.lower()}.com",
        "finnhubIndustry": "Technology",
        "synthetic": True
    }
    return profile

def get_market_news(category="general", min_id=0, retries=2):
    """Get market news from Finnhub"""
    if not FINNHUB_API_KEY:
        print("Finnhub API key not configured")
        return None
    
    session = create_session()
    
    for attempt in range(retries):
        try:
            url = f"https://finnhub.io/api/v1/news?category={category}&minId={min_id}&token={FINNHUB_API_KEY}"
            response = session.get(url, timeout=3)  # Reduced timeout
            
            if response.status_code == 429:
                wait_time = min(int(response.headers.get('Retry-After', 2)), 2)  # Cap wait time
                print(f"Rate limited, waiting {wait_time} seconds before retry...")
                time.sleep(wait_time)
                continue
                
            if response.status_code != 200:
                print(f"Finnhub API error: Status code {response.status_code}")
                if attempt < retries - 1:
                    time.sleep(0.5)  # Reduced sleep time
                    continue
                return generate_synthetic_news(category, 5)
                
            data = response.json()
            
            if not data or len(data) == 0:
                print(f"No news available for category {category}")
                return generate_synthetic_news(category, 5)
                
            return data
            
        except Exception as e:
            print(f"Error fetching market news (attempt {attempt + 1}): {str(e)}")
            if attempt < retries - 1:
                time.sleep(0.5)  # Reduced sleep time
            else:
                return generate_synthetic_news(category, 5)

def generate_synthetic_news(category, count=5):
    """Generate synthetic news articles"""
    now = datetime.now()
    news = []
    
    headlines = [
        "Markets React to Federal Reserve Announcement",
        "Tech Stocks Rally on Strong Earnings",
        "Oil Prices Drop Amid Supply Concerns",
        "Global Markets Mixed as Investors Weigh Economic Data",
        "Wall Street Closes Higher Led by Technology Sector",
        "Inflation Data Impacts Market Sentiment",
        "Retail Sales Beat Expectations",
        "Treasury Yields Rise on Economic Outlook",
        "Banking Sector Faces Regulatory Scrutiny",
        "Semiconductor Stocks Surge on Demand Forecast"
    ]
    
    for i in range(min(count, len(headlines))):
        timestamp = int((now - timedelta(hours=i)).timestamp())
        news.append({
            "category": category,
            "datetime": timestamp,
            "headline": headlines[i],
            "id": 1000000 + i,
            "image": "https://via.placeholder.com/640x360",
            "related": "",
            "source": "Synthetic News",
            "summary": f"This is a synthetic news article about {headlines[i].lower()}.",
            "url": "https://example.com/news",
            "synthetic": True
        })
    
    return news

def get_company_news(symbol, _from, to, retries=2):
    """Get company-specific news from Finnhub"""
    if not FINNHUB_API_KEY:
        print("Finnhub API key not configured")
        return None
    
    session = create_session()
    
    for attempt in range(retries):
        try:
            url = f"https://finnhub.io/api/v1/company-news?symbol={symbol}&from={_from}&to={to}&token={FINNHUB_API_KEY}"
            response = session.get(url, timeout=3)  # Reduced timeout
            
            if response.status_code == 429:
                wait_time = min(int(response.headers.get('Retry-After', 2)), 2)  # Cap wait time
                print(f"Rate limited, waiting {wait_time} seconds before retry...")
                time.sleep(wait_time)
                continue
                
            if response.status_code != 200:
                print(f"Finnhub API error: Status code {response.status_code}")
                if attempt < retries - 1:
                    time.sleep(0.5)  # Reduced sleep time
                    continue
                return generate_synthetic_company_news(symbol, 5)
                
            data = response.json()
            
            if not data or len(data) == 0:
                print(f"No company news available for {symbol}")
                return generate_synthetic_company_news(symbol, 5)
                
            return data
            
        except Exception as e:
            print(f"Error fetching company news for {symbol} (attempt {attempt + 1}): {str(e)}")
            if attempt < retries - 1:
                time.sleep(0.5)  # Reduced sleep time
            else:
                return generate_synthetic_company_news(symbol, 5)

def generate_synthetic_company_news(symbol, count=5):
    """Generate synthetic company news"""
    now = datetime.now()
    news = []
    
    headlines = [
        f"{symbol} Reports Strong Quarterly Earnings",
        f"{symbol} Announces New Product Launch",
        f"{symbol} Expands into International Markets",
        f"{symbol} CEO Discusses Future Growth Strategy",
        f"{symbol} Partners with Major Technology Firm",
        f"{symbol} Faces Regulatory Review",
        f"{symbol} Stock Upgraded by Analysts",
        f"{symbol} Increases Dividend by 10%",
        f"{symbol} Announces Share Buyback Program",
        f"{symbol} Hosts Annual Investor Conference"
    ]
    
    for i in range(min(count, len(headlines))):
        timestamp = int((now - timedelta(days=i)).timestamp())
        news.append({
            "category": "company news",
            "datetime": timestamp,
            "headline": headlines[i],
            "id": 1000000 + i,
            "image": "https://via.placeholder.com/640x360",
            "related": symbol,
            "source": "Synthetic News",
            "summary": f"This is a synthetic news article about {symbol}.",
            "url": "https://example.com/news",
            "synthetic": True
        })
    
    return news

def search_symbol(query, retries=2):
    """Search for symbols using Finnhub"""
    if not FINNHUB_API_KEY:
        print("Finnhub API key not configured")
        return None
    
    session = create_session()
    
    for attempt in range(retries):
        try:
            url = f"https://finnhub.io/api/v1/search?q={query}&token={FINNHUB_API_KEY}"
            response = session.get(url, timeout=3)  # Reduced timeout
            
            if response.status_code == 429:
                wait_time = min(int(response.headers.get('Retry-After', 2)), 2)  # Cap wait time
                print(f"Rate limited, waiting {wait_time} seconds before retry...")
                time.sleep(wait_time)
                continue
                
            if response.status_code != 200:
                print(f"Finnhub API error: Status code {response.status_code}")
                if attempt < retries - 1:
                    time.sleep(0.5)  # Reduced sleep time
                    continue
                return generate_synthetic_search_results(query)
                
            data = response.json()
            
            if 'result' not in data or len(data['result']) == 0:
                print(f"No symbol search results for '{query}'")
                return generate_synthetic_search_results(query)
                
            return data['result']
            
        except Exception as e:
            print(f"Error searching for symbol '{query}' (attempt {attempt + 1}): {str(e)}")
            if attempt < retries - 1:
                time.sleep(0.5)  # Reduced sleep time
            else:
                return generate_synthetic_search_results(query)

def generate_synthetic_search_results(query):
    """Generate synthetic search results"""
    # Create some basic fake results based on the query
    results = []
    
    # Common symbols for reference
    common_symbols = [
        {"symbol": "AAPL", "name": "Apple Inc."},
        {"symbol": "MSFT", "name": "Microsoft Corporation"},
        {"symbol": "GOOGL", "name": "Alphabet Inc."},
        {"symbol": "AMZN", "name": "Amazon.com, Inc."},
        {"symbol": "META", "name": "Meta Platforms, Inc."},
        {"symbol": "TSLA", "name": "Tesla, Inc."},
        {"symbol": "NVDA", "name": "NVIDIA Corporation"},
        {"symbol": "JPM", "name": "JPMorgan Chase & Co."}
    ]
    
    # Filter based on query
    query_lower = query.lower()
    for item in common_symbols:
        if query_lower in item["symbol"].lower() or query_lower in item["name"].lower():
            results.append({
                "description": item["name"],
                "displaySymbol": item["symbol"],
                "symbol": item["symbol"],
                "type": "Common Stock",
                "synthetic": True
            })
    
    return results 