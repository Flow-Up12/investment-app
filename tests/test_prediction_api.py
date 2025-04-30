import unittest
import sys
import os
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the modules to test
from src.backend.services.stockService import getPrediction, checkHealth
from src.prediction.app import predict_get, predict, fetch_stock_data, generate_synthetic_data
from src.prediction.finnhub_service import get_stock_price, get_historical_data, generate_synthetic_price, generate_synthetic_historical_data

class TestPredictionAPI(unittest.TestCase):
    
    def setUp(self):
        """Set up test data"""
        self.ticker = "AAPL"
        self.days = 7
        
        # Sample prediction response
        self.sample_prediction = {
            "symbol": "AAPL",
            "historicalData": [
                {"date": "2023-06-01", "price": 175.42},
                {"date": "2023-06-02", "price": 176.65}
            ],
            "predictions": [
                {"date": "2023-06-03", "price": 177.89},
                {"date": "2023-06-04", "price": 178.32}
            ],
            "confidence": 85.7,
            "dataType": "real",
            "modelType": "Linear Regression"
        }
        
        # Sample historical data
        dates = pd.date_range(start='2023-01-01', periods=30, freq='B')
        self.sample_historical_data = pd.DataFrame({
            'Open': np.random.uniform(170, 180, size=30),
            'High': np.random.uniform(175, 185, size=30),
            'Low': np.random.uniform(165, 175, size=30),
            'Close': np.random.uniform(170, 180, size=30),
            'Volume': np.random.randint(1000000, 10000000, size=30)
        }, index=dates)
        
        # Sample price data
        self.sample_price_data = {
            "price": 176.65,
            "previous_close": 175.42,
            "change": 1.23,
            "percent_change": 0.7,
            "source": "finnhub"
        }

    @patch('src.backend.services.stockService.axios.get')
    def test_get_prediction(self, mock_axios):
        """Test getting stock prediction from the backend service"""
        # Mock axios response
        mock_response = MagicMock()
        mock_response.data = self.sample_prediction
        mock_axios.return_value = mock_response
        
        # Test prediction retrieval
        result = getPrediction(self.ticker, self.days)
        
        # Assertions
        self.assertEqual(result['symbol'], self.ticker)
        self.assertEqual(len(result['predictions']), 2)
        
        # Test with synthetic data flag
        result = getPrediction(self.ticker, self.days, True)
        
        # Verify correct parameters were passed
        mock_axios.assert_called_with(
            'http://prediction:5001/predict', 
            {'params': {'symbol': self.ticker, 'days': self.days, 'use_synthetic': True}, 'timeout': 10000}
        )
        
        # Test handling API errors
        mock_axios.side_effect = Exception("API Error")
        
        with self.assertRaises(Exception):
            result = getPrediction(self.ticker, self.days)

    @patch('src.backend.services.stockService.axios.get')
    def test_check_health(self, mock_axios):
        """Test checking the health of the prediction service"""
        # Mock axios response
        mock_response = MagicMock()
        mock_response.data = {"healthy": True, "status": "healthy"}
        mock_axios.return_value = mock_response
        
        # Test health check
        result = checkHealth()
        
        # Assertions
        self.assertTrue(result['healthy'])
        
        # Test handling API errors
        mock_axios.side_effect = Exception("Connection refused")
        
        result = checkHealth()
        
        # Assertions
        self.assertFalse(result['healthy'])
        self.assertEqual(result['status'], 'unhealthy')

    @patch('src.prediction.finnhub_service.requests.get')
    def test_get_stock_price(self, mock_get):
        """Test fetching real-time stock price"""
        # Mock successful API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'c': 176.65,  # Current price
            'pc': 175.42,  # Previous close
            'h': 177.80,   # High price
            'l': 175.20,   # Low price
            'o': 175.50    # Open price
        }
        mock_get.return_value = mock_response
        
        # Test stock price retrieval
        result = get_stock_price(self.ticker)
        
        # Assertions
        self.assertEqual(result['price'], 176.65)
        self.assertEqual(result['previous_close'], 175.42)
        self.assertEqual(result['source'], 'finnhub')
        
        # Test fallback to synthetic with error
        mock_get.side_effect = Exception("API Error")
        
        # Test with API error
        with patch('src.prediction.finnhub_service.generate_synthetic_price') as mock_synthetic:
            mock_synthetic.return_value = self.sample_price_data
            result = get_stock_price(self.ticker)
            self.assertEqual(result, self.sample_price_data)

    @patch('src.prediction.finnhub_service.requests.get')
    def test_get_historical_data(self, mock_get):
        """Test fetching historical stock data"""
        # Setup sample data
        timestamps = [int(datetime.strptime('2023-01-01', '%Y-%m-%d').timestamp()) + (86400 * i) for i in range(30)]
        sample_finnhub_data = {
            's': 'ok',
            't': timestamps,
            'o': [175.0] * 30,  # Open prices
            'h': [180.0] * 30,  # High prices
            'l': [170.0] * 30,  # Low prices
            'c': [178.0] * 30,  # Close prices
            'v': [1000000] * 30  # Volume
        }
        
        # Mock successful API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = sample_finnhub_data
        mock_get.return_value = mock_response
        
        # Test historical data retrieval
        result = get_historical_data(self.ticker, '2023-01-01', '2023-01-30')
        
        # Assertions
        self.assertIsInstance(result, pd.DataFrame)
        self.assertEqual(len(result), 30)
        self.assertIn('Open', result.columns)
        self.assertIn('Close', result.columns)
        
        # Test API error
        mock_get.side_effect = Exception("API Error")
        
        with patch('src.prediction.finnhub_service.generate_synthetic_historical_data') as mock_synthetic:
            mock_synthetic.return_value = self.sample_historical_data
            result = get_historical_data(self.ticker, '2023-01-01', '2023-01-30')
            self.assertIs(result, self.sample_historical_data)

if __name__ == '__main__':
    unittest.main() 