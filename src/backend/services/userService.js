const { User, Transaction, Portfolio } = require('../models');
const { sequelize } = require('../config/database');

/**
 * Get user by ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - User object
 */
const getUserById = async (userId) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
};

/**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Promise<Object>} - Created user
 */
const createUser = async (userData) => {
  try {
    const user = await User.create(userData);
    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Update user settings
 * @param {number} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} - Updated user
 */
const updateUser = async (userId, updateData) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    await user.update(updateData);
    return user;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Add funds to user balance
 * @param {number} userId - User ID
 * @param {number} amount - Amount to add
 * @returns {Promise<Object>} - Updated user
 */
const addFunds = async (userId, amount) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    await user.update({
      balance: sequelize.literal(`balance + ${amount}`)
    });
    
    return user;
  } catch (error) {
    console.error('Error adding funds:', error);
    throw error;
  }
};

/**
 * Get user transaction history
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - Transaction history
 */
const getTransactionHistory = async (userId) => {
  try {
    const transactions = await Transaction.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });
    
    return transactions;
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    throw error;
  }
};

/**
 * Get user portfolio value
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Portfolio summary
 */
const getPortfolioSummary = async (userId) => {
  try {
    const portfolioItems = await Portfolio.findAll({
      where: { userId }
    });
    
    let totalInvestment = 0;
    
    portfolioItems.forEach(item => {
      totalInvestment += parseFloat(item.total_investment);
    });
    
    const user = await User.findByPk(userId);
    
    return {
      totalInvestment,
      cash: parseFloat(user.balance),
      totalValue: totalInvestment + parseFloat(user.balance)
    };
  } catch (error) {
    console.error('Error calculating portfolio value:', error);
    throw error;
  }
};

module.exports = {
  getUserById,
  createUser,
  updateUser,
  addFunds,
  getTransactionHistory,
  getPortfolioSummary
}; 