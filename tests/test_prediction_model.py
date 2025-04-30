import unittest
import sys
import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# Add the parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the model
from src.prediction.model import create_model, preprocess_data, train_model, make_predictions

class TestPredictionModel(unittest.TestCase):
    
    def setUp(self):
        """Set up test data"""
        # Create sample historical data
        dates = [datetime.now() - timedelta(days=i) for i in range(100)]
        prices = [100 + i * 0.5 + (np.random.random() - 0.5) * 10 for i in range(100)]
        
        self.test_df = pd.DataFrame({
            'Date': dates,
            'Close': prices
        })
        self.test_df = self.test_df.sort_values('Date')
        
    def test_preprocess_data(self):
        """Test data preprocessing"""
        X, y, scaler = preprocess_data(self.test_df, 'Close', 5)
        
        # Check shapes
        self.assertEqual(X.shape[0], len(self.test_df) - 5)
        self.assertEqual(X.shape[1], 5)
        self.assertEqual(y.shape[0], len(self.test_df) - 5)
        
        # Check if data is scaled
        self.assertTrue(np.all(X <= 1.0))
        self.assertTrue(np.all(X >= 0.0))
        
    def test_train_model(self):
        """Test model training"""
        X, y, scaler = preprocess_data(self.test_df, 'Close', 5)
        model = train_model(X, y)
        
        # Check if model exists
        self.assertIsNotNone(model)
        
        # Check model predictions
        predictions = model.predict(X[:5])
        self.assertEqual(len(predictions), 5)
        
    def test_make_predictions(self):
        """Test making predictions"""
        prediction_days = 7
        X, y, scaler = preprocess_data(self.test_df, 'Close', 5)
        model = train_model(X, y)
        
        predictions = make_predictions(model, self.test_df, 'Close', 5, prediction_days, scaler)
        
        # Check prediction length
        self.assertEqual(len(predictions), prediction_days)
        
        # Check prediction values are reasonable (not NaN or infinity)
        self.assertTrue(np.all(np.isfinite(predictions)))
        
    def test_create_model(self):
        """Test create model function"""
        model = create_model(self.test_df, 'Close', 5, 7)
        
        # Check if model returns predictions and historical data
        self.assertIsNotNone(model['predicted_values'])
        self.assertIsNotNone(model['historical_data'])
        self.assertIsNotNone(model['prediction_dates'])
        
        # Check lengths
        self.assertEqual(len(model['predicted_values']), 7)
        self.assertEqual(len(model['historical_data']), len(self.test_df))
        self.assertEqual(len(model['prediction_dates']), 7)
        
    @patch('src.prediction.model.train_model')
    def test_model_error_handling(self, mock_train_model):
        """Test error handling in model creation"""
        # Force an error in training
        mock_train_model.side_effect = Exception("Model training error")
        
        with self.assertRaises(Exception):
            create_model(self.test_df, 'Close', 5, 7)
            
    def test_invalid_input_data(self):
        """Test model behavior with invalid input data"""
        # Empty DataFrame
        empty_df = pd.DataFrame()
        with self.assertRaises(Exception):
            create_model(empty_df, 'Close', 5, 7)
            
        # DataFrame without required column
        invalid_df = pd.DataFrame({'Date': self.test_df['Date']})
        with self.assertRaises(Exception):
            create_model(invalid_df, 'Close', 5, 7)
            
        # Too small DataFrame (less than lookback window)
        small_df = self.test_df.iloc[:3]
        with self.assertRaises(Exception):
            create_model(small_df, 'Close', 5, 7)


if __name__ == '__main__':
    unittest.main() 