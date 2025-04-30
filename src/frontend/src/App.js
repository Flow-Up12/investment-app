import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { fetchUserProfile } from './store/slices/userSlice';

// Pages
import Dashboard from './pages/Dashboard';
import StocksPage from './pages/StocksPage';
import PortfolioPage from './pages/PortfolioPage';
import TransactionsPage from './pages/TransactionsPage';
import SettingsPage from './pages/SettingsPage';
import TradingBotPage from './pages/TradingBotPage';
import StockDetailPage from './pages/StockDetailPage';

function App() {
  const dispatch = useDispatch();
  
  // Fetch user profile when app loads
  useEffect(() => {
    dispatch(fetchUserProfile());
  }, [dispatch]);
  
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/stocks" element={<StocksPage />} />
      <Route path="/stocks/:symbol" element={<StockDetailPage />} />
      <Route path="/portfolio" element={<PortfolioPage />} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/trading-bot" element={<TradingBotPage />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App; 