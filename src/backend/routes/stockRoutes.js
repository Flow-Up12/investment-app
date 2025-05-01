const express = require('express');
const stockController = require('../controllers/stockController');
const axios = require('axios');

const router = express.Router();

// Environment variable for the prediction service URL
const PREDICTION_API = process.env.PREDICTION_API_URL || 'http://prediction:5001';

// Get stock symbols
router.get('/symbols', stockController.getSymbols);

// Get stock prediction
router.get('/predict/:symbol', stockController.getPrediction);

// Buy stock
router.post('/buy', stockController.buyStock);

// Sell stock
router.post('/sell', stockController.sellStock);

// Get user portfolio
router.get('/portfolio', stockController.getPortfolio);

// Record stock price data - temporarily commented out due to missing controller function
// router.post('/prices/record', stockController.recordStockPrice);

// Get current price for a stock
router.get('/current-price', async (req, res) => {
  try {
    const symbol = req.query.symbol;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter is required' });
    }
    
    const response = await axios.get(`${PREDICTION_API}/current-price`, {
      params: { symbol }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching current price:', error.message);
    res.status(500).json({ error: 'Failed to fetch current price: ' + error.message });
  }
});

// Get bulk prices for multiple stocks
router.get('/bulk-prices', async (req, res) => {
  try {
    const symbols = req.query.symbols;
    if (!symbols) {
      return res.status(400).json({ error: 'Symbols parameter is required' });
    }
    
    const response = await axios.get(`${PREDICTION_API}/bulk-prices`, {
      params: { symbols }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching bulk prices:', error.message);
    res.status(500).json({ error: 'Failed to fetch bulk prices: ' + error.message });
  }
});

// Search for stock symbols
router.get('/search-symbol', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const response = await axios.get(`${PREDICTION_API}/search-symbol`, {
      params: { q: query }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error searching symbols:', error.message);
    res.status(500).json({ error: 'Failed to search symbols: ' + error.message });
  }
});

// Get top movers
router.get('/top-movers', async (req, res) => {
  try {
    // Call the prediction service's top-movers endpoint
    const response = await axios.get(`${PREDICTION_API}/top-movers`, {
      timeout: 5000 // 5 second timeout
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching top movers:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch top movers: ' + error.message,
      // Include a fallback set of synthetic movers for frontend
      fallback: [
        { symbol: 'AAPL', name: 'Apple Inc.', price: 175.14, change: 5.27, percentChange: 3.10, synthetic: true },
        { symbol: 'TSLA', name: 'Tesla Inc.', price: 175.12, change: -8.23, percentChange: -4.75, synthetic: true },
        { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 900.02, change: 25.37, percentChange: 2.74, synthetic: true },
        { symbol: 'META', name: 'Meta Platforms Inc.', price: 474.21, change: 10.35, percentChange: 2.23, synthetic: true },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 182.51, change: 3.45, percentChange: 1.93, synthetic: true },
        { symbol: 'MSFT', name: 'Microsoft Corp.', price: 410.56, change: 2.34, percentChange: 0.61, synthetic: true },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 166.89, change: -1.12, percentChange: -0.67, synthetic: true },
        { symbol: 'JPM', name: 'JPMorgan Chase & Co.', price: 198.76, change: -1.89, percentChange: -0.94, synthetic: true }
      ]
    });
  }
});

module.exports = router; 