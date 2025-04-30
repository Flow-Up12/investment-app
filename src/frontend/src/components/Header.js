import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

const Header = () => {
  const { profile } = useSelector((state) => state.user);
  
  // Safe way to format balance
  const formatBalance = () => {
    if (profile && profile.balance !== null && profile.balance !== undefined) {
      return `$${parseFloat(profile.balance).toFixed(2)}`;
    }
    return '$0.00';
  };
  
  return (
    <header className="bg-primary-600 text-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">Invest App</Link>
        
        <nav className="hidden md:flex space-x-6">
          <Link to="/" className="hover:text-primary-200 transition-colors">Dashboard</Link>
          <Link to="/stocks" className="hover:text-primary-200 transition-colors">Stocks</Link>
          <Link to="/portfolio" className="hover:text-primary-200 transition-colors">Portfolio</Link>
          <Link to="/transactions" className="hover:text-primary-200 transition-colors">Transactions</Link>
          <Link to="/trading-bot" className="hover:text-primary-200 transition-colors">Trading Bot</Link>
          <Link to="/settings" className="hover:text-primary-200 transition-colors">Settings</Link>
        </nav>
        
        <div className="flex items-center space-x-4">
          <div className="bg-primary-700 px-3 py-1 rounded-full">
            Balance: {formatBalance()}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 