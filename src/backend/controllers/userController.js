const userService = require('../services/userService');

/**
 * Get user profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const user = await userService.getUserById(userId);
    
    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      balance: parseFloat(user.balance),
      investment_limit: parseFloat(user.investment_limit),
      daily_limit: parseFloat(user.daily_limit)
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

/**
 * Create a new user
 */
const createUser = async (req, res) => {
  try {
    const { username, email } = req.body;
    
    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }
    
    const userData = {
      username,
      email,
      balance: 50.00, // Starting with $50 as specified
      investment_limit: 50.00,
      daily_limit: 10.00
    };
    
    const user = await userService.createUser(userData);
    
    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      balance: parseFloat(user.balance)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Update user settings
 */
const updateSettings = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const { investment_limit, daily_limit } = req.body;
    
    const updateData = {};
    if (investment_limit) updateData.investment_limit = investment_limit;
    if (daily_limit) updateData.daily_limit = daily_limit;
    
    const user = await userService.updateUser(userId, updateData);
    
    res.status(200).json({
      id: user.id,
      username: user.username,
      investment_limit: parseFloat(user.investment_limit),
      daily_limit: parseFloat(user.daily_limit)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Add funds to user balance
 */
const addFunds = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const { amount } = req.body;
    
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    
    const user = await userService.addFunds(userId, parseFloat(amount));
    
    res.status(200).json({
      id: user.id,
      balance: parseFloat(user.balance),
      message: `$${amount} added to your balance`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Get transaction history
 */
const getTransactions = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const transactions = await userService.getTransactionHistory(userId);
    
    res.status(200).json(transactions.map(t => ({
      id: t.id,
      symbol: t.symbol,
      type: t.type,
      shares: parseFloat(t.shares),
      price: parseFloat(t.price),
      total_amount: parseFloat(t.total_amount),
      date: t.createdAt
    })));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Get portfolio summary
 */
const getPortfolioSummary = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const summary = await userService.getPortfolioSummary(userId);
    
    res.status(200).json(summary);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getProfile,
  createUser,
  updateSettings,
  addFunds,
  getTransactions,
  getPortfolioSummary
}; 