import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks
export const fetchPortfolio = createAsyncThunk(
  'portfolio/fetchPortfolio',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/stocks/portfolio');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch portfolio');
    }
  }
);

export const fetchPortfolioSummary = createAsyncThunk(
  'portfolio/fetchSummary',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/users/portfolio-summary');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch portfolio summary');
    }
  }
);

export const fetchTransactions = createAsyncThunk(
  'portfolio/fetchTransactions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/users/transactions');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch transactions');
    }
  }
);

// Portfolio slice
const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState: {
    holdings: [],
    summary: null,
    transactions: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch portfolio
      .addCase(fetchPortfolio.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPortfolio.fulfilled, (state, action) => {
        state.loading = false;
        state.holdings = action.payload;
      })
      .addCase(fetchPortfolio.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch portfolio summary
      .addCase(fetchPortfolioSummary.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPortfolioSummary.fulfilled, (state, action) => {
        state.loading = false;
        state.summary = action.payload;
      })
      .addCase(fetchPortfolioSummary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch transactions
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = portfolioSlice.actions;
export default portfolioSlice.reducer; 