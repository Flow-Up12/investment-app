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
    
    // Process transactions to add more details
    const processedTransactions = [];
    const portfolioBySymbol = {}; // Track avg purchase price and shares by symbol

    // First pass to build portfolio state
    for (const t of transactions) {
      const symbol = t.symbol;
      
      if (!portfolioBySymbol[symbol]) {
        portfolioBySymbol[symbol] = { shares: 0, totalCost: 0, averagePrice: 0 };
      }
      
      const portfolio = portfolioBySymbol[symbol];
      
      if (t.type === 'BUY') {
        // Update portfolio for buys
        const shares = parseFloat(t.shares);
        const price = parseFloat(t.price);
        const cost = shares * price;
        
        // Update average price calculation
        portfolio.totalCost += cost;
        portfolio.shares += shares;
        portfolio.averagePrice = portfolio.shares > 0 ? portfolio.totalCost / portfolio.shares : 0;
      }
    }
    
    // Second pass to calculate profit/loss for sell transactions
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      const result = {
        id: t.id,
        symbol: t.symbol,
        type: t.type,
        shares: parseFloat(t.shares),
        price: parseFloat(t.price),
        total_amount: parseFloat(t.total_amount),
        date: t.createdAt,
        is_bot: !!t.botActionId // Mark as bot transaction if it has a botActionId
      };
      
      // For SELL transactions, calculate profit/loss
      if (t.type === 'SELL') {
        const portfolio = portfolioBySymbol[t.symbol];
        if (portfolio) {
          const sellPrice = parseFloat(t.price);
          const sellShares = parseFloat(t.shares);
          const sellTotal = sellPrice * sellShares;
          const costBasis = portfolio.averagePrice * sellShares;
          
          result.profit = sellTotal - costBasis;
          result.profit_percentage = costBasis > 0 ? (result.profit / costBasis) * 100 : 0;
          
          // Update portfolio
          portfolio.shares -= sellShares;
          if (portfolio.shares <= 0) {
            portfolio.shares = 0;
            portfolio.totalCost = 0;
            portfolio.averagePrice = 0;
          } else {
            portfolio.totalCost = portfolio.shares * portfolio.averagePrice;
          }
        }
      }
      
      processedTransactions.push(result);
    }
    
    res.status(200).json(processedTransactions);
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