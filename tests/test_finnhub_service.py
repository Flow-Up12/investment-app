import unittest
import sys
import os
import pandas as pd
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# Add the parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the functions to test
from src.prediction.finnhub_service import get_stock_price, get_historical_data

class TestFinnhubService(unittest.TestCase):
    
    @patch('src.prediction.finnhub_service.requests.get')
    def test_get_stock_price_success(self, mock_get):
        """Test successful stock price retrieval from Finnhub"""
        # Mock the API response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            'c': 150.0,  # Current price
            'pc': 145.0,  # Previous close
            'h': 152.0,   # High
            'l': 148.0,   # Low
            'o': 148.5    # Open
        }
        mock_get.return_value = mock_response
        
        # Call the function
        result = get_stock_price('AAPL')
        
        # Assertions
        self.assertIsNotNone(result)
        self.assertEqual(result['price'], 150.0)
        self.assertEqual(result['previous_close'], 145.0)
        self.assertEqual(result['change'], 5.0)
        self.assertAlmostEqual(result['percent_change'], 3.44827586206896)
        self.assertEqual(result['high'], 152.0)
        self.assertEqual(result['low'], 148.0)
        self.assertEqual(result['open'], 148.5)
        self.assertEqual(result['source'], 'finnhub')
        
    @patch('src.prediction.finnhub_service.requests.get')
    def test_get_stock_price_failure(self, mock_get):
        """Test handling of API errors in get_stock_price"""
        # Mock the API to raise an exception
        mock_get.side_effect = Exception("API Error")
        
        # Call the function
        result = get_stock_price('AAPL')
        
        # Assertions
        self.assertIsNone(result)
        
    @patch('src.prediction.finnhub_service.requests.get')
    def test_get_stock_price_invalid_data(self, mock_get):
        """Test handling of invalid data in get_stock_price"""
        # Mock the API response with invalid data
        mock_response = MagicMock()
        mock_response.json.return_value = {
            'error': 'Invalid API key or symbol'
        }
        mock_get.return_value = mock_response
        
        # Call the function
        result = get_stock_price('AAPL')
        
        # Assertions
        self.assertIsNone(result)
        
    @patch('src.prediction.finnhub_service.requests.get')
    def test_get_historical_data_success(self, mock_get):
        """Test successful historical data retrieval from Finnhub"""
        # Mock the API response
        mock_response = MagicMock()
        
        # Create sample data
        timestamps = [
            int(datetime.now().timestamp()) - (86400 * i)  # Past days
            for i in range(5)
        ]
        
        mock_response.json.return_value = {
            's': 'ok',
            't': timestamps,
            'o': [145.0, 146.0, 147.0, 148.0, 149.0],  # Open
            'h': [152.0, 153.0, 154.0, 155.0, 156.0],  # High
            'l': [142.0, 143.0, 144.0, 145.0, 146.0],  # Low
            'c': [150.0, 151.0, 152.0, 153.0, 154.0],  # Close
            'v': [1000000, 1100000, 1200000, 1300000, 1400000]  # Volume
        }
        mock_get.return_value = mock_response
        
        # Call the function
        start_date = (datetime.now() - timedelta(days=10)).strftime('%Y-%m-%d')
        end_date = datetime.now().strftime('%Y-%m-%d')
        result = get_historical_data('AAPL', start_date, end_date)
        
        # Assertions
        self.assertIsNotNone(result)
        self.assertIsInstance(result, pd.DataFrame)
        self.assertEqual(len(result), 5)
        self.assertIn('Open', result.columns)
        self.assertIn('High', result.columns)
        self.assertIn('Low', result.columns)
        self.assertIn('Close', result.columns)
        self.assertIn('Volume', result.columns)
        
    @patch('src.prediction.finnhub_service.requests.get')
    def test_get_historical_data_no_data(self, mock_get):
        """Test handling of no data response in get_historical_data"""
        # Mock the API response with no data
        mock_response = MagicMock()
        mock_response.json.return_value = {
            's': 'no_data'
        }
        mock_get.return_value = mock_response
        
        # Call the function
        start_date = (datetime.now() - timedelta(days=10)).strftime('%Y-%m-%d')
        end_date = datetime.now().strftime('%Y-%m-%d')
        result = get_historical_data('AAPL', start_date, end_date)
        
        # Assertions
        self.assertIsNone(result)
        
    @patch('src.prediction.finnhub_service.requests.get')
    def test_get_historical_data_incomplete(self, mock_get):
        """Test handling of incomplete data in get_historical_data"""
        # Mock the API response with incomplete data
        mock_response = MagicMock()
        mock_response.json.return_value = {
            's': 'ok',
            't': [int(datetime.now().timestamp())],
            # Missing 'c', 'o', etc.
        }
        mock_get.return_value = mock_response
        
        # Call the function
        start_date = (datetime.now() - timedelta(days=10)).strftime('%Y-%m-%d')
        end_date = datetime.now().strftime('%Y-%m-%d')
        result = get_historical_data('AAPL', start_date, end_date)
        
        # Assertions
        self.assertIsNone(result)
        
    @patch('src.prediction.finnhub_service.requests.get')
    def test_get_historical_data_error(self, mock_get):
        """Test handling of API errors in get_historical_data"""
        # Mock the API to raise an exception
        mock_get.side_effect = Exception("API Error")
        
        # Call the function
        start_date = (datetime.now() - timedelta(days=10)).strftime('%Y-%m-%d')
        end_date = datetime.now().strftime('%Y-%m-%d')
        result = get_historical_data('AAPL', start_date, end_date)
        
        # Assertions
        self.assertIsNone(result)


if __name__ == '__main__':
    unittest.main() 