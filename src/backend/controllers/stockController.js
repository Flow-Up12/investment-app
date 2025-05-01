const stockService = require('../services/stockService');
const portfolioService = require('../services/portfolioService');

/**
 * Get stock prediction
 */
const getPrediction = async (req, res) => {
  try {
    const { symbol } = req.params;
    const days = req.query.days ? parseInt(req.query.days) : 7;
    const useSynthetic = req.query.use_synthetic === 'true';
    const range = req.query.range || '1D'; // Add range parameter support
    
    // Pass the range parameter to the service
    const prediction = await stockService.getPrediction(symbol, days, useSynthetic, range);
    res.status(200).json(prediction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get available stock symbols
 */
const getSymbols = async (req, res) => {
  try {
    const symbols = await stockService.getSymbols();
    res.status(200).json(symbols);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Buy stock
 */
const buyStock = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const { symbol, shares } = req.body;
    
    if (!symbol || !shares) {
      return res.status(400).json({ error: 'Symbol and shares are required' });
    }
    
    // Get current price from prediction service
    const stockData = await stockService.getPrediction(symbol);
    const currentPrice = stockData.current_price;
    
    // Buy the stock
    const transaction = await portfolioService.buyStock(
      userId,
      symbol,
      parseFloat(shares),
      currentPrice
    );
    
    res.status(200).json({
      message: `Successfully bought ${shares} shares of ${symbol} at $${currentPrice}`,
      transaction: {
        id: transaction.id,
        symbol: transaction.symbol,
        shares: parseFloat(transaction.shares),
        price: parseFloat(transaction.price),
        total_amount: parseFloat(transaction.total_amount),
        date: transaction.createdAt
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Sell stock
 */
const sellStock = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const { symbol, shares } = req.body;
    
    if (!symbol || !shares) {
      return res.status(400).json({ error: 'Symbol and shares are required' });
    }
    
    // Get current price from prediction service
    const stockData = await stockService.getPrediction(symbol);
    const currentPrice = stockData.current_price;
    
    // Sell the stock
    const transaction = await portfolioService.sellStock(
      userId,
      symbol,
      parseFloat(shares),
      currentPrice
    );
    
    res.status(200).json({
      message: `Successfully sold ${shares} shares of ${symbol} at $${currentPrice}`,
      transaction: {
        id: transaction.id,
        symbol: transaction.symbol,
        shares: parseFloat(transaction.shares),
        price: parseFloat(transaction.price),
        total_amount: parseFloat(transaction.total_amount),
        date: transaction.createdAt
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Get user portfolio
 */
const getPortfolio = async (req, res) => {
  try {
    const userId = 1; // TODO: Replace with actual user auth
    const portfolio = await portfolioService.getUserPortfolio(userId);
    
    // Check if prediction service is healthy
    const healthStatus = await stockService.checkHealth();
    
    const portfolioWithCurrentPrices = await Promise.all(portfolio.map(async (item) => {
      try {
        // If prediction service is unhealthy, throw error to skip price fetching
        if (!healthStatus.healthy) {
          throw new Error("Prediction service unavailable");
        }
        
        // Get current price for each stock in the portfolio
        const stockData = await stockService.getPrediction(item.symbol);
        const currentPrice = stockData.current_price;
        const currentValue = parseFloat(item.shares) * currentPrice;
        const profit = currentValue - parseFloat(item.total_investment);
        const profitPercentage = (profit / parseFloat(item.total_investment)) * 100;
        
        return {
          id: item.id,
          symbol: item.symbol,
          shares: parseFloat(item.shares),
          average_price: parseFloat(item.average_price),
          current_price: currentPrice,
          total_investment: parseFloat(item.total_investment),
          current_value: currentValue,
          profit: profit,
          profit_percentage: profitPercentage
        };
      } catch (error) {
        console.log(`Unable to get current price for ${item.symbol}: ${error.message}`);
        // If we can't get current price, return portfolio item without it
        return {
          id: item.id,
          symbol: item.symbol,
          shares: parseFloat(item.shares),
          average_price: parseFloat(item.average_price),
          total_investment: parseFloat(item.total_investment)
        };
      }
    }));
    
    res.status(200).json(portfolioWithCurrentPrices);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getPrediction,
  getSymbols,
  buyStock,
  sellStock,
  getPortfolio
}; 