import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setSelectedStock, fetchStockPrediction } from '../store/slices/stocksSlice';
import Header from '../components/Header';
import StockSearch from '../components/StockSearch';
import StockPrediction from '../components/StockPrediction';
import WatchlistManager from '../components/WatchlistManager';
import { fetchTopMovers } from '../store/slices/stocksSlice';
import { fetchPortfolio } from '../store/slices/portfolioSlice';

const StocksPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selectedStock, topMovers, prediction } = useSelector((state) => state.stocks);
  const { holdings } = useSelector((state) => state.portfolio);
  const [activeTab, setActiveTab] = useState('search'); // 'search', 'movers', 'portfolio', or 'watchlist'
  const [timeRange, setTimeRange] = useState('1D'); // '1D', '1W', '1M', '3M', '1Y', '5Y', 'MAX'
  
  // Initialize watchlist manager
  const watchlistManager = WatchlistManager({ onSelectStock: handleSelectStock });
  const { watchlist, addToWatchlist, removeFromWatchlist, WatchlistDisplay } = watchlistManager;
  
  useEffect(() => {
    // Fetch top movers and portfolio when component mounts
    dispatch(fetchTopMovers());
    dispatch(fetchPortfolio());
  }, [dispatch]);
  
  // When time range changes, fetch updated prediction data
  useEffect(() => {
    if (selectedStock) {
      dispatch(fetchStockPrediction({
        symbol: selectedStock,
        range: timeRange
      }));
    }
  }, [selectedStock, timeRange, dispatch]);
  
  function handleSelectStock(symbol) {
    dispatch(setSelectedStock(symbol));
    // Reset time range to 1D when new stock is selected
    setTimeRange('1D');
  }
  
  const handleViewDetails = (symbol) => {
    navigate(`/stocks/${symbol}`);
  };

  // Calculate price change from prediction data
  const getPriceChange = () => {
    if (!prediction || !prediction.current_price) return { value: '0.00', percent: '0.00', isPositive: true };
    
    const currentPrice = prediction.current_price;
    const previousPrice = prediction.historical_data?.prices?.[0] || currentPrice;
    const change = currentPrice - previousPrice;
    const percentChange = (change / previousPrice) * 100;
    
    return {
      value: change.toFixed(2),
      percent: percentChange.toFixed(2),
      isPositive: change >= 0
    };
  };

  const priceChange = getPriceChange();
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <Header />
      
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Stock Predictions</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm mb-4">
              <nav className="flex border-b">
                <button 
                  className={`flex-1 py-3 text-center font-medium text-sm ${activeTab === 'search' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'}`}
                  onClick={() => setActiveTab('search')}
                >
                  Search
                </button>
                <button 
                  className={`flex-1 py-3 text-center font-medium text-sm ${activeTab === 'watchlist' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'}`}
                  onClick={() => setActiveTab('watchlist')}
                >
                  Watchlist
                </button>
                <button 
                  className={`flex-1 py-3 text-center font-medium text-sm ${activeTab === 'movers' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'}`}
                  onClick={() => setActiveTab('movers')}
                >
                  Market
                </button>
                <button 
                  className={`flex-1 py-3 text-center font-medium text-sm ${activeTab === 'portfolio' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'}`}
                  onClick={() => setActiveTab('portfolio')}
                >
                  Portfolio
                </button>
              </nav>
            </div>
            
            {activeTab === 'search' ? (
              <StockSearch 
                onSelectStock={handleSelectStock} 
                onAddToWatchlist={addToWatchlist}
              />
            ) : activeTab === 'movers' ? (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h2 className="text-lg font-medium mb-4">Top Market Movers</h2>
                {topMovers && topMovers.length > 0 ? (
                  <div className="space-y-3">
                    {topMovers.map(stock => (
                      <div key={stock.symbol} className="border-b border-gray-100 pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <button 
                              onClick={() => handleSelectStock(stock.symbol)}
                              className="font-medium text-gray-900 hover:text-blue-600"
                            >
                              {stock.symbol}
                            </button>
                            <div className="text-sm text-gray-500">{stock.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${stock.price.toFixed(2)}</div>
                            <div className={`text-sm ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {stock.change >= 0 ? '+' : ''}{stock.percentChange.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                        <div className="mt-1 flex justify-end">
                          <button
                            onClick={() => addToWatchlist({
                              symbol: stock.symbol,
                              name: stock.name || 'Unknown',
                              price: stock.price
                            })}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            + Add to Watchlist
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <div className="animate-pulse">Loading market movers...</div>
                  </div>
                )}
              </div>
            ) : activeTab === 'watchlist' ? (
              <WatchlistDisplay />
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h2 className="text-lg font-medium mb-4">My Portfolio</h2>
                {holdings && holdings.length > 0 ? (
                  <div className="space-y-3">
                    {holdings.map(stock => (
                      <div key={stock.symbol} className="border-b border-gray-100 pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <button 
                              onClick={() => handleSelectStock(stock.symbol)}
                              className="font-medium text-gray-900 hover:text-blue-600"
                            >
                              {stock.symbol}
                            </button>
                            <div className="text-sm text-gray-500">
                              {parseFloat(stock.shares).toFixed(2)} shares
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${parseFloat(stock.current_value).toFixed(2)}</div>
                            <div className={`text-sm ${stock.change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {stock.change_percent ? 
                                `${stock.change_percent >= 0 ? '+' : ''}${stock.change_percent.toFixed(2)}%` : 
                                '0.00%'}
                            </div>
                          </div>
                        </div>
                        <div className="mt-1 flex justify-end">
                          <button
                            onClick={() => addToWatchlist({
                              symbol: stock.symbol,
                              name: stock.company_name || 'Unknown'
                            })}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            + Add to Watchlist
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <p>You don't own any stocks yet</p>
                    <button 
                      onClick={() => setActiveTab('search')}
                      className="mt-2 text-blue-600 hover:text-blue-800"
                    >
                      Find stocks to buy →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="lg:col-span-3">
            {selectedStock ? (
              <div className="bg-white rounded-lg shadow-sm p-5">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedStock}</h2>
                    {prediction && (
                      <>
                        <p className="text-3xl font-bold my-2">${prediction.current_price ? prediction.current_price.toFixed(2) : '0.00'}</p>
                        <p className={`text-sm ${priceChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {priceChange.isPositive ? '+' : ''}{priceChange.value} ({priceChange.isPositive ? '+' : ''}{priceChange.percent}%)
                        </p>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => handleViewDetails(selectedStock)}
                    className="bg-[#00C805] hover:bg-[#00b305] text-white px-4 py-2 text-sm rounded-full font-medium transition-colors"
                  >
                    Buy Stock
                  </button>
                </div>
                
                {/* Time Range Selector - Robinhood style */}
                <div className="flex justify-start mb-4 border-b pb-2">
                  {['1H', '1D', '1W', '1M', '3M', '1Y', '5Y', 'ALL'].map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`mr-4 px-2 py-1 text-sm font-medium rounded-lg ${
                        timeRange === range 
                          ? 'bg-[#F5F8FA] text-black font-semibold border-b-2 border-black' 
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
                
                <StockPrediction 
                  symbol={selectedStock} 
                  timeRange={timeRange}
                />
                
                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => addToWatchlist({
                      symbol: selectedStock,
                      name: prediction?.company_name || 'Unknown',
                      price: prediction?.current_price
                    })}
                    className="border border-[#00C805] text-[#00C805] hover:bg-[#E6F5EC] px-5 py-2 rounded-full font-medium transition-colors"
                  >
                    Add to Watchlist
                  </button>
                  <button
                    onClick={() => handleViewDetails(selectedStock)}
                    className="text-[#00C805] hover:text-[#00b305] px-5 py-2 font-medium"
                  >
                    View Detailed Analysis →
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center flex flex-col items-center justify-center min-h-[400px]">
                <svg className="w-20 h-20 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-gray-500 mb-2">Select a stock to view prediction data</p>
                <p className="text-sm text-gray-400">Find stocks by using the search tool or select from your watchlist</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StocksPage; 