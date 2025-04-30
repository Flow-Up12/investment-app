import unittest
import sys
import os
import json
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

# Add the parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the authentication functions
from src.auth.user import (
    register_user,
    login_user,
    validate_token,
    refresh_token,
    change_password,
    reset_password_request,
    get_user_profile
)

class TestUserAuthentication(unittest.TestCase):
    
    def setUp(self):
        """Set up test data"""
        self.test_user = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'SecurePassword123!',
            'first_name': 'Test',
            'last_name': 'User'
        }
        
        self.sample_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0dXNlciIsImV4cCI6MTcxMDAwMDAwMH0.signature'
        
    @patch('src.auth.user.db')
    def test_register_user(self, mock_db):
        """Test user registration"""
        # Mock database response
        mock_db.users.find_one.return_value = None  # User doesn't exist
        mock_db.users.insert_one.return_value = MagicMock(inserted_id='123456789')
        
        # Test registration
        result = register_user(
            self.test_user['username'],
            self.test_user['email'],
            self.test_user['password'],
            self.test_user['first_name'],
            self.test_user['last_name']
        )
        
        # Assertions
        self.assertTrue(result['success'])
        self.assertEqual(result['message'], 'User registered successfully')
        self.assertTrue(mock_db.users.insert_one.called)
        
        # Test username already exists
        mock_db.users.find_one.return_value = {'username': self.test_user['username']}
        result = register_user(
            self.test_user['username'],
            self.test_user['email'],
            self.test_user['password'],
            self.test_user['first_name'],
            self.test_user['last_name']
        )
        
        # Assertions
        self.assertFalse(result['success'])
        self.assertEqual(result['message'], 'Username already exists')
        
    @patch('src.auth.user.db')
    @patch('src.auth.user.bcrypt')
    @patch('src.auth.user.create_token')
    def test_login_user(self, mock_create_token, mock_bcrypt, mock_db):
        """Test user login"""
        # Mock database response
        mock_db.users.find_one.return_value = {
            'username': self.test_user['username'],
            'password_hash': 'hashed_password',
            'email': self.test_user['email']
        }
        
        # Mock password verification
        mock_bcrypt.checkpw.return_value = True
        
        # Mock token creation
        mock_create_token.return_value = self.sample_token
        
        # Test login
        result = login_user(self.test_user['username'], self.test_user['password'])
        
        # Assertions
        self.assertTrue(result['success'])
        self.assertEqual(result['token'], self.sample_token)
        self.assertEqual(result['username'], self.test_user['username'])
        
        # Test invalid password
        mock_bcrypt.checkpw.return_value = False
        result = login_user(self.test_user['username'], 'WrongPassword')
        
        # Assertions
        self.assertFalse(result['success'])
        self.assertEqual(result['message'], 'Invalid username or password')
        
    @patch('src.auth.user.jwt')
    def test_validate_token(self, mock_jwt):
        """Test token validation"""
        # Mock token validation success
        mock_jwt.decode.return_value = {
            'sub': self.test_user['username'],
            'exp': (datetime.now() + timedelta(hours=1)).timestamp()
        }
        
        # Test valid token
        result = validate_token(self.sample_token)
        
        # Assertions
        self.assertTrue(result['valid'])
        self.assertEqual(result['username'], self.test_user['username'])
        
        # Mock token validation failure (expired)
        mock_jwt.decode.side_effect = Exception('Token expired')
        
        # Test expired token
        result = validate_token(self.sample_token)
        
        # Assertions
        self.assertFalse(result['valid'])
        self.assertEqual(result['message'], 'Invalid token')
        
    @patch('src.auth.user.jwt')
    @patch('src.auth.user.create_token')
    def test_refresh_token(self, mock_create_token, mock_jwt):
        """Test token refresh"""
        # Mock token validation
        mock_jwt.decode.return_value = {
            'sub': self.test_user['username'],
            'exp': (datetime.now() + timedelta(hours=1)).timestamp()
        }
        
        # Mock new token creation
        new_token = 'new.jwt.token'
        mock_create_token.return_value = new_token
        
        # Test token refresh
        result = refresh_token(self.sample_token)
        
        # Assertions
        self.assertTrue(result['success'])
        self.assertEqual(result['token'], new_token)
        
        # Mock token validation failure
        mock_jwt.decode.side_effect = Exception('Invalid token')
        
        # Test invalid token refresh
        result = refresh_token(self.sample_token)
        
        # Assertions
        self.assertFalse(result['success'])
        self.assertEqual(result['message'], 'Invalid token')
        
    @patch('src.auth.user.db')
    @patch('src.auth.user.bcrypt')
    def test_change_password(self, mock_bcrypt, mock_db):
        """Test password change"""
        # Mock database query
        mock_db.users.find_one.return_value = {
            'username': self.test_user['username'],
            'password_hash': 'old_hashed_password'
        }
        
        # Mock password verification
        mock_bcrypt.checkpw.return_value = True
        
        # Mock password hashing
        mock_bcrypt.hashpw.return_value = 'new_hashed_password'
        
        # Test password change
        result = change_password(
            self.test_user['username'],
            'CurrentPassword',
            'NewSecurePassword123!'
        )
        
        # Assertions
        self.assertTrue(result['success'])
        self.assertEqual(result['message'], 'Password changed successfully')
        mock_db.users.update_one.assert_called_once()
        
    @patch('src.auth.user.db')
    @patch('src.auth.user.send_password_reset_email')
    def test_reset_password_request(self, mock_send_email, mock_db):
        """Test password reset request"""
        # Mock database query
        mock_db.users.find_one.return_value = {
            'username': self.test_user['username'],
            'email': self.test_user['email']
        }
        
        # Test reset request
        result = reset_password_request(self.test_user['email'])
        
        # Assertions
        self.assertTrue(result['success'])
        self.assertEqual(result['message'], 'Password reset email sent')
        mock_send_email.assert_called_once()
        
        # Test non-existent email
        mock_db.users.find_one.return_value = None
        result = reset_password_request('nonexistent@example.com')
        
        # Assertions
        self.assertFalse(result['success'])
        self.assertEqual(result['message'], 'Email not found')
        
    @patch('src.auth.user.db')
    def test_get_user_profile(self, mock_db):
        """Test retrieving user profile"""
        # Mock database query
        mock_user = {
            'username': self.test_user['username'],
            'email': self.test_user['email'],
            'first_name': self.test_user['first_name'],
            'last_name': self.test_user['last_name'],
            'join_date': '2023-01-01',
            'profile_picture': 'profile.jpg',
            'password_hash': 'hashed_password'  # Should not be returned
        }
        mock_db.users.find_one.return_value = mock_user
        
        # Test profile retrieval
        result = get_user_profile(self.test_user['username'])
        
        # Assertions
        self.assertTrue(result['success'])
        self.assertEqual(result['profile']['username'], self.test_user['username'])
        self.assertEqual(result['profile']['email'], self.test_user['email'])
        self.assertNotIn('password_hash', result['profile'])


if __name__ == '__main__':
    unittest.main() 