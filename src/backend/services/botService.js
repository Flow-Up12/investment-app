const { BotConfig, BotWatchlist, BotAction, StockPrice, Portfolio, User, Transaction } = require('../models');
const { sequelize } = require('../config/database');
const stockService = require('./stockService');
const portfolioService = require('./portfolioService');
const { Op } = require('sequelize');

/**
 * Get bot configuration for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Bot configuration
 */
const getBotConfig = async (userId) => {
  try {
    let config = await BotConfig.findOne({ where: { userId } });
    
    // Create default config if none exists
    if (!config) {
      config = await BotConfig.create({ userId });
    }
    
    return config;
  } catch (error) {
    console.error('Error fetching bot config:', error);
    throw new Error('Failed to fetch bot configuration');
  }
};

/**
 * Update bot configuration
 * @param {number} userId - User ID
 * @param {Object} configData - Bot configuration data
 * @returns {Promise<Object>} - Updated configuration
 */
const updateBotConfig = async (userId, configData) => {
  try {
    let config = await BotConfig.findOne({ where: { userId } });
    
    if (!config) {
      config = await BotConfig.create({ userId, ...configData });
    } else {
      await config.update(configData);
    }
    
    return config;
  } catch (error) {
    console.error('Error updating bot config:', error);
    throw new Error('Failed to update bot configuration');
  }
};

/**
 * Get watchlist for a user's trading bot
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - Bot watchlist
 */
const getWatchlist = async (userId) => {
  try {
    const watchlist = await BotWatchlist.findAll({
      where: { userId },
      order: [['symbol', 'ASC']]
    });
    
    return watchlist;
  } catch (error) {
    console.error('Error fetching bot watchlist:', error);
    throw new Error('Failed to fetch bot watchlist');
  }
};

/**
 * Add symbol to the bot watchlist
 * @param {number} userId - User ID
 * @param {string} symbol - Stock symbol
 * @param {Object} options - Additional options like custom thresholds
 * @returns {Promise<Object>} - The created watchlist item
 */
const addToWatchlist = async (userId, symbol, options = {}) => {
  try {
    // Check if symbol exists in the stock service
    const symbolExists = await stockService.checkSymbolExists(symbol);
    if (!symbolExists) {
      throw new Error(`Symbol ${symbol} does not exist or is not supported`);
    }
    
    // Check if it's already in the watchlist
    const existing = await BotWatchlist.findOne({
      where: { userId, symbol }
    });
    
    if (existing) {
      // If it exists but was inactive, reactivate it
      if (!existing.isActive) {
        await existing.update({ 
          isActive: true,
          ...options
        });
        return existing;
      }
      throw new Error(`${symbol} is already in the watchlist`);
    }
    
    // Add to watchlist
    const watchlistItem = await BotWatchlist.create({
      userId,
      symbol,
      isActive: true,
      ...options
    });
    
    return watchlistItem;
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    throw error;
  }
};

/**
 * Remove symbol from the bot watchlist
 * @param {number} userId - User ID
 * @param {string} symbol - Stock symbol
 * @returns {Promise<boolean>} - Success status
 */
const removeFromWatchlist = async (userId, symbol) => {
  try {
    const watchlistItem = await BotWatchlist.findOne({
      where: { userId, symbol }
    });
    
    if (!watchlistItem) {
      throw new Error(`${symbol} is not in the watchlist`);
    }
    
    // Completely delete the entry instead of just setting it to inactive
    await watchlistItem.destroy();
    
    return true;
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    throw error;
  }
};

/**
 * Get bot actions history
 * @param {number} userId - User ID 
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} - Bot actions
 */
const getBotActions = async (userId, options = {}) => {
  try {
    const { symbol, action, limit = 100, offset = 0 } = options;
    
    const where = { userId };
    
    if (symbol) {
      where.symbol = symbol;
    }
    
    if (action && ['BUY', 'SELL', 'HOLD'].includes(action.toUpperCase())) {
      where.action = action.toUpperCase();
    }
    
    const actions = await BotAction.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
    
    return actions;
  } catch (error) {
    console.error('Error fetching bot actions:', error);
    throw new Error('Failed to fetch bot action history');
  }
};

/**
 * Record stock price in the historical database
 * @param {string} symbol - Stock symbol
 * @param {Object} priceData - Price data
 * @returns {Promise<Object>} - Created price record
 */
const recordStockPrice = async (symbol, priceData) => {
  try {
    const priceRecord = await StockPrice.create({
      symbol,
      price: priceData.price || priceData.c,
      open: priceData.open || priceData.o,
      high: priceData.high || priceData.h,
      low: priceData.low || priceData.l,
      volume: priceData.volume || null,
      timestamp: new Date()
    });
    
    return priceRecord;
  } catch (error) {
    console.error(`Error recording price for ${symbol}:`, error);
    throw new Error(`Failed to record price for ${symbol}`);
  }
};

/**
 * Allocate funds to the trading bot
 * @param {number} userId - User ID
 * @param {number} amount - Amount to allocate
 * @returns {Promise<Object>} - Updated bot config
 */
const allocateFunds = async (userId, amount) => {
  const t = await sequelize.transaction();
  
  try {
    // Get user
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check if user has sufficient balance
    if (parseFloat(user.balance) < parseFloat(amount)) {
      throw new Error('Insufficient balance');
    }
    
    // Get bot config
    let config = await BotConfig.findOne({ 
      where: { userId },
      transaction: t 
    });
    
    if (!config) {
      config = await BotConfig.create({ 
        userId,
        allocatedFunds: amount
      }, { transaction: t });
    } else {
      await config.update({ 
        allocatedFunds: sequelize.literal(`"allocatedFunds" + ${amount}`)
      }, { transaction: t });
    }
    
    // Update user balance
    await user.update({
      balance: sequelize.literal(`balance - ${amount}`)
    }, { transaction: t });
    
    await t.commit();
    
    // Return the updated config
    return await BotConfig.findOne({ where: { userId } });
  } catch (error) {
    await t.rollback();
    console.error('Error allocating funds:', error);
    throw error;
  }
};

/**
 * Withdraw funds from the trading bot
 * @param {number} userId - User ID
 * @param {number} amount - Amount to withdraw
 * @returns {Promise<Object>} - Updated bot config
 */
const withdrawFunds = async (userId, amount) => {
  const t = await sequelize.transaction();
  
  try {
    // Get bot config
    const config = await BotConfig.findOne({ 
      where: { userId },
      transaction: t 
    });
    
    if (!config) {
      throw new Error('Bot configuration not found');
    }
    
    // Check if bot has sufficient allocated funds
    if (parseFloat(config.allocatedFunds) < parseFloat(amount)) {
      throw new Error('Insufficient allocated funds');
    }
    
    // Update bot config
    await config.update({ 
      allocatedFunds: sequelize.literal(`"allocatedFunds" - ${amount}`)
    }, { transaction: t });
    
    // Get user
    const user = await User.findByPk(userId, { transaction: t });
    
    // Update user balance
    await user.update({
      balance: sequelize.literal(`balance + ${amount}`)
    }, { transaction: t });
    
    await t.commit();
    
    // Return the updated config
    return await BotConfig.findOne({ where: { userId } });
  } catch (error) {
    await t.rollback();
    console.error('Error withdrawing funds:', error);
    throw error;
  }
};

/**
 * Record bot action in the database
 * @param {number} userId - User ID
 * @param {Object} actionData - Action data
 * @returns {Promise<Object>} - Created action record
 */
const recordBotAction = async (userId, actionData) => {
  try {
    const action = await BotAction.create({
      userId,
      ...actionData
    });
    
    return action;
  } catch (error) {
    console.error('Error recording bot action:', error);
    throw new Error('Failed to record bot action');
  }
};

/**
 * Get bot performance statistics
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Bot statistics
 */
const getBotStats = async (userId) => {
  try {
    // Get bot config
    const config = await BotConfig.findOne({ where: { userId } });
    
    if (!config) {
      throw new Error('Bot configuration not found');
    }
    
    // Get total invested amount (all buy transactions by the bot)
    const totalInvested = await Transaction.sum('total_amount', {
      where: {
        userId,
        type: 'BUY',
        createdAt: {
          [Op.gte]: sequelize.literal("CURRENT_DATE - INTERVAL '30 days'")
        }
      }
    }) || 0;
    
    // Get current portfolio value of stocks bought by the bot
    const portfolio = await portfolioService.getUserPortfolio(userId);
    
    // Check if prediction service is healthy
    const healthStatus = await stockService.checkHealth();
    
    let currentValue = 0;
    
    if (healthStatus.healthy) {
      // Calculate current portfolio value
      for (const item of portfolio) {
        try {
          const stockData = await stockService.getPrediction(item.symbol);
          const itemValue = parseFloat(item.shares) * stockData.current_price;
          currentValue += itemValue;
        } catch (error) {
          console.error(`Error getting price for ${item.symbol}:`, error);
          // If we can't get current price, use the average price as fallback
          currentValue += parseFloat(item.shares) * parseFloat(item.average_price);
        }
      }
    } else {
      // If prediction service is unhealthy, use average prices
      currentValue = portfolio.reduce((sum, item) => {
        return sum + (parseFloat(item.shares) * parseFloat(item.average_price));
      }, 0);
    }
    
    // Calculate profit/loss
    const profit = currentValue - totalInvested;
    const profitPercentage = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
    
    // Get total number of trades
    const tradesMade = await Transaction.count({
      where: {
        userId,
        createdAt: {
          [Op.gte]: sequelize.literal("CURRENT_DATE - INTERVAL '30 days'")
        }
      }
    });
    
    // Calculate success rate (percentage of profitable sells)
    const profitableTrades = await BotAction.count({
      where: {
        userId,
        action: 'SELL',
        potentialGainPercent: {
          [Op.gt]: 0
        },
        createdAt: {
          [Op.gte]: sequelize.literal("CURRENT_DATE - INTERVAL '30 days'")
        }
      }
    });
    
    const totalSellTrades = await BotAction.count({
      where: {
        userId,
        action: 'SELL',
        createdAt: {
          [Op.gte]: sequelize.literal("CURRENT_DATE - INTERVAL '30 days'")
        }
      }
    });
    
    const successRate = totalSellTrades > 0 ? (profitableTrades / totalSellTrades) * 100 : 0;
    
    // Calculate the amount currently invested (still in positions)
    const currentlyInvested = portfolio.reduce((sum, item) => {
      return sum + parseFloat(item.total_investment);
    }, 0);
    
    return {
      isActive: config.isActive,
      lastRunTime: config.lastRunTime,
      allocatedFunds: parseFloat(config.allocatedFunds),
      totalInvested: parseFloat(totalInvested),
      currentValue: parseFloat(currentValue),
      profit: parseFloat(profit),
      profitPercentage: parseFloat(profitPercentage),
      tradesMade,
      successRate,
      investedAmount: parseFloat(currentlyInvested), // Amount currently in positions
      availableAmount: parseFloat(config.allocatedFunds) - parseFloat(currentlyInvested) // Available for trading
    };
  } catch (error) {
    console.error('Error calculating bot stats:', error);
    throw new Error('Failed to calculate bot statistics');
  }
};

/**
 * Update the last run time of the bot
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Updated config
 */
const updateLastRunTime = async (userId) => {
  try {
    const config = await BotConfig.findOne({ where: { userId } });
    
    if (!config) {
      throw new Error('Bot configuration not found');
    }
    
    await config.update({ lastRunTime: new Date() });
    
    return config;
  } catch (error) {
    console.error('Error updating last run time:', error);
    throw new Error('Failed to update last run time');
  }
};

/**
 * Update the last trade time for a symbol in the watchlist
 * @param {number} userId - User ID
 * @param {string} symbol - Stock symbol
 * @param {string} lastTradeTime - ISO datetime string
 * @returns {Promise<Object>} - Updated watchlist item
 */
const updateWatchlistLastTrade = async (userId, symbol, lastTradeTime) => {
  try {
    const watchlistItem = await BotWatchlist.findOne({
      where: { userId, symbol }
    });
    
    if (!watchlistItem) {
      throw new Error(`Symbol ${symbol} not found in watchlist`);
    }
    
    await watchlistItem.update({ lastTradeTime });
    
    return watchlistItem;
  } catch (error) {
    console.error(`Error updating last trade time for ${symbol}:`, error);
    throw error;
  }
};

/**
 * Get transactions and performance data for a specific stock
 * @param {number} userId - User ID
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Stock transactions and performance data
 */
const getStockDetails = async (userId, symbol) => {
  try {
    // Get transactions for the stock
    const transactions = await Transaction.findAll({
      where: {
        userId,
        symbol
      },
      order: [['createdAt', 'DESC']],
      limit: 50 // Limit to most recent 50 transactions
    });
    
    // Format transaction data
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      date: tx.createdAt,
      type: tx.type,
      shares: parseFloat(tx.shares),
      price: parseFloat(tx.price),
      total: parseFloat(tx.total_amount),
      is_bot: tx.is_bot || false,
      profit: tx.profit,
      profit_percentage: tx.profit_percentage
    }));
    
    // Get portfolio data for the stock
    const portfolioItem = await Portfolio.findOne({
      where: {
        userId,
        symbol
      }
    });
    
    // Always get fresh current price data for accurate performance calculations
    let currentPrice = 0;
    try {
      // Force a fresh fetch of price data each time
      const stockData = await stockService.getPrediction(symbol);
      currentPrice = stockData.current_price;
      console.log(`Current price for ${symbol}: $${currentPrice}`);
    } catch (error) {
      console.error(`Error getting current price for ${symbol}:`, error);
      // If we can't get current price, try to use the most recent transaction price as fallback
      if (transactions.length > 0) {
        currentPrice = parseFloat(transactions[0].price);
        console.log(`Using fallback price for ${symbol}: $${currentPrice}`);
      }
    }
    
    // Prepare performance data
    let performance = {
      symbol,
      shares_owned: 0,
      average_price: 0,
      total_investment: 0,
      total_value: 0,
      profit: 0,
      profit_percent: 0,
      last_price: currentPrice
    };
    
    if (portfolioItem) {
      const shares = parseFloat(portfolioItem.shares);
      const avgPrice = parseFloat(portfolioItem.average_price);
      const totalInvestment = parseFloat(portfolioItem.total_investment);
      
      // Calculate current value based on real-time price
      const currentValue = shares * currentPrice;
      const profit = currentValue - totalInvestment;
      const profitPercent = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;
      
      // Ensure all numeric values are valid
      performance = {
        symbol,
        shares_owned: isNaN(shares) ? 0 : shares,
        average_price: isNaN(avgPrice) ? 0 : avgPrice,
        total_investment: isNaN(totalInvestment) ? 0 : totalInvestment,
        total_value: isNaN(currentValue) ? 0 : currentValue,
        profit: isNaN(profit) ? 0 : profit,
        profit_percent: isNaN(profitPercent) ? 0 : profitPercent,
        last_price: isNaN(currentPrice) ? 0 : currentPrice
      };
    }
    
    // Return both transactions and performance data
    return {
      transactions: formattedTransactions,
      performance
    };
  } catch (error) {
    console.error(`Error fetching details for ${symbol}:`, error);
    throw new Error(`Failed to fetch details for ${symbol}`);
  }
};

/**
 * Execute a buy transaction using bot funds instead of user balance
 * @param {number} userId - User ID
 * @param {string} symbol - Stock symbol
 * @param {number} shares - Number of shares to buy
 * @param {number} price - Price per share
 * @param {number} botActionId - ID of the bot action that triggered this transaction
 * @returns {Promise<Object>} - Transaction object
 */
const executeBotBuy = async (userId, symbol, shares, price, botActionId) => {
  try {
    console.log(`Bot buy execution: ${shares} shares of ${symbol} at $${price}`);
    
    // Validate the price and shares
    if (!price || isNaN(price) || price <= 0) {
      throw new Error(`Invalid price for ${symbol}: ${price}`);
    }
    if (!shares || isNaN(shares) || shares <= 0) {
      throw new Error(`Invalid shares amount for ${symbol}: ${shares}`);
    }
    
    // Round shares to 4 decimal places for precision
    shares = parseFloat(shares.toFixed(4));
    const totalAmount = parseFloat((shares * price).toFixed(2));
    
    console.log(`Calculated total amount: $${totalAmount} for ${shares} shares at $${price}`);
    
    // Get current bot statistics
    const botStats = await getBotStats(userId);
    const { allocatedFunds, investedAmount } = botStats;
    const availableAmount = allocatedFunds - investedAmount;
    
    // Check if we have sufficient funds
    if (availableAmount < totalAmount) {
      throw new Error(`Insufficient allocated funds for bot. Need $${totalAmount}, but only have $${availableAmount} available`);
    }
    
    // Execute the transaction using allocated bot funds
    const transaction = await portfolioService.buyStock(userId, symbol, shares, price, true, botActionId);

    // Update the bot statistics to reflect this purchase
    await updateBotStatistics(userId, investedAmount + totalAmount, allocatedFunds);
    
    console.log(`Transaction completed. ID: ${transaction.id}`);
    console.log(`Updated bot stats - Invested: $${investedAmount + totalAmount}, Available: $${allocatedFunds - (investedAmount + totalAmount)}`);
    
    // Return transaction details
    return {
      transaction,
      allocatedFunds,
      investedAmount: investedAmount + totalAmount,
      availableAmount: allocatedFunds - (investedAmount + totalAmount)
    };
  } catch (error) {
    console.error(`Bot buy execution error for ${symbol}:`, error);
    throw error;
  }
};

/**
 * Execute a sell transaction for bot trades
 * @param {number} userId - User ID
 * @param {string} symbol - Stock symbol
 * @param {number} shares - Number of shares to sell
 * @param {number} price - Price per share
 * @param {number} botActionId - ID of the bot action that triggered this transaction
 * @returns {Promise<Object>} - Transaction object
 */
const executeBotSell = async (userId, symbol, shares, price, botActionId) => {
  try {
    console.log(`Bot sell execution: ${shares} shares of ${symbol} at $${price}`);
    
    // Validate the price and shares
    if (!price || isNaN(price) || price <= 0) {
      throw new Error(`Invalid price for ${symbol}: ${price}`);
    }
    if (!shares || isNaN(shares) || shares <= 0) {
      throw new Error(`Invalid shares amount for ${symbol}: ${shares}`);
    }
    
    // Round shares to 4 decimal places for precision
    shares = parseFloat(shares.toFixed(4));
    const totalAmount = parseFloat((shares * price).toFixed(2));
    
    console.log(`Calculated total amount: $${totalAmount} for ${shares} shares at $${price}`);
    
    // Get current bot statistics
    const botStats = await getBotStats(userId);
    const { allocatedFunds, investedAmount } = botStats;
    
    // Get the purchase history to calculate profit/loss
    const portfolioItem = await portfolioService.getPortfolioItem(userId, symbol);
    if (!portfolioItem || portfolioItem.shares < shares) {
      throw new Error(`Insufficient shares of ${symbol} in portfolio. Have ${portfolioItem ? portfolioItem.shares : 0}, trying to sell ${shares}`);
    }
    
    const avgPurchasePrice = portfolioItem.averagePurchasePrice;
    const profit = (price - avgPurchasePrice) * shares;
    const profitPercentage = ((price - avgPurchasePrice) / avgPurchasePrice) * 100;
    
    // Execute the transaction
    const transaction = await portfolioService.sellStock(userId, symbol, shares, price, true, botActionId, profit);
    
    // Update the bot statistics to reflect this sale (reduce invested amount)
    const newInvestedAmount = Math.max(0, investedAmount - totalAmount);
    await updateBotStatistics(userId, newInvestedAmount, allocatedFunds);
    
    console.log(`Transaction completed. ID: ${transaction.id}`);
    console.log(`Profit/Loss: $${profit.toFixed(2)} (${profitPercentage.toFixed(2)}%)`);
    console.log(`Updated bot stats - Invested: $${newInvestedAmount}, Available: $${allocatedFunds - newInvestedAmount}`);
    
    // Return transaction details
    return {
      transaction,
      profit,
      profitPercentage,
      allocatedFunds,
      investedAmount: newInvestedAmount,
      availableAmount: allocatedFunds - newInvestedAmount
    };
  } catch (error) {
    console.error(`Bot sell execution error for ${symbol}:`, error);
    throw error;
  }
};

/**
 * Update watchlist item active status
 * @param {number} userId - User ID
 * @param {string} symbol - Stock symbol
 * @param {boolean} isActive - Active status
 * @returns {Promise<Object>} - Updated watchlist item
 */
const updateWatchlistItemStatus = async (userId, symbol, isActive) => {
  try {
    const watchlistItem = await BotWatchlist.findOne({
      where: { userId, symbol }
    });
    
    if (!watchlistItem) {
      throw new Error(`${symbol} is not in the watchlist`);
    }
    
    // Update the isActive status
    await watchlistItem.update({ isActive });
    
    return watchlistItem;
  } catch (error) {
    console.error(`Error updating status for ${symbol}:`, error);
    throw error;
  }
};

/**
 * Update bot statistics (investedAmount and allocatedFunds)
 * @param {number} userId - User ID
 * @param {number} investedAmount - New invested amount
 * @param {number} allocatedFunds - Current allocated funds
 * @returns {Promise<Object>} - Updated config
 */
const updateBotStatistics = async (userId, investedAmount, allocatedFunds) => {
  try {
    const config = await BotConfig.findOne({ where: { userId } });
    
    if (!config) {
      throw new Error('Bot configuration not found');
    }
    
    // We don't need to update anything here because:
    // 1. allocatedFunds is managed separately via allocateFunds() and withdrawFunds()
    // 2. investedAmount is calculated dynamically based on portfolio holdings in getBotStats()
    // We only need to record a timestamp of the last update
    await config.update({ 
      lastUpdated: new Date()
    });
    
    console.log(`Updated bot statistics - userId: ${userId}, invested: $${investedAmount}, allocated: $${allocatedFunds}`);
    
    return config;
  } catch (error) {
    console.error('Error updating bot statistics:', error);
    throw new Error('Failed to update bot statistics');
  }
};

module.exports = {
  getBotConfig,
  updateBotConfig,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getBotActions,
  recordStockPrice,
  allocateFunds,
  withdrawFunds,
  recordBotAction,
  getBotStats,
  updateLastRunTime,
  updateWatchlistLastTrade,
  getStockDetails,
  executeBotBuy,
  executeBotSell,
  updateWatchlistItemStatus
}; 