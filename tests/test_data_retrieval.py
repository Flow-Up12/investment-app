import unittest
import sys
import os
import pandas as pd
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# Add the parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the data retrieval functions
from src.data.api import get_stock_price, get_historical_data, get_available_data_sources

class TestDataRetrieval(unittest.TestCase):
    
    @patch('src.data.api.requests.get')
    def test_get_stock_price(self, mock_get):
        """Test getting current stock price"""
        # Mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'c': 150.25,  # Current price
            't': 1627484400,  # Timestamp
            'o': 148.5,  # Open price
            'h': 151.0,  # High price
            'l': 147.8,  # Low price
            'pc': 146.75  # Previous close
        }
        mock_get.return_value = mock_response
        
        # Test function
        result = get_stock_price('AAPL')
        
        # Assertions
        self.assertIsNotNone(result)
        self.assertEqual(result['price'], 150.25)
        self.assertEqual(result['previous_close'], 146.75)
        self.assertTrue('timestamp' in result)
        
    @patch('src.data.api.requests.get')
    def test_get_stock_price_error(self, mock_get):
        """Test error handling in stock price retrieval"""
        # Mock error response
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response
        
        # Test function
        with self.assertRaises(Exception):
            get_stock_price('INVALID')
            
    @patch('src.data.api.pd.read_json')
    @patch('src.data.api.requests.get')
    def test_get_historical_data(self, mock_get, mock_read_json):
        """Test getting historical stock data"""
        # Mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'s': 'ok', 'data': []}
        mock_get.return_value = mock_response
        
        # Mock DataFrame
        dates = [datetime.now() - timedelta(days=i) for i in range(100)]
        prices = [100 + i * 0.5 for i in range(100)]
        mock_df = pd.DataFrame({
            't': [int(d.timestamp()) for d in dates],
            'c': prices,
            'o': [p - 1 for p in prices],
            'h': [p + 2 for p in prices],
            'l': [p - 2 for p in prices],
            'v': [1000000 for _ in range(100)]
        })
        mock_read_json.return_value = mock_df
        
        # Test function
        result = get_historical_data('AAPL', '1d', 100)
        
        # Assertions
        self.assertIsNotNone(result)
        self.assertIsInstance(result, pd.DataFrame)
        self.assertEqual(len(result), 100)
        self.assertTrue('Date' in result.columns)
        self.assertTrue('Close' in result.columns)
        
    @patch('src.data.api.requests.get')
    def test_get_historical_data_error(self, mock_get):
        """Test error handling in historical data retrieval"""
        # Mock error response
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response
        
        # Test function
        with self.assertRaises(Exception):
            get_historical_data('INVALID', '1d', 100)
            
    def test_get_available_data_sources(self):
        """Test retrieving available data sources"""
        sources = get_available_data_sources()
        
        # Assertions
        self.assertIsNotNone(sources)
        self.assertIsInstance(sources, list)
        self.assertTrue('finnhub' in sources)
        
    @patch('src.data.api.get_historical_data')
    def test_historical_data_validation(self, mock_get_data):
        """Test validation of historical data"""
        # Mock empty DataFrame
        mock_get_data.return_value = pd.DataFrame()
        
        # Test function with no data returned
        with self.assertRaises(Exception):
            get_historical_data('AAPL', '1d', 100)
            
        # Mock malformed DataFrame (missing columns)
        mock_df = pd.DataFrame({'A': [1, 2, 3]})
        mock_get_data.return_value = mock_df
        
        # Test function with malformed data
        with self.assertRaises(Exception):
            get_historical_data('AAPL', '1d', 100)


if __name__ == '__main__':
    unittest.main() 