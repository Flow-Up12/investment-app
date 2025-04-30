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

# Import the portfolio functions
from src.portfolio.manager import (
    create_portfolio,
    get_portfolio,
    add_transaction,
    get_transactions,
    calculate_portfolio_value,
    calculate_portfolio_performance,
    calculate_portfolio_allocation,
    get_portfolio_summary
)

class TestPortfolioManagement(unittest.TestCase):
    
    def setUp(self):
        """Set up test data"""
        self.user_id = "user123"
        self.portfolio_id = "portfolio456"
        
        # Sample portfolio data
        self.sample_portfolio = {
            "id": self.portfolio_id,
            "name": "Growth Portfolio",
            "description": "High-risk growth-oriented portfolio",
            "created_at": "2023-01-01T00:00:00Z",
            "user_id": self.user_id,
            "cash_balance": 10000.0
        }
        
        # Sample transactions
        self.sample_transactions = [
            {
                "id": "trans1",
                "portfolio_id": self.portfolio_id,
                "type": "BUY",
                "symbol": "AAPL",
                "quantity": 10,
                "price": 150.0,
                "fee": 5.0,
                "timestamp": "2023-01-15T10:30:00Z"
            },
            {
                "id": "trans2",
                "portfolio_id": self.portfolio_id,
                "type": "BUY",
                "symbol": "MSFT",
                "quantity": 5,
                "price": 250.0,
                "fee": 5.0,
                "timestamp": "2023-02-10T11:45:00Z"
            },
            {
                "id": "trans3",
                "portfolio_id": self.portfolio_id,
                "type": "SELL",
                "symbol": "AAPL",
                "quantity": 3,
                "price": 170.0,
                "fee": 5.0,
                "timestamp": "2023-03-05T09:15:00Z"
            }
        ]
        
        # Sample portfolio value data
        self.sample_current_prices = {
            "AAPL": 175.0,
            "MSFT": 280.0
        }
        
        # Sample portfolio performance data
        dates = pd.date_range(start="2023-01-01", end="2023-12-31", freq="D")
        self.sample_performance_data = pd.DataFrame({
            "date": dates,
            "value": np.cumsum(np.random.normal(50, 100, len(dates))) + 10000
        })
        self.sample_performance_data["return"] = self.sample_performance_data["value"].pct_change()
        
        # Sample allocation data
        self.sample_allocation = [
            {"symbol": "AAPL", "value": 1225.0, "percentage": 21.3},
            {"symbol": "MSFT", "value": 1400.0, "percentage": 24.4},
            {"symbol": "CASH", "value": 3105.0, "percentage": 54.3}
        ]
    
    @patch('src.portfolio.manager.db')
    def test_create_portfolio(self, mock_db):
        """Test creating a new portfolio"""
        # Mock database response
        mock_db.portfolios.insert_one.return_value = MagicMock(inserted_id=self.portfolio_id)
        
        # Test portfolio creation
        result = create_portfolio(
            user_id=self.user_id,
            name="Growth Portfolio",
            description="High-risk growth-oriented portfolio",
            initial_balance=10000.0
        )
        
        # Assertions
        self.assertTrue(result["success"])
        self.assertEqual(result["portfolio_id"], self.portfolio_id)
        
        # Verify db call arguments
        args, _ = mock_db.portfolios.insert_one.call_args
        self.assertEqual(args[0]["user_id"], self.user_id)
        self.assertEqual(args[0]["name"], "Growth Portfolio")
        self.assertEqual(args[0]["cash_balance"], 10000.0)
        
        # Test failure case
        mock_db.portfolios.insert_one.side_effect = Exception("Database error")
        
        result = create_portfolio(
            user_id=self.user_id,
            name="Growth Portfolio",
            description="High-risk growth-oriented portfolio",
            initial_balance=10000.0
        )
        
        # Assertions
        self.assertFalse(result["success"])
        self.assertEqual(result["message"], "Failed to create portfolio")
    
    @patch('src.portfolio.manager.db')
    def test_get_portfolio(self, mock_db):
        """Test retrieving a portfolio"""
        # Mock database response
        mock_db.portfolios.find_one.return_value = self.sample_portfolio
        
        # Test portfolio retrieval
        result = get_portfolio(self.portfolio_id)
        
        # Assertions
        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["id"], self.portfolio_id)
        self.assertEqual(result["data"]["name"], "Growth Portfolio")
        self.assertEqual(result["data"]["user_id"], self.user_id)
        
        # Test portfolio not found
        mock_db.portfolios.find_one.return_value = None
        
        result = get_portfolio("nonexistent_id")
        
        # Assertions
        self.assertFalse(result["success"])
        self.assertEqual(result["message"], "Portfolio not found")
        
        # Test database error
        mock_db.portfolios.find_one.side_effect = Exception("Database error")
        
        result = get_portfolio(self.portfolio_id)
        
        # Assertions
        self.assertFalse(result["success"])
        self.assertEqual(result["message"], "Failed to retrieve portfolio")
    
    @patch('src.portfolio.manager.db')
    def test_add_transaction(self, mock_db):
        """Test adding a transaction to a portfolio"""
        # Mock database responses
        mock_db.portfolios.find_one.return_value = self.sample_portfolio
        mock_db.transactions.insert_one.return_value = MagicMock(inserted_id="trans4")
        mock_db.portfolios.update_one.return_value = MagicMock(modified_count=1)
        
        # Test adding a buy transaction
        result = add_transaction(
            portfolio_id=self.portfolio_id,
            transaction_type="BUY",
            symbol="GOOGL",
            quantity=2,
            price=1500.0,
            fee=5.0
        )
        
        # Assertions
        self.assertTrue(result["success"])
        self.assertEqual(result["transaction_id"], "trans4")
        
        # Verify cash balance update
        args, _ = mock_db.portfolios.update_one.call_args
        self.assertEqual(args[0]["_id"], self.portfolio_id)
        self.assertEqual(args[1]["$set"]["cash_balance"], 10000.0 - (2 * 1500.0 + 5.0))
        
        # Test adding a sell transaction
        mock_db.transactions.find.return_value = [
            {"symbol": "AAPL", "type": "BUY", "quantity": 10, "price": 150.0},
            {"symbol": "AAPL", "type": "SELL", "quantity": 3, "price": 170.0}
        ]
        
        result = add_transaction(
            portfolio_id=self.portfolio_id,
            transaction_type="SELL",
            symbol="AAPL",
            quantity=2,
            price=180.0,
            fee=5.0
        )
        
        # Assertions
        self.assertTrue(result["success"])
        
        # Test insufficient funds
        mock_db.portfolios.find_one.return_value = {"cash_balance": 100.0}
        
        result = add_transaction(
            portfolio_id=self.portfolio_id,
            transaction_type="BUY",
            symbol="GOOGL",
            quantity=2,
            price=1500.0,
            fee=5.0
        )
        
        # Assertions
        self.assertFalse(result["success"])
        self.assertEqual(result["message"], "Insufficient funds")
        
        # Test insufficient shares
        mock_db.transactions.find.return_value = [
            {"symbol": "MSFT", "type": "BUY", "quantity": 2, "price": 250.0}
        ]
        
        result = add_transaction(
            portfolio_id=self.portfolio_id,
            transaction_type="SELL",
            symbol="MSFT",
            quantity=5,
            price=280.0,
            fee=5.0
        )
        
        # Assertions
        self.assertFalse(result["success"])
        self.assertEqual(result["message"], "Insufficient shares")
    
    @patch('src.portfolio.manager.db')
    def test_get_transactions(self, mock_db):
        """Test retrieving transactions for a portfolio"""
        # Mock database response
        mock_db.transactions.find.return_value = self.sample_transactions
        
        # Test transaction retrieval
        result = get_transactions(self.portfolio_id)
        
        # Assertions
        self.assertTrue(result["success"])
        self.assertEqual(len(result["transactions"]), 3)
        self.assertEqual(result["transactions"][0]["symbol"], "AAPL")
        self.assertEqual(result["transactions"][1]["symbol"], "MSFT")
        
        # Test retrieval by symbol
        result = get_transactions(self.portfolio_id, symbol="AAPL")
        
        # Assertions
        self.assertTrue(result["success"])
        self.assertEqual(len(result["transactions"]), 2)
        self.assertEqual(result["transactions"][0]["symbol"], "AAPL")
        
        # Test database error
        mock_db.transactions.find.side_effect = Exception("Database error")
        
        result = get_transactions(self.portfolio_id)
        
        # Assertions
        self.assertFalse(result["success"])
        self.assertEqual(result["message"], "Failed to retrieve transactions")
    
    @patch('src.portfolio.manager.get_current_prices')
    @patch('src.portfolio.manager.get_transactions')
    @patch('src.portfolio.manager.get_portfolio')
    def test_calculate_portfolio_value(self, mock_get_portfolio, mock_get_transactions, mock_get_prices):
        """Test calculating the current value of a portfolio"""
        # Mock function responses
        mock_get_portfolio.return_value = {"success": True, "data": self.sample_portfolio}
        mock_get_transactions.return_value = {"success": True, "transactions": self.sample_transactions}
        mock_get_prices.return_value = {"success": True, "prices": self.sample_current_prices}
        
        # Test portfolio value calculation
        result = calculate_portfolio_value(self.portfolio_id)
        
        # Assertions
        self.assertTrue(result["success"])
        self.assertEqual(result["cash_balance"], 10000.0)
        self.assertIn("total_value", result)
        self.assertIn("holdings", result)
        
        # Verify holdings calculation
        holdings = result["holdings"]
        self.assertEqual(len(holdings), 2)
        aapl_holding = next((h for h in holdings if h["symbol"] == "AAPL"), None)
        msft_holding = next((h for h in holdings if h["symbol"] == "MSFT"), None)
        
        self.assertEqual(aapl_holding["quantity"], 7)
        self.assertEqual(msft_holding["quantity"], 5)
        self.assertEqual(aapl_holding["current_value"], 7 * 175.0)
        self.assertEqual(msft_holding["current_value"], 5 * 280.0)
        
        # Test failure in getting portfolio
        mock_get_portfolio.return_value = {"success": False, "message": "Portfolio not found"}
        
        result = calculate_portfolio_value(self.portfolio_id)
        
        # Assertions
        self.assertFalse(result["success"])
        self.assertEqual(result["message"], "Portfolio not found")
    
    @patch('src.portfolio.manager.generate_performance_data')
    @patch('src.portfolio.manager.get_portfolio')
    def test_calculate_portfolio_performance(self, mock_get_portfolio, mock_generate_data):
        """Test calculating historical performance of a portfolio"""
        # Mock function responses
        mock_get_portfolio.return_value = {"success": True, "data": self.sample_portfolio}
        mock_generate_data.return_value = self.sample_performance_data
        
        # Test performance calculation
        result = calculate_portfolio_performance(
            self.portfolio_id,
            start_date="2023-01-01",
            end_date="2023-12-31"
        )
        
        # Assertions
        self.assertTrue(result["success"])
        self.assertIn("performance_data", result)
        self.assertEqual(len(result["performance_data"]), len(self.sample_performance_data))
        self.assertIn("overall_return", result)
        self.assertIn("annualized_return", result)
        self.assertIn("max_drawdown", result)
        
        # Test invalid date range
        result = calculate_portfolio_performance(
            self.portfolio_id,
            start_date="2023-12-31",
            end_date="2023-01-01"
        )
        
        # Assertions
        self.assertFalse(result["success"])
        self.assertEqual(result["message"], "Invalid date range")
        
        # Test failure in getting portfolio
        mock_get_portfolio.return_value = {"success": False, "message": "Portfolio not found"}
        
        result = calculate_portfolio_performance(
            self.portfolio_id,
            start_date="2023-01-01",
            end_date="2023-12-31"
        )
        
        # Assertions
        self.assertFalse(result["success"])
        self.assertEqual(result["message"], "Portfolio not found")
    
    @patch('src.portfolio.manager.calculate_portfolio_value')
    def test_calculate_portfolio_allocation(self, mock_calculate_value):
        """Test calculating the asset allocation of a portfolio"""
        # Mock function response
        mock_calculate_value.return_value = {
            "success": True,
            "total_value": 5730.0,
            "cash_balance": 3105.0,
            "holdings": [
                {"symbol": "AAPL", "current_value": 1225.0},
                {"symbol": "MSFT", "current_value": 1400.0}
            ]
        }
        
        # Test allocation calculation
        result = calculate_portfolio_allocation(self.portfolio_id)
        
        # Assertions
        self.assertTrue(result["success"])
        self.assertEqual(len(result["allocation"]), 3)
        
        # Verify allocation percentages
        cash_allocation = next((a for a in result["allocation"] if a["symbol"] == "CASH"), None)
        aapl_allocation = next((a for a in result["allocation"] if a["symbol"] == "AAPL"), None)
        msft_allocation = next((a for a in result["allocation"] if a["symbol"] == "MSFT"), None)
        
        self.assertAlmostEqual(cash_allocation["percentage"], 54.19, places=2)
        self.assertAlmostEqual(aapl_allocation["percentage"], 21.38, places=2)
        self.assertAlmostEqual(msft_allocation["percentage"], 24.43, places=2)
        
        # Test failure in calculating value
        mock_calculate_value.return_value = {"success": False, "message": "Portfolio not found"}
        
        result = calculate_portfolio_allocation(self.portfolio_id)
        
        # Assertions
        self.assertFalse(result["success"])
        self.assertEqual(result["message"], "Portfolio not found")
    
    @patch('src.portfolio.manager.calculate_portfolio_allocation')
    @patch('src.portfolio.manager.calculate_portfolio_performance')
    @patch('src.portfolio.manager.calculate_portfolio_value')
    @patch('src.portfolio.manager.get_portfolio')
    def test_get_portfolio_summary(self, mock_get_portfolio, mock_calculate_value, 
                                  mock_calculate_performance, mock_calculate_allocation):
        """Test generating a comprehensive portfolio summary"""
        # Mock function responses
        mock_get_portfolio.return_value = {"success": True, "data": self.sample_portfolio}
        
        mock_calculate_value.return_value = {
            "success": True,
            "total_value": 5730.0,
            "cash_balance": 3105.0,
            "holdings": [
                {"symbol": "AAPL", "quantity": 7, "current_price": 175.0, "current_value": 1225.0, "avg_cost": 150.0},
                {"symbol": "MSFT", "quantity": 5, "current_price": 280.0, "current_value": 1400.0, "avg_cost": 250.0}
            ]
        }
        
        mock_calculate_performance.return_value = {
            "success": True,
            "overall_return": 15.3,
            "annualized_return": 12.4,
            "max_drawdown": -8.7,
            "sharpe_ratio": 1.2,
            "volatility": 14.5
        }
        
        mock_calculate_allocation.return_value = {
            "success": True,
            "allocation": self.sample_allocation
        }
        
        # Test summary generation
        result = get_portfolio_summary(self.portfolio_id)
        
        # Assertions
        self.assertTrue(result["success"])
        self.assertEqual(result["portfolio"]["id"], self.portfolio_id)
        self.assertEqual(result["portfolio"]["name"], "Growth Portfolio")
        self.assertEqual(result["value"]["total_value"], 5730.0)
        self.assertEqual(len(result["value"]["holdings"]), 2)
        self.assertEqual(result["performance"]["overall_return"], 15.3)
        self.assertEqual(len(result["allocation"]), 3)
        
        # Test failure in getting portfolio
        mock_get_portfolio.return_value = {"success": False, "message": "Portfolio not found"}
        
        result = get_portfolio_summary(self.portfolio_id)
        
        # Assertions
        self.assertFalse(result["success"])
        self.assertEqual(result["message"], "Portfolio not found")


if __name__ == '__main__':
    unittest.main() 