import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchStockSymbols, setSelectedStock } from '../store/slices/stocksSlice';

const StockSelector = () => {
  const dispatch = useDispatch();
  const { symbols, selectedStock, loading, error } = useSelector((state) => state.stocks);
  
  useEffect(() => {
    dispatch(fetchStockSymbols());
  }, [dispatch]);
  
  const handleStockSelect = (e) => {
    const symbol = e.target.value;
    if (symbol) {
      dispatch(setSelectedStock(symbol));
    }
  };
  
  if (loading) {
    return <div className="card p-4">Loading stock symbols...</div>;
  }
  
  if (error) {
    return <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>;
  }
  
  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Select a Stock</h2>
      
      <div className="mb-4">
        <select
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={selectedStock || ''}
          onChange={handleStockSelect}
        >
          <option value="">-- Select a stock --</option>
          {symbols.map((stock) => (
            <option key={stock.symbol} value={stock.symbol}>
              {stock.symbol} - {stock.name}
            </option>
          ))}
        </select>
      </div>
      
      <p className="text-sm text-gray-500">
        Select a stock to view its prediction data and make investment decisions.
      </p>
    </div>
  );
};

export default StockSelector; 