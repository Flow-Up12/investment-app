const axios = require('axios');

const PREDICTION_API_BASE = process.env.PREDICTION_API_URL || 'http://prediction:5001';

/**
 * Get stock prediction from the prediction service
 * @param {string} symbol - Stock symbol
 * @param {number} days - Number of days to predict
 * @param {boolean} useSynthetic - Whether to allow synthetic data
 * @returns {Promise<Object>} - Prediction data
 */
const getPrediction = async (symbol, days = 7, useSynthetic = false) => {
  try {
    // Add a timeout to the request to avoid hanging indefinitely
    const response = await axios.get(`${PREDICTION_API_BASE}/predict`, {
      params: {
        symbol,
        days,
        use_synthetic: useSynthetic
      },
      timeout: 10000 // 10 second timeout
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching prediction for ${symbol}:`, error.message);
    
    // Check if it's a timeout error
    if (error.code === 'ECONNABORTED') {
      throw new Error(`Prediction service timed out for ${symbol}. Please try again later.`);
    }
    
    // Check if it's a connection error
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error(`Unable to connect to prediction service. Please check your network or try again later.`);
    }
    
    // If we have a response but it's an error
    if (error.response) {
      const status = error.response.status;
      const errorMessage = error.response.data?.error || error.message;
      
      if (status === 404) {
        throw new Error(`Stock symbol ${symbol} not found or no data available.`);
      } else if (status === 500) {
        // Pass through the can_use_synthetic flag if it exists
        if (error.response.data?.can_use_synthetic) {
          const err = new Error(`Prediction service error: ${errorMessage}`);
          err.can_use_synthetic = true;
          throw err;
        } else {
          throw new Error(`Prediction service error: ${errorMessage}`);
        }
      }
    }
    
    // Generic error
    throw new Error(`Failed to fetch prediction: ${error.message}`);
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

module.exports = {
  getPrediction,
  getSymbols,
  checkHealth
}; 