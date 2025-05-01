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
 * @param {boolean} isBotTransaction - Indicates if the transaction is a bot transaction
 * @param {number} botActionId - Optional ID of bot action that triggered this transaction
 * @returns {Promise<Object>} - Transaction details
 */
const buyStock = async (userId, symbol, shares, price, isBotTransaction = false, botActionId = null) => {
  const t = await sequelize.transaction();
  
  try {
    // Validate inputs
    if (!symbol || !shares || !price) {
      throw new Error('Symbol, shares, and price are required');
    }
    
    if (isNaN(shares) || shares <= 0) {
      throw new Error('Shares must be a positive number');
    }
    
    if (isNaN(price) || price <= 0) {
      throw new Error('Price must be a positive number');
    }
    
    // Round shares to 4 decimal places for precision
    shares = parseFloat(shares.toFixed(4));
    
    // Calculate total amount
    const totalAmount = parseFloat((shares * price).toFixed(2));
    
    console.log(`Buy operation: ${shares} shares of ${symbol} at $${price} = $${totalAmount}, bot transaction: ${isBotTransaction}`);
    
    // If it's a bot transaction, don't check user balance
    if (!isBotTransaction) {
      // Check if user has enough funds
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (parseFloat(user.balance) < totalAmount) {
        throw new Error('Insufficient funds');
      }
      
      // Update user balance
      await user.update({
        balance: sequelize.literal(`balance - ${totalAmount}`)
      }, { transaction: t });
    }
    
    // Find existing portfolio entry or create new one
    let portfolio = await Portfolio.findOne({
      where: { userId, symbol },
      transaction: t
    });
    
    if (portfolio) {
      // Update existing portfolio with new shares and average price
      const newShares = parseFloat(portfolio.shares) + shares;
      const newTotalInvestment = parseFloat(portfolio.total_investment) + totalAmount;
      const newAveragePrice = parseFloat((newTotalInvestment / newShares).toFixed(2));
      
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
      total_amount: totalAmount,
      is_bot: isBotTransaction,
      botActionId
    }, { transaction: t });
    
    await t.commit();
    
    console.log(`Transaction recorded successfully: ID=${transaction.id}, is_bot=${isBotTransaction ? 'YES' : 'NO'}`);
    
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
 * @param {boolean} isBotTransaction - Indicates if the transaction is a bot transaction
 * @param {number} botActionId - Optional ID of bot action that triggered this transaction
 * @param {number} profit - Profit from the transaction
 * @returns {Promise<Object>} - Transaction details
 */
const sellStock = async (userId, symbol, shares, price, isBotTransaction = false, botActionId = null, profit = 0) => {
  const t = await sequelize.transaction();
  
  try {
    // Validate inputs
    if (!symbol || !shares || !price) {
      throw new Error('Symbol, shares, and price are required');
    }
    
    if (isNaN(shares) || shares <= 0) {
      throw new Error('Shares must be a positive number');
    }
    
    if (isNaN(price) || price <= 0) {
      throw new Error('Price must be a positive number');
    }
    
    // Round shares to 4 decimal places for precision
    shares = parseFloat(shares.toFixed(4));
    
    // Calculate total amount
    const totalAmount = parseFloat((shares * price).toFixed(2));
    
    console.log(`Sell operation: ${shares} shares of ${symbol} at $${price} = $${totalAmount}, bot transaction: ${isBotTransaction}`);
    
    // Find portfolio entry
    const portfolio = await Portfolio.findOne({
      where: { userId, symbol },
      transaction: t
    });
    
    if (!portfolio) {
      throw new Error(`No shares of ${symbol} found in portfolio`);
    }
    
    if (parseFloat(portfolio.shares) < shares) {
      throw new Error(`Not enough shares to sell. You have ${portfolio.shares} but tried to sell ${shares}`);
    }
    
    // Calculate profit if not provided
    let profitAmount = profit;
    let profitPercentage = 0;
    
    if (!profit) {
      profitAmount = parseFloat(((price - parseFloat(portfolio.average_price)) * shares).toFixed(2));
      profitPercentage = parseFloat(((price - parseFloat(portfolio.average_price)) / parseFloat(portfolio.average_price) * 100).toFixed(2));
    } else {
      // Calculate profit percentage
      profitPercentage = parseFloat(((profit / (shares * parseFloat(portfolio.average_price))) * 100).toFixed(2)); 
    }
    
    // Calculate proportion of investment being sold to reduce total_investment accordingly
    const proportionSold = shares / parseFloat(portfolio.shares);
    const investmentReduction = parseFloat((parseFloat(portfolio.total_investment) * proportionSold).toFixed(2));
    
    // Update portfolio
    const newShares = parseFloat((parseFloat(portfolio.shares) - shares).toFixed(4));
    const newTotalInvestment = parseFloat((parseFloat(portfolio.total_investment) - investmentReduction).toFixed(2));
    
    if (newShares > 0.0001) { // Use small threshold to account for floating point errors
      await portfolio.update({
        shares: newShares,
        total_investment: newTotalInvestment
      }, { transaction: t });
    } else {
      // If no shares left, remove from portfolio
      await portfolio.destroy({ transaction: t });
    }
    
    // Update user balance (only if not a bot transaction)
    if (!isBotTransaction) {
      const user = await User.findByPk(userId, { transaction: t });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      await user.update({
        balance: sequelize.literal(`balance + ${totalAmount}`)
      }, { transaction: t });
    }
    
    // Create transaction record with profit information
    const transaction = await Transaction.create({
      userId,
      symbol,
      type: 'SELL',
      shares,
      price,
      total_amount: totalAmount,
      profit: profitAmount,
      profit_percentage: profitPercentage,
      is_bot: isBotTransaction,
      botActionId
    }, { transaction: t });
    
    await t.commit();
    
    console.log(`Transaction recorded successfully: ID=${transaction.id}, profit=$${profitAmount}, is_bot=${isBotTransaction ? 'YES' : 'NO'}`);
    
    return transaction;
  } catch (error) {
    await t.rollback();
    console.error('Error selling stock:', error);
    throw error;
  }
};

// Add or update the getPortfolioItem function
const getPortfolioItem = async (userId, symbol) => {
  try {
    const portfolio = await Portfolio.findOne({
      where: { userId, symbol }
    });
    
    if (!portfolio) {
      return null;
    }
    
    return {
      symbol: portfolio.symbol,
      shares: parseFloat(portfolio.shares),
      averagePurchasePrice: parseFloat(portfolio.average_price),
      totalInvestment: parseFloat(portfolio.total_investment)
    };
  } catch (error) {
    console.error('Error fetching portfolio item:', error);
    throw new Error(`Failed to fetch ${symbol} from portfolio`);
  }
};

module.exports = {
  getUserPortfolio,
  buyStock,
  sellStock,
  getPortfolioItem
}; 