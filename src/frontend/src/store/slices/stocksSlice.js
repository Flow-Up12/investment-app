import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks
export const fetchStockSymbols = createAsyncThunk(
  'stocks/fetchSymbols',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/stocks/symbols');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch stock symbols');
    }
  }
);

export const fetchStockPrediction = createAsyncThunk(
  'stocks/fetchPrediction',
  async (payload, { rejectWithValue }) => {
    try {
      // Handle both string input and object with options
      let symbol;
      let useSynthetic = false;
      
      if (typeof payload === 'string') {
        symbol = payload;
      } else {
        symbol = payload.symbol;
        useSynthetic = payload.useSynthetic || false;
      }
      
      // Add the use_synthetic parameter to control whether synthetic data should be used
      const response = await api.get(`/stocks/predict/${symbol}`, {
        params: { use_synthetic: useSynthetic }
      });
      return response.data;
    } catch (error) {
      if (error.response?.data?.can_use_synthetic) {
        // Special case: real data failed but synthetic is available
        return rejectWithValue({
          error: error.response.data.error,
          can_use_synthetic: true,
          symbol: typeof payload === 'string' ? payload : payload.symbol
        });
      }
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch stock prediction');
    }
  }
);

export const buyStock = createAsyncThunk(
  'stocks/buyStock',
  async ({ symbol, shares }, { rejectWithValue }) => {
    try {
      const response = await api.post('/stocks/buy', { symbol, shares });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to buy stock');
    }
  }
);

export const sellStock = createAsyncThunk(
  'stocks/sellStock',
  async ({ symbol, shares }, { rejectWithValue }) => {
    try {
      const response = await api.post('/stocks/sell', { symbol, shares });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to sell stock');
    }
  }
);

export const fetchTopMovers = createAsyncThunk(
  'stocks/fetchTopMovers',
  async (_, { rejectWithValue }) => {
    try {
      // Use the actual API endpoint now that it's available
      const response = await api.get('/stocks/top-movers');
      return response.data;
    } catch (error) {
      // If the error response contains fallback data, use that instead of rejecting
      if (error.response?.data?.fallback) {
        return error.response.data.fallback;
      }
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch top movers');
    }
  }
);

// Stocks slice
const stocksSlice = createSlice({
  name: 'stocks',
  initialState: {
    symbols: [],
    selectedStock: null,
    prediction: null,
    topMovers: [],
    loading: false,
    error: null,
    transactionMessage: null,
  },
  reducers: {
    setSelectedStock: (state, action) => {
      state.selectedStock = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearTransactionMessage: (state) => {
      state.transactionMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch symbols
      .addCase(fetchStockSymbols.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStockSymbols.fulfilled, (state, action) => {
        state.loading = false;
        state.symbols = action.payload;
      })
      .addCase(fetchStockSymbols.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch prediction
      .addCase(fetchStockPrediction.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.prediction = null;
      })
      .addCase(fetchStockPrediction.fulfilled, (state, action) => {
        state.loading = false;
        state.prediction = action.payload;
      })
      .addCase(fetchStockPrediction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Buy stock
      .addCase(buyStock.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.transactionMessage = null;
      })
      .addCase(buyStock.fulfilled, (state, action) => {
        state.loading = false;
        state.transactionMessage = action.payload.message;
      })
      .addCase(buyStock.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Sell stock
      .addCase(sellStock.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.transactionMessage = null;
      })
      .addCase(sellStock.fulfilled, (state, action) => {
        state.loading = false;
        state.transactionMessage = action.payload.message;
      })
      .addCase(sellStock.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch top movers
      .addCase(fetchTopMovers.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchTopMovers.fulfilled, (state, action) => {
        state.topMovers = action.payload;
      })
      .addCase(fetchTopMovers.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { setSelectedStock, clearError, clearTransactionMessage } = stocksSlice.actions;
export default stocksSlice.reducer; 