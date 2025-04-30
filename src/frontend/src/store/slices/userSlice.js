import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks
export const fetchUserProfile = createAsyncThunk(
  'user/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/users/profile');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch profile');
    }
  }
);

export const addFunds = createAsyncThunk(
  'user/addFunds',
  async (amount, { rejectWithValue }) => {
    try {
      const response = await api.post('/users/funds', { amount });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to add funds');
    }
  }
);

export const updateSettings = createAsyncThunk(
  'user/updateSettings',
  async (settings, { rejectWithValue }) => {
    try {
      const response = await api.put('/users/settings', settings);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update settings');
    }
  }
);

// User slice
const userSlice = createSlice({
  name: 'user',
  initialState: {
    profile: null,
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
      // Fetch profile
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Add funds
      .addCase(addFunds.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addFunds.fulfilled, (state, action) => {
        state.loading = false;
        if (state.profile) {
          state.profile.balance = action.payload.balance;
        }
      })
      .addCase(addFunds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Update settings
      .addCase(updateSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.loading = false;
        if (state.profile) {
          state.profile.investment_limit = action.payload.investment_limit;
          state.profile.daily_limit = action.payload.daily_limit;
        }
      })
      .addCase(updateSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = userSlice.actions;
export default userSlice.reducer; 