import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import api from '../services/api';
import { debounce } from 'lodash';

const StockSearch = ({ onSelectStock, onAddToWatchlist }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('symbol'); // 'symbol' or 'name'
  
  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery) => {
      if (!searchQuery || searchQuery.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await api.get('/stocks/search-symbol', {
          params: { q: searchQuery }
        });
        
        // Format results
        const formattedResults = response.data.map(item => ({
          symbol: item.symbol || item.displaySymbol,
          name: item.name || item.description || 'Unknown Company',
          type: item.type || 'Stock',
          synthetic: item.synthetic || false
        }));
        
        setResults(formattedResults);
      } catch (err) {
        console.error('Error searching stocks:', err);
        setError('Failed to search for stocks. Please try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500),
    []
  );
  
  // Update search results when query changes
  useEffect(() => {
    debouncedSearch(query);
    
    // Clean up any pending calls on unmount
    return () => debouncedSearch.cancel();
  }, [query, debouncedSearch]);
  
  const handleQueryChange = (e) => {
    setQuery(e.target.value);
  };
  
  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
  };
  
  const handleSelectStock = (symbol) => {
    if (onSelectStock) {
      onSelectStock(symbol);
    }
  };
  
  const handleAddToWatchlist = (stock) => {
    if (onAddToWatchlist) {
      onAddToWatchlist(stock);
    }
  };
  
  const handleSort = (sortBy) => {
    setSort(sortBy);
    if (sortBy === 'symbol') {
      setResults([...results].sort((a, b) => a.symbol.localeCompare(b.symbol)));
    } else if (sortBy === 'name') {
      setResults([...results].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-xl font-semibold mb-4">Search Stocks</h2>
      
      <div className="mb-4 relative">
        <div className="flex">
          <input
            type="text"
            placeholder="Search by symbol or name..."
            value={query}
            onChange={handleQueryChange}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {query && (
            <button 
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">Enter at least 2 characters to search</p>
      </div>
      
      {loading ? (
        <div className="p-4 text-center text-gray-500">
          <p>Searching for stocks...</p>
        </div>
      ) : error ? (
        <div className="p-4 text-center text-red-500">
          <p>{error}</p>
        </div>
      ) : results.length > 0 ? (
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-gray-600">{results.length} results</p>
            <div className="text-sm">
              Sort by: 
              <button 
                onClick={() => handleSort('symbol')} 
                className={`ml-2 ${sort === 'symbol' ? 'font-bold text-primary-600' : 'text-gray-600'}`}
              >
                Symbol
              </button>
              <span className="mx-1">|</span>
              <button 
                onClick={() => handleSort('name')} 
                className={`${sort === 'name' ? 'font-bold text-primary-600' : 'text-gray-600'}`}
              >
                Name
              </button>
            </div>
          </div>
          
          <div className="divide-y divide-gray-200 max-h-[400px] overflow-y-auto">
            {results.map(stock => (
              <div key={stock.symbol} className="py-2">
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => handleSelectStock(stock.symbol)}
                    className="flex-grow text-left hover:bg-gray-50 p-1 rounded"
                  >
                    <div className="font-medium text-primary-600">{stock.symbol}</div>
                    <div className="text-sm text-gray-600">{stock.name}</div>
                    {stock.synthetic && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                        Demo
                      </span>
                    )}
                  </button>
                  
                  <div className="ml-2">
                    <button 
                      onClick={() => handleAddToWatchlist(stock)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                      title="Add to watchlist"
                    >
                      + Watch
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : query.length >= 2 ? (
        <div className="p-4 text-center text-gray-500">
          <p>No matching stocks found</p>
        </div>
      ) : null}
    </div>
  );
};

export default StockSearch; 