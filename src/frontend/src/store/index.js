import { configureStore } from '@reduxjs/toolkit';
import userReducer from './slices/userSlice';
import stocksReducer from './slices/stocksSlice';
import portfolioReducer from './slices/portfolioSlice';

const store = configureStore({
  reducer: {
    user: userReducer,
    stocks: stocksReducer,
    portfolio: portfolioReducer,
  },
});

export default store; 