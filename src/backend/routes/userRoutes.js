const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

// Get user profile
router.get('/profile', userController.getProfile);

// Create a new user
router.post('/register', userController.createUser);

// Update user settings
router.put('/settings', userController.updateSettings);

// Add funds to user balance
router.post('/funds', userController.addFunds);

// Get transaction history
router.get('/transactions', userController.getTransactions);

// Get portfolio summary
router.get('/portfolio-summary', userController.getPortfolioSummary);

module.exports = router; 