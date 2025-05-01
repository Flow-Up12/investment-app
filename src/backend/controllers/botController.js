const botService = require('../services/botService');
const stockService = require('../services/stockService');
const userService = require('../services/userService');
const portfolioService = require('../services/portfolioService');

/**
 * Get bot configuration
 */
const getBotConfig = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const config = await botService.getBotConfig(userId);
    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update bot configuration
 */
const updateBotConfig = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const configData = req.body;
    
    // Validate required fields
    if (typeof configData.isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive is required and must be boolean' });
    }
    
    const config = await botService.updateBotConfig(userId, configData);
    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get bot watchlist
 */
const getBotWatchlist = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const watchlist = await botService.getWatchlist(userId);
    
    // Map watchlist to include current prices if possible
    const watchlistWithPrices = await Promise.all(watchlist.map(async (item) => {
      try {
        const prediction = await stockService.getPrediction(item.symbol);
        return {
          id: item.id,
          symbol: item.symbol,
          isActive: item.isActive,
          lastTradeTime: item.lastTradeTime,
          customBuyThreshold: item.customBuyThreshold,
          customSellThreshold: item.customSellThreshold,
          currentPrice: prediction.current_price,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        };
      } catch (error) {
        return item;
      }
    }));
    
    res.status(200).json(watchlistWithPrices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Add stock to bot watchlist
 */
const addToWatchlist = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const { symbol, customBuyThreshold, customSellThreshold } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const options = {};
    
    if (customBuyThreshold !== undefined) {
      options.customBuyThreshold = parseFloat(customBuyThreshold);
    }
    
    if (customSellThreshold !== undefined) {
      options.customSellThreshold = parseFloat(customSellThreshold);
    }
    
    const watchlistItem = await botService.addToWatchlist(userId, symbol, options);
    res.status(201).json(watchlistItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Remove stock from bot watchlist
 */
const removeFromWatchlist = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const result = await botService.removeFromWatchlist(userId, symbol);
    res.status(200).json({ message: `${symbol} removed from watchlist`, success: true });
  } catch (error) {
    res.status(400).json({ error: error.message, success: false });
  }
};

/**
 * Get bot action history
 */
const getBotActions = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const { symbol, action, limit, offset } = req.query;
    
    const options = {
      symbol,
      action,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    };
    
    const actions = await botService.getBotActions(userId, options);
    res.status(200).json(actions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Allocate funds to the trading bot
 */
const allocateFunds = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const { amount } = req.body;
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    
    const config = await botService.allocateFunds(userId, parseFloat(amount));
    
    // Get the updated user info with balance
    const user = await userService.getUserById(userId);
    
    console.log(`Successfully allocated $${amount} to bot. New config: ${JSON.stringify(config)}`);
    
    res.status(200).json({
      message: `Successfully allocated $${amount} to the trading bot`,
      config,
      userBalance: parseFloat(user.balance)
    });
  } catch (error) {
    console.error('Error in allocateFunds:', error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Withdraw funds from the trading bot
 */
const withdrawFunds = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const { amount } = req.body;
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    
    const config = await botService.withdrawFunds(userId, parseFloat(amount));
    
    // Get the updated user info with balance
    const user = await userService.getUserById(userId);
    
    res.status(200).json({
      message: `Successfully withdrew $${amount} from the trading bot`,
      config,
      userBalance: parseFloat(user.balance)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Get bot statistics
 */
const getBotStats = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const stats = await botService.getBotStats(userId);
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update last trade time for a symbol
 */
const updateLastTradeTime = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const { symbol } = req.params;
    const { lastTradeTime } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    if (!lastTradeTime) {
      return res.status(400).json({ error: 'lastTradeTime is required' });
    }
    
    await botService.updateWatchlistLastTrade(userId, symbol, lastTradeTime);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Manually trigger a bot run
 */
const runBot = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    
    // Get the bot config
    const config = await botService.getBotConfig(userId);
    
    if (!config.isActive) {
      return res.status(400).json({ error: 'Bot is not active. Please activate it first.' });
    }
    
    // Get the watchlist
    const watchlist = await botService.getWatchlist(userId);
    
    if (watchlist.length === 0) {
      return res.status(400).json({ error: 'Watchlist is empty. Please add stocks to watchlist.' });
    }
    
    // Get bot stats to check available funds
    const botStats = await botService.getBotStats(userId);
    
    // Check if there are available funds for trading
    if (botStats.availableAmount <= 0) {
      return res.status(400).json({ 
        error: 'Insufficient funds available for trading. Currently invested amount exceeds allocated funds. Please allocate more funds or withdraw from existing positions.',
        botStats
      });
    }
    
    // Process each stock in the watchlist
    const botActions = [];
    const timestamp = new Date();
    
    // Keep track of how much we've spent during this run to avoid overspending
    let fundsSpentInThisRun = 0;
    let availableFundsForRun = botStats.availableAmount;
    
    // Use fixed investment amount for consistency
    const FIXED_INVESTMENT_PER_STOCK = 200.00; // $200 per stock
    
    // Determine how many stocks we can buy this run with fixed investment amounts
    const maxStocksToBuy = Math.floor(availableFundsForRun / FIXED_INVESTMENT_PER_STOCK);
    let stocksBoughtThisRun = 0;
    
    for (const item of watchlist) {
      if (!item.isActive) continue;
      
      try {
        // Get stock data - ensure we're using real market data
        const stockData = await stockService.getPrediction(item.symbol);
        
        if (!stockData || !stockData.current_price || isNaN(stockData.current_price)) {
          throw new Error(`Could not get valid price data for ${item.symbol}`);
        }
        
        // Use the exact current price
        const currentPrice = stockData.current_price;
        
        // For prediction, use same current price (no mock prediction)
        const predictedPrice = stockData.predicted_price || currentPrice;
        const potentialGainPercent = ((predictedPrice - currentPrice) / currentPrice) * 100;
        
        // Create action object
        const action = {
          symbol: item.symbol,
          currentPrice,
          predictedPrice,
          potentialGainPercent,
          timestamp
        };
        
        // Determine action based on thresholds
        const buyThreshold = item.customBuyThreshold || config.buyThreshold;
        const sellThreshold = item.customSellThreshold || config.sellThreshold;
        
        if (potentialGainPercent >= buyThreshold && stocksBoughtThisRun < maxStocksToBuy) {
          // Use fixed investment amount
          const maxInvestment = FIXED_INVESTMENT_PER_STOCK;
          
          if (availableFundsForRun - fundsSpentInThisRun >= maxInvestment) {
            // Calculate shares based on exact current price - round to 4 decimal places for precision
            const shares = parseFloat((maxInvestment / currentPrice).toFixed(4));
            
            action.action = 'BUY';
            action.shares = shares;
            action.investment = maxInvestment;
            action.reason = `Predicted gain of ${potentialGainPercent.toFixed(2)}% exceeds buy threshold of ${buyThreshold}%`;
            
            // Record the action
            const savedAction = await botService.recordBotAction(userId, action);
            
            // Execute the buy transaction through the bot service to use allocated funds
            try {
              const buyResult = await botService.executeBotBuy(userId, item.symbol, action.shares, currentPrice, savedAction.id);
              action.transaction_completed = true;
              action.transaction = buyResult.transaction;
              
              // Update the running total of spent funds with accurate values
              fundsSpentInThisRun += maxInvestment;
              stocksBoughtThisRun++;
              
              // Reduce the available funds for this run to ensure we don't overspend
              availableFundsForRun -= maxInvestment;
              
              console.log(`Successfully bought ${action.shares} shares of ${item.symbol} at $${currentPrice}`);
              console.log(`Transaction ID: ${buyResult.transaction.id}`);
              console.log(`Allocated: $${buyResult.allocatedFunds}, Invested: $${buyResult.investedAmount}, Available: $${buyResult.availableAmount}`);
              
              // Update the bot config with the new funds distribution
              await botService.updateBotConfig(userId, { 
                lastUpdated: new Date()
              });
            } catch (txError) {
              console.error('Error executing buy transaction:', txError);
              action.transaction_completed = false;
              action.transaction_error = txError.message;
            }
            
          } else {
            action.action = 'HOLD';
            action.reason = 'Insufficient funds for trading';
          }
        } else if (potentialGainPercent <= sellThreshold) {
          // Check if user has shares to sell by getting portfolio data
          const portfolio = await portfolioService.getUserPortfolio(userId);
          const stockPosition = portfolio.find(p => p.symbol === item.symbol);
          
          if (stockPosition && parseFloat(stockPosition.shares) > 0) {
            action.action = 'SELL';
            action.shares = parseFloat(stockPosition.shares);
            action.reason = `Predicted loss of ${potentialGainPercent.toFixed(2)}% exceeds sell threshold of ${sellThreshold}%`;
            
            // Record the action
            const savedAction = await botService.recordBotAction(userId, action);
            
            // Execute the sell transaction through the bot service
            try {
              const sellResult = await botService.executeBotSell(userId, item.symbol, action.shares, currentPrice, savedAction.id);
              action.transaction_completed = true;
              action.transaction = sellResult.transaction;
              action.profit = sellResult.profit;
              action.profit_percentage = sellResult.profitPercentage;
              
              console.log(`Successfully sold ${action.shares} shares of ${item.symbol} at $${currentPrice}`);
              console.log(`Profit: $${sellResult.profit.toFixed(2)} (${sellResult.profitPercentage.toFixed(2)}%)`);
              console.log(`Allocated: $${sellResult.allocatedFunds}, Invested: $${sellResult.investedAmount}, Available: $${sellResult.availableAmount}`);
            } catch (txError) {
              console.error('Error executing sell transaction:', txError);
              action.transaction_completed = false;
              action.transaction_error = txError.message;
            }
            
          } else {
            action.action = 'HOLD';
            action.reason = `No shares to sell despite predicted loss of ${potentialGainPercent.toFixed(2)}%`;
          }
        } else {
          action.action = 'HOLD';
          action.reason = `Predicted gain/loss of ${potentialGainPercent.toFixed(2)}% is within thresholds (${sellThreshold}% to ${buyThreshold}%)`;
        }
        
        // Add to actions list
        botActions.push(action);
        
        // If it's not a HOLD action, update last trade time
        if (action.action !== 'HOLD') {
          await botService.updateWatchlistLastTrade(userId, item.symbol, timestamp);
        }
        
      } catch (error) {
        console.error(`Error processing watchlist item ${item.symbol}:`, error);
        botActions.push({
          symbol: item.symbol,
          action: 'ERROR',
          reason: error.message,
          timestamp
        });
      }
    }
    
    // Update last run time
    await botService.updateBotConfig(userId, { lastRunTime: timestamp });
    
    // Refresh statistics after all trades
    const updatedStats = await botService.getBotStats(userId);
    
    res.json({
      timestamp,
      actions: botActions,
      message: `Bot run completed with ${botActions.length} actions`,
      stats: updatedStats
    });
  } catch (error) {
    console.error('Error running bot:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Record bot action
 */
const recordBotAction = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const actionData = req.body;
    
    if (!actionData.symbol || !actionData.action) {
      return res.status(400).json({ error: 'Symbol and action are required' });
    }
    
    const action = await botService.recordBotAction(userId, actionData);
    res.status(201).json(action);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get transactions and performance data for a specific stock
 */
const getStockDetails = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const details = await botService.getStockDetails(userId, symbol);
    res.status(200).json(details);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Toggle watchlist item active status
 */
const toggleWatchlistItemStatus = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const { symbol } = req.params;
    const { isActive } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean value' });
    }
    
    const result = await botService.updateWatchlistItemStatus(userId, symbol, isActive);
    res.status(200).json({ message: `${symbol} status updated successfully`, success: true, item: result });
  } catch (error) {
    res.status(400).json({ error: error.message, success: false });
  }
};

module.exports = {
  getBotConfig,
  updateBotConfig,
  getBotWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getBotActions,
  getBotStats,
  allocateFunds,
  withdrawFunds,
  updateLastTradeTime,
  recordBotAction,
  runBot,
  getStockDetails,
  toggleWatchlistItemStatus
}; 