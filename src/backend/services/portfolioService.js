const { User, Portfolio, Transaction } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

/**
 * Get user portfolio
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - User portfolio
 */
const getUserPortfolio = async (userId) => {
  try {
    const portfolio = await Portfolio.findAll({
      where: { userId },
      order: [['symbol', 'ASC']]
    });
    return portfolio;
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    throw new Error('Failed to fetch portfolio');
  }
};

/**
 * Buy stocks
 * @param {number} userId - User ID
 * @param {string} symbol - Stock symbol
 * @param {number} shares - Number of shares to buy
 * @param {number} price - Current price per share
 * @returns {Promise<Object>} - Transaction details
 */
const buyStock = async (userId, symbol, shares, price) => {
  const t = await sequelize.transaction();

  try {
    // Calculate total amount
    const totalAmount = shares * price;

    // Get user
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has sufficient balance
    if (user.balance < totalAmount) {
      throw new Error('Insufficient balance');
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayTransactions = await Transaction.sum('total_amount', {
      where: {
        userId,
        type: 'BUY',
        createdAt: {
          [Op.gte]: today
        }
      },
      transaction: t
    }) || 0;
    
    if (todayTransactions + totalAmount > user.daily_limit) {
      throw new Error(`Daily investment limit of $${user.daily_limit} exceeded`);
    }

    // Check investment limit
    if (totalAmount > user.investment_limit) {
      throw new Error(`Investment limit of $${user.investment_limit} per stock exceeded`);
    }

    // Update user balance
    await user.update({
      balance: sequelize.literal(`balance - ${totalAmount}`)
    }, { transaction: t });

    // Find existing portfolio entry or create new one
    let portfolio = await Portfolio.findOne({
      where: { userId, symbol },
      transaction: t
    });

    if (portfolio) {
      // Update existing portfolio
      const newShares = parseFloat(portfolio.shares) + parseFloat(shares);
      const newTotalInvestment = parseFloat(portfolio.total_investment) + totalAmount;
      const newAveragePrice = newTotalInvestment / newShares;

      await portfolio.update({
        shares: newShares,
        average_price: newAveragePrice,
        total_investment: newTotalInvestment
      }, { transaction: t });
    } else {
      // Create new portfolio entry
      portfolio = await Portfolio.create({
        userId,
        symbol,
        shares,
        average_price: price,
        total_investment: totalAmount
      }, { transaction: t });
    }

    // Create transaction record
    const transaction = await Transaction.create({
      userId,
      symbol,
      type: 'BUY',
      shares,
      price,
      total_amount: totalAmount
    }, { transaction: t });

    await t.commit();
    return transaction;
  } catch (error) {
    await t.rollback();
    console.error('Error buying stock:', error);
    throw error;
  }
};

/**
 * Sell stocks
 * @param {number} userId - User ID
 * @param {string} symbol - Stock symbol
 * @param {number} shares - Number of shares to sell
 * @param {number} price - Current price per share
 * @returns {Promise<Object>} - Transaction details
 */
const sellStock = async (userId, symbol, shares, price) => {
  const t = await sequelize.transaction();

  try {
    // Calculate total amount
    const totalAmount = shares * price;

    // Find portfolio entry
    const portfolio = await Portfolio.findOne({
      where: { userId, symbol },
      transaction: t
    });

    if (!portfolio) {
      throw new Error(`You don't own any shares of ${symbol}`);
    }

    if (parseFloat(portfolio.shares) < parseFloat(shares)) {
      throw new Error(`You only have ${portfolio.shares} shares to sell`);
    }

    // Update portfolio
    const newShares = parseFloat(portfolio.shares) - parseFloat(shares);
    const soldValue = parseFloat(shares) * parseFloat(portfolio.average_price);
    const newTotalInvestment = parseFloat(portfolio.total_investment) - soldValue;

    if (newShares > 0) {
      await portfolio.update({
        shares: newShares,
        total_investment: newTotalInvestment
      }, { transaction: t });
    } else {
      // If no shares left, remove portfolio entry
      await portfolio.destroy({ transaction: t });
    }

    // Update user balance with the current market value
    const user = await User.findByPk(userId, { transaction: t });
    await user.update({
      balance: sequelize.literal(`balance + ${totalAmount}`)
    }, { transaction: t });

    // Create transaction record
    const transaction = await Transaction.create({
      userId,
      symbol,
      type: 'SELL',
      shares,
      price,
      total_amount: totalAmount
    }, { transaction: t });

    await t.commit();
    return transaction;
  } catch (error) {
    await t.rollback();
    console.error('Error selling stock:', error);
    throw error;
  }
};

module.exports = {
  getUserPortfolio,
  buyStock,
  sellStock
}; 