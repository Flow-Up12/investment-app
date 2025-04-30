import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedStock } from '../store/slices/stocksSlice';

const WatchlistManager = ({ onSelectStock }) => {
  const [watchlist, setWatchlist] = useState([]);
  
  useEffect(() => {
    // Load watchlist from local storage
    const savedWatchlist = localStorage.getItem('watchlist');
    if (savedWatchlist) {
      setWatchlist(JSON.parse(savedWatchlist));
    }
  }, []);
  
  const addToWatchlist = (stock) => {
    const updatedWatchlist = [...watchlist];
    
    // Check if stock is already in watchlist
    if (!updatedWatchlist.some(item => item.symbol === stock.symbol)) {
      updatedWatchlist.push(stock);
      setWatchlist(updatedWatchlist);
      localStorage.setItem('watchlist', JSON.stringify(updatedWatchlist));
    }
  };
  
  const removeFromWatchlist = (symbol) => {
    const updatedWatchlist = watchlist.filter(item => item.symbol !== symbol);
    setWatchlist(updatedWatchlist);
    localStorage.setItem('watchlist', JSON.stringify(updatedWatchlist));
  };
  
  const handleSelectStock = (symbol) => {
    if (onSelectStock) {
      onSelectStock(symbol);
    }
  };
  
  return {
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    
    WatchlistDisplay: () => (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-xl font-semibold mb-4">My Watchlist</h2>
        
        {watchlist.length > 0 ? (
          <div className="divide-y divide-gray-200">
            <div className="pb-2 font-medium">
              <div className="grid grid-cols-4">
                <div>Symbol</div>
                <div>Name</div>
                <div className="text-right">Actions</div>
              </div>
            </div>
            
            {watchlist.map(stock => (
              <div key={stock.symbol} className="py-2">
                <div className="grid grid-cols-4 items-center">
                  <div className="font-medium">
                    <button 
                      onClick={() => handleSelectStock(stock.symbol)}
                      className="text-primary-600 hover:underline"
                    >
                      {stock.symbol}
                    </button>
                  </div>
                  <div className="col-span-2">{stock.name}</div>
                  <div className="text-right">
                    <button
                      onClick={() => removeFromWatchlist(stock.symbol)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500">
            You haven't added any stocks to your watchlist yet
          </div>
        )}
      </div>
    )
  };
};

export default WatchlistManager; 