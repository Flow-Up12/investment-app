import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchPortfolio, fetchPortfolioSummary } from '../store/slices/portfolioSlice';
import Header from '../components/Header';
import PortfolioList from '../components/PortfolioList';

const PortfolioPage = () => {
  const dispatch = useDispatch();
  const { holdings, summary, loading, error } = useSelector((state) => state.portfolio);
  
  useEffect(() => {
    dispatch(fetchPortfolio());
    dispatch(fetchPortfolioSummary());
  }, [dispatch]);
  
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };
  
  return (
    <div>
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Portfolio</h1>
        
        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-6">{error}</div>}
        
        {loading ? (
          <div className="card p-6 text-center">Loading portfolio data...</div>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="card flex flex-col items-center justify-center">
                  <h2 className="text-xl font-semibold mb-2">Total Investment</h2>
                  <p className="text-3xl text-primary-600">{formatCurrency(summary.totalInvestment)}</p>
                </div>
                
                <div className="card flex flex-col items-center justify-center">
                  <h2 className="text-xl font-semibold mb-2">Cash Balance</h2>
                  <p className="text-3xl text-primary-600">{formatCurrency(summary.cash)}</p>
                </div>
                
                <div className="card flex flex-col items-center justify-center">
                  <h2 className="text-xl font-semibold mb-2">Total Value</h2>
                  <p className="text-3xl text-primary-600">{formatCurrency(summary.totalValue)}</p>
                </div>
              </div>
            )}
            
            <PortfolioList />
            
            {holdings.length === 0 && (
              <div className="card p-6 text-center mt-6">
                <p className="text-gray-500 mb-4">You don't have any stocks in your portfolio yet.</p>
                <a href="/stocks" className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded">
                  Go to Stocks
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PortfolioPage; 