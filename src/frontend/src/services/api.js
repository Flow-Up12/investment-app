import axios from 'axios';

// Get the API URL from the environment or default to localhost
const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5100/api';

const api = axios.create({
  baseURL: apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Real-time stock price service
export const realTimeStockService = {
  // Get current price for a single stock
  getCurrentPrice: async (symbol) => {
    try {
      const response = await axios.get('/api/stocks/current-price', {
        params: { symbol }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching current price for ${symbol}:`, error);
      throw error;
    }
  },
  
  // Get current prices for multiple stocks
  getBulkPrices: async (symbols) => {
    try {
      const symbolsStr = Array.isArray(symbols) ? symbols.join(',') : symbols;
      const response = await axios.get('/api/stocks/bulk-prices', {
        params: { symbols: symbolsStr }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching bulk prices:`, error);
      throw error;
    }
  },
  
  // Configure periodic updates
  startPeriodicUpdates: (symbols, callback, interval = 30000) => {
    // Initial fetch
    realTimeStockService.getBulkPrices(symbols)
      .then(callback)
      .catch(error => console.error('Error in initial price fetch:', error));
    
    // Set up interval for periodic updates
    const timerId = setInterval(() => {
      realTimeStockService.getBulkPrices(symbols)
        .then(callback)
        .catch(error => console.error('Error in periodic price fetch:', error));
    }, interval);
    
    // Return a function to stop the updates
    return () => clearInterval(timerId);
  }
};

export default api; 