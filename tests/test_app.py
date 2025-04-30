import unittest
import sys
import os
import json
from unittest.mock import patch, MagicMock
import pandas as pd
from datetime import datetime, timedelta

# Add the parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the app
from app import app

class TestApp(unittest.TestCase):
    
    def setUp(self):
        """Set up test client"""
        self.app = app.test_client()
        self.app.testing = True
        
    @patch('app.get_stock_price')
    def test_stock_price_route(self, mock_get_stock_price):
        """Test the /stock/price route"""
        # Mock the API response
        mock_get_stock_price.return_value = {
            'price': 150.0,
            'previous_close': 145.0,
            'change': 5.0,
            'percent_change': 3.45,
            'high': 152.0,
            'low': 148.0,
            'open': 148.5,
            'source': 'finnhub'
        }
        
        # Make request to the API
        response = self.app.get('/stock/price?symbol=AAPL')
        
        # Check the response
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['price'], 150.0)
        self.assertEqual(data['previous_close'], 145.0)
        self.assertEqual(data['change'], 5.0)
        self.assertEqual(data['percent_change'], 3.45)
        self.assertEqual(data['high'], 152.0)
        self.assertEqual(data['low'], 148.0)
        self.assertEqual(data['open'], 148.5)
        self.assertEqual(data['source'], 'finnhub')
        
    @patch('app.get_stock_price')
    def test_stock_price_route_error(self, mock_get_stock_price):
        """Test the /stock/price route with error"""
        # Mock the API response
        mock_get_stock_price.return_value = None
        
        # Make request to the API
        response = self.app.get('/stock/price?symbol=AAPL')
        
        # Check the response
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(data['error'], 'Could not retrieve stock data')
        
    @patch('app.get_historical_data')
    @patch('app.create_model')
    def test_predict_route(self, mock_create_model, mock_get_historical_data):
        """Test the /predict route"""
        # Mock historical data
        dates = [datetime.now() - timedelta(days=i) for i in range(30)]
        prices = [150 + i for i in range(30)]
        mock_df = pd.DataFrame({
            'Date': dates,
            'Close': prices
        })
        mock_get_historical_data.return_value = mock_df
        
        # Mock model
        mock_model = MagicMock()
        mock_model.predict.return_value = [155, 160, 165]
        mock_create_model.return_value = mock_model
        
        # Prepare request data
        request_data = {
            'symbol': 'AAPL',
            'days': 3,
            'data_type': 'close'
        }
        
        # Make request to the API
        response = self.app.post('/predict', 
                                 data=json.dumps(request_data),
                                 content_type='application/json')
        
        # Check the response
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertIn('historical_data', data)
        self.assertIn('predicted_data', data)
        self.assertIn('prediction_date', data)
        self.assertEqual(len(data['predicted_values']), 3)
        
    @patch('app.get_historical_data')
    def test_predict_route_no_data(self, mock_get_historical_data):
        """Test the /predict route with no data"""
        # Mock historical data
        mock_get_historical_data.return_value = None
        
        # Prepare request data
        request_data = {
            'symbol': 'AAPL',
            'days': 3,
            'data_type': 'close'
        }
        
        # Make request to the API
        response = self.app.post('/predict', 
                                 data=json.dumps(request_data),
                                 content_type='application/json')
        
        # Check the response
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 404)
        self.assertIn('error', data)
        
    def test_data_sources_route(self):
        """Test the /data-sources route"""
        # Make request to the API
        response = self.app.get('/data-sources')
        
        # Check the response
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertIn('sources', data)
        self.assertIn('finnhub', data['sources'])


if __name__ == '__main__':
    unittest.main() 