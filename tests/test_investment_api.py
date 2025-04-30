import unittest
import sys
import os
import json
import pandas as pd
import numpy as np
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

# Add the parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the API functions
from src.api.investment_data import (
    fetch_stock_data,
    fetch_market_news,
    fetch_company_info,
    fetch_historical_data,
    search_stocks,
    fetch_stock_indicators
)

class TestInvestmentAPI(unittest.TestCase):
    
    def setUp(self):
        """Set up test data"""
        self.ticker = "AAPL"
        self.start_date = "2023-01-01"
        self.end_date = "2023-12-31"
        
        # Sample stock data
        self.sample_stock_data = {
            "symbol": "AAPL",
            "price": 175.42,
            "change": 2.35,
            "change_percent": 1.36,
            "volume": 76543200,
            "market_cap": 2750000000000,
            "timestamp": "2023-12-31T16:00:00Z"
        }
        
        # Sample historical data
        dates = pd.date_range(start=self.start_date, end=self.end_date, freq='D')
        self.sample_historical_data = pd.DataFrame({
            'date': dates,
            'open': np.random.normal(170, 5, len(dates)),
            'high': np.random.normal(175, 5, len(dates)),
            'low': np.random.normal(165, 5, len(dates)),
            'close': np.random.normal(170, 5, len(dates)),
            'volume': np.random.randint(50000000, 100000000, len(dates)),
            'adj_close': np.random.normal(170, 5, len(dates))
        })
        
        # Sample news data
        self.sample_news_data = [
            {
                "title": "Apple Announces New iPhone",
                "source": "TechNews",
                "url": "https://example.com/news/1",
                "published_at": "2023-09-10T10:00:00Z",
                "summary": "Apple unveils the latest iPhone with new features."
            },
            {
                "title": "Apple's Quarterly Earnings Beat Expectations",
                "source": "FinanceDaily",
                "url": "https://example.com/news/2",
                "published_at": "2023-07-27T16:30:00Z",
                "summary": "Apple reports strong quarterly earnings, exceeding analyst forecasts."
            }
        ]
        
        # Sample company info
        self.sample_company_info = {
            "symbol": "AAPL",
            "company_name": "Apple Inc.",
            "exchange": "NASDAQ",
            "industry": "Consumer Electronics",
            "website": "https://www.apple.com",
            "description": "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.",
            "ceo": "Tim Cook",
            "employees": 154000,
            "headquarters": "Cupertino, California",
            "founded": 1976
        }
        
        # Sample stock search results
        self.sample_search_results = [
            {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ"},
            {"symbol": "AAPL.BA", "name": "Apple Inc.", "exchange": "Buenos Aires"},
            {"symbol": "AAPL.MX", "name": "Apple Inc.", "exchange": "Mexico"}
        ]
        
        # Sample indicators data
        self.sample_indicators = {
            "symbol": "AAPL",
            "indicators": {
                "rsi": 56.78,
                "macd": 2.45,
                "bollinger_bands": {
                    "upper": 185.23,
                    "middle": 175.42,
                    "lower": 165.61
                },
                "sma_50": 172.36,
                "sma_200": 168.74,
                "ema_12": 176.82,
                "ema_26": 174.37
            }
        }
    
    @patch('src.api.investment_data.requests.get')
    def test_fetch_stock_data(self, mock_get):
        """Test fetching current stock data"""
        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self.sample_stock_data
        mock_get.return_value = mock_response
        
        # Test stock data retrieval
        result = fetch_stock_data(self.ticker)
        
        # Assertions
        self.assertTrue(result['success'])
        self.assertEqual(result['data']['symbol'], self.ticker)
        self.assertEqual(result['data']['price'], 175.42)
        
        # Test API failure
        mock_response.status_code = 404
        mock_response.json.return_value = {'error': 'Not found'}
        
        result = fetch_stock_data(self.ticker)
        
        # Assertions
        self.assertFalse(result['success'])
        self.assertEqual(result['message'], 'Failed to retrieve stock data')
    
    @patch('src.api.investment_data.requests.get')
    def test_fetch_market_news(self, mock_get):
        """Test fetching market news"""
        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'articles': self.sample_news_data}
        mock_get.return_value = mock_response
        
        # Test news retrieval
        result = fetch_market_news(limit=2)
        
        # Assertions
        self.assertTrue(result['success'])
        self.assertEqual(len(result['news']), 2)
        self.assertEqual(result['news'][0]['title'], 'Apple Announces New iPhone')
        
        # Test stock-specific news
        result = fetch_market_news(ticker=self.ticker, limit=2)
        
        # Assertions
        self.assertTrue(result['success'])
        self.assertEqual(len(result['news']), 2)
        
        # Test API failure
        mock_response.status_code = 500
        mock_response.json.return_value = {'error': 'Server error'}
        
        result = fetch_market_news()
        
        # Assertions
        self.assertFalse(result['success'])
        self.assertEqual(result['message'], 'Failed to retrieve market news')
    
    @patch('src.api.investment_data.requests.get')
    def test_fetch_company_info(self, mock_get):
        """Test fetching company information"""
        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self.sample_company_info
        mock_get.return_value = mock_response
        
        # Test company info retrieval
        result = fetch_company_info(self.ticker)
        
        # Assertions
        self.assertTrue(result['success'])
        self.assertEqual(result['data']['symbol'], self.ticker)
        self.assertEqual(result['data']['company_name'], 'Apple Inc.')
        self.assertEqual(result['data']['ceo'], 'Tim Cook')
        
        # Test API failure
        mock_response.status_code = 404
        mock_response.json.return_value = {'error': 'Company not found'}
        
        result = fetch_company_info(self.ticker)
        
        # Assertions
        self.assertFalse(result['success'])
        self.assertEqual(result['message'], 'Failed to retrieve company information')
    
    @patch('src.api.investment_data.pd.read_csv')
    @patch('src.api.investment_data.requests.get')
    def test_fetch_historical_data(self, mock_get, mock_read_csv):
        """Test fetching historical stock data"""
        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b'date,open,high,low,close,volume,adj_close\n...'
        mock_get.return_value = mock_response
        
        # Mock pandas read_csv
        mock_read_csv.return_value = self.sample_historical_data
        
        # Test historical data retrieval
        result = fetch_historical_data(
            self.ticker,
            start_date=self.start_date,
            end_date=self.end_date
        )
        
        # Assertions
        self.assertTrue(result['success'])
        self.assertIsInstance(result['data'], pd.DataFrame)
        self.assertEqual(len(result['data']), len(self.sample_historical_data))
        
        # Test API failure
        mock_response.status_code = 500
        
        result = fetch_historical_data(
            self.ticker,
            start_date=self.start_date,
            end_date=self.end_date
        )
        
        # Assertions
        self.assertFalse(result['success'])
        self.assertEqual(result['message'], 'Failed to retrieve historical data')
    
    @patch('src.api.investment_data.requests.get')
    def test_search_stocks(self, mock_get):
        """Test searching for stocks"""
        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'results': self.sample_search_results}
        mock_get.return_value = mock_response
        
        # Test stock search
        result = search_stocks('Apple')
        
        # Assertions
        self.assertTrue(result['success'])
        self.assertEqual(len(result['results']), 3)
        self.assertEqual(result['results'][0]['symbol'], 'AAPL')
        
        # Test API failure
        mock_response.status_code = 500
        mock_response.json.return_value = {'error': 'Server error'}
        
        result = search_stocks('Apple')
        
        # Assertions
        self.assertFalse(result['success'])
        self.assertEqual(result['message'], 'Failed to search stocks')
    
    @patch('src.api.investment_data.requests.get')
    def test_fetch_stock_indicators(self, mock_get):
        """Test fetching technical indicators"""
        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self.sample_indicators
        mock_get.return_value = mock_response
        
        # Test indicators retrieval
        result = fetch_stock_indicators(self.ticker)
        
        # Assertions
        self.assertTrue(result['success'])
        self.assertEqual(result['data']['symbol'], self.ticker)
        self.assertIn('rsi', result['data']['indicators'])
        self.assertIn('macd', result['data']['indicators'])
        self.assertIn('bollinger_bands', result['data']['indicators'])
        
        # Test API failure
        mock_response.status_code = 500
        mock_response.json.return_value = {'error': 'Server error'}
        
        result = fetch_stock_indicators(self.ticker)
        
        # Assertions
        self.assertFalse(result['success'])
        self.assertEqual(result['message'], 'Failed to retrieve technical indicators')


if __name__ == '__main__':
    unittest.main() 