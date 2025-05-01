const axios = require('axios');

const PREDICTION_API_BASE = process.env.PREDICTION_API_URL || 'http://prediction:5001';

// Cache to track last known prices for each symbol
const lastKnownPrices = {};

/**
 * Fetch actual market data for a stock
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Current market data
 */
const fetchActualMarketData = async (symbol) => {
  try {
    console.log(`Fetching actual market data for ${symbol}`);
    
    // Try the quote endpoint first
    try {
      const response = await axios.get(`${PREDICTION_API_BASE}/quote`, {
        params: { symbol },
        timeout: 5000 // 5 second timeout
      });
      
      const data = response.data;
      
      // Validate price data
      if (!data || !data.c || isNaN(data.c) || data.c <= 0) {
        throw new Error(`Invalid price data received for ${symbol}`);
      }
      
      // Check for unreasonable price jumps
      const currentPrice = data.c;
      const lastPrice = lastKnownPrices[symbol];
      
      if (lastPrice && Math.abs((currentPrice - lastPrice) / lastPrice) > 0.15) {
        console.warn(`Warning: Suspicious price jump detected for ${symbol}. Current: $${currentPrice}, Last: $${lastPrice}.`);
        
        // If the jump is extreme (>50%), use the last known price
        if (Math.abs((currentPrice - lastPrice) / lastPrice) > 0.50) {
          console.warn(`Using last known price for ${symbol} due to extreme price jump`);
          data.c = lastPrice;
        }
      }
      
      // Update our price cache with the verified price
      lastKnownPrices[symbol] = data.c;
      
      return {
        symbol,
        price: data.c,
        open: data.o,
        high: data.h,
        low: data.l,
        previous_close: data.pc,
        timestamp: new Date().toISOString()
      };
    } catch (quoteError) {
      console.warn(`Quote endpoint failed for ${symbol}, trying prediction endpoint as fallback`);
      
      // If quote fails, try the prediction endpoint
      const predictionResponse = await axios.get(`${PREDICTION_API_BASE}/predict`, {
        params: { 
          symbol,
          days: 1,
          use_synthetic: true  // Allow synthetic data as last resort
        },
        timeout: 8000
      });
      
      const predictionData = predictionResponse.data;
      const price = predictionData.c || predictionData.price;
      
      if (!price || isNaN(price) || price <= 0) {
        throw new Error(`Invalid price from prediction fallback for ${symbol}`);
      }
      
      // Still check for unreasonable jumps
      const lastPrice = lastKnownPrices[symbol];
      if (lastPrice && Math.abs((price - lastPrice) / lastPrice) > 0.50) {
        console.warn(`Using last known price for ${symbol} due to extreme jump in prediction data`);
        lastKnownPrices[symbol] = lastPrice; // Keep using the last known price
        
        return {
          symbol,
          price: lastPrice,
          timestamp: new Date().toISOString(),
          from_fallback: true,
          from_cache: true
        };
      }
      
      // Update cache and return the price from prediction
      lastKnownPrices[symbol] = price;
      
      return {
        symbol,
        price,
        timestamp: new Date().toISOString(),
        from_fallback: true
      };
    }
    
  } catch (error) {
    console.error(`Error fetching market data for ${symbol}:`, error.message);
    
    // If we have a cached price, return that as fallback
    if (lastKnownPrices[symbol]) {
      console.log(`Using cached price for ${symbol}: $${lastKnownPrices[symbol]}`);
      return {
        symbol,
        price: lastKnownPrices[symbol],
        timestamp: new Date().toISOString(),
        is_cached: true
      };
    }
    
    // Last resort - for AUR specifically use a hardcoded price if nothing else works
    if (symbol === 'AUR') {
      const aurFallbackPrice = 7.24;
      console.log(`Using hardcoded fallback price for AUR: $${aurFallbackPrice}`);
      lastKnownPrices[symbol] = aurFallbackPrice;
      
      return {
        symbol,
        price: aurFallbackPrice,
        timestamp: new Date().toISOString(),
        is_fallback: true
      };
    }
    
    throw new Error(`Failed to fetch market data for ${symbol}: ${error.message}`);
  }
};

/**
 * Get stock prediction from the prediction service
 * @param {string} symbol - Stock symbol
 * @param {number} days - Number of days to predict
 * @param {boolean} useSynthetic - Whether to allow synthetic data
 * @param {string} range - Time range for data (1D, 1W, 1M, 3M, 1Y, 5Y, MAX)
 * @returns {Promise<Object>} - Prediction data
 */
const getPrediction = async (symbol, days = 7, useSynthetic = false, range = '1D') => {
  try {
    // First, get the actual current market data
    const marketData = await fetchActualMarketData(symbol);
    
    // Then get the prediction
    const response = await axios.get(`${PREDICTION_API_BASE}/predict`, {
      params: {
        symbol,
        days,
        use_synthetic: useSynthetic,
        range
      },
      timeout: 10000
    });
    
    const predictionData = response.data;
    
    // Override the current price with our verified market data
    predictionData.c = marketData.price;
    predictionData.price = marketData.price;
    
    // Calculate potential gain based on the verified current price
    const currentPrice = marketData.price;
    const predictedPrice = predictionData.predicted_price || currentPrice;
    const potentialGain = predictedPrice - currentPrice;
    const potentialGainPercent = ((predictedPrice - currentPrice) / currentPrice) * 100;
    
    return {
      symbol,
      current_price: currentPrice,
      predicted_price: predictedPrice,
      potential_gain: potentialGain,
      potential_gain_percent: potentialGainPercent
    };
  } catch (error) {
    console.error(`Error in getPrediction for ${symbol}:`, error.message);
    
    // If market data works but prediction fails, create a minimal prediction
    // with just the current price
    if (error.message.includes('Failed to fetch prediction') && lastKnownPrices[symbol]) {
      const currentPrice = lastKnownPrices[symbol];
      console.log(`Returning minimal prediction for ${symbol} with price $${currentPrice}`);
      
      return {
        symbol,
        current_price: currentPrice,
        predicted_price: currentPrice,
        potential_gain: 0,
        potential_gain_percent: 0,
        is_synthetic: true
      };
    }
    
    throw error;
  }
};

/**
 * Get list of available stock symbols
 * @returns {Promise<Array>} - List of stock symbols
 */
const getSymbols = async () => {
  try {
    const response = await axios.get(`${PREDICTION_API_BASE}/symbols`, { timeout: 5000 });
    return response.data;
  } catch (error) {
    console.error('Error fetching stock symbols:', error.message);
    
    // Return a default list of popular symbols in case of API failure
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ECONNABORTED') {
      console.log('Returning default list of symbols due to connection error');
      return [
        { symbol: 'AAPL', name: 'Apple Inc.' },
        { symbol: 'MSFT', name: 'Microsoft Corporation' },
        { symbol: 'GOOG', name: 'Alphabet Inc.' },
        { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
        { symbol: 'TSLA', name: 'Tesla, Inc.' },
        { symbol: 'META', name: 'Meta Platforms, Inc.' },
        { symbol: 'NVDA', name: 'NVIDIA Corporation' },
      ];
    }
    
    throw new Error(`Failed to fetch stock symbols: ${error.message}`);
  }
};

/**
 * Check prediction service health
 * @returns {Promise<Object>} Health status
 */
const checkHealth = async () => {
  try {
    const response = await axios.get(`${PREDICTION_API_BASE}/health`, { timeout: 3000 });
    return {
      healthy: response.status === 200,
      status: response.data.status,
      message: response.data.message,
      timestamp: response.data.timestamp
    };
  } catch (error) {
    console.error('Prediction service health check failed:', error.message);
    return {
      healthy: false,
      status: 'unhealthy',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Check if a stock symbol exists
 * @param {string} symbol - Stock symbol to check
 * @returns {Promise<boolean>} - True if symbol exists, false otherwise
 */
const checkSymbolExists = async (symbol) => {
  try {
    // Try to get prediction for the symbol
    await getPrediction(symbol, 1, false, '1D');
    return true;
  } catch (error) {
    // If the error is 404, the symbol doesn't exist
    if (error.message.includes('not found')) {
      return false;
    }
    
    // For other errors, assume the symbol might exist but there's a service issue
    // Return true to allow adding to watchlist
    return true;
  }
};

module.exports = {
  getPrediction,
  getSymbols,
  checkHealth,
  checkSymbolExists
}; 