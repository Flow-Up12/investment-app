import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchStockPrediction, sellStock } from '../store/slices/stocksSlice';
import { fetchPortfolio } from '../store/slices/portfolioSlice';

const PortfolioList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { holdings } = useSelector((state) => state.portfolio);
  const { loading, error, transactionMessage } = useSelector((state) => state.stocks);
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [sharesToSell, setSharesToSell] = useState('');
  const [loadingStocks, setLoadingStocks] = useState({});

  const handleSellClick = (stock, e) => {
    e.stopPropagation(); // Prevent row click event
    setSelectedStock(stock);
    setSharesToSell('');
    setSellModalOpen(true);
  };
  
  const handleStockClick = (symbol) => {
    navigate(`/stocks/${symbol}`);
  };

  const handleSellSubmit = (e) => {
    e.preventDefault();
    
    dispatch(sellStock({
      symbol: selectedStock.symbol,
      shares: sharesToSell
    })).then(() => {
      dispatch(fetchPortfolio());
      setSellModalOpen(false);
    });
  };

  const formatCurrency = (value) => {
    // Handle null, undefined, or NaN values
    if (value === null || value === undefined || isNaN(value)) {
      return '$0.00';
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatPercentage = (value) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00%';
    }
    return `${value.toFixed(2)}%`;
  };

  // Safe value display helper function
  const safeValue = (value, defaultValue = 0) => {
    return value !== null && value !== undefined && !isNaN(value) ? value : defaultValue;
  };

  return (
    <div className="mt-6">
      <h2 className="text-2xl font-semibold mb-4">Your Portfolio</h2>
      
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
      {transactionMessage && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{transactionMessage}</div>}
      
      {holdings.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-gray-500">You don't have any stocks in your portfolio yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-md">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-3 px-4 text-left font-semibold">Symbol</th>
                <th className="py-3 px-4 text-right font-semibold">Shares</th>
                <th className="py-3 px-4 text-right font-semibold">Avg. Price</th>
                <th className="py-3 px-4 text-right font-semibold">Current Price</th>
                <th className="py-3 px-4 text-right font-semibold">Total Value</th>
                <th className="py-3 px-4 text-right font-semibold">Profit/Loss</th>
                <th className="py-3 px-4 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((stock) => (
                <tr 
                  key={stock.id} 
                  className="border-t hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleStockClick(stock.symbol)}
                >
                  <td className="py-3 px-4 font-medium">{stock.symbol}</td>
                  <td className="py-3 px-4 text-right">{safeValue(stock.shares)}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(stock.average_price)}</td>
                  <td className="py-3 px-4 text-right">
                    {stock.current_price !== undefined ? (
                      formatCurrency(stock.current_price)
                    ) : (
                      <span className="text-gray-500">Data unavailable</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {stock.current_value !== undefined ? (
                      formatCurrency(stock.current_value)
                    ) : (
                      formatCurrency(stock.shares * stock.average_price)
                    )}
                  </td>
                  <td className={`py-3 px-4 text-right ${safeValue(stock.profit, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stock.profit !== undefined ? (
                      <>
                        {formatCurrency(stock.profit)} ({formatPercentage(stock.profit_percentage)})
                      </>
                    ) : (
                      <span className="text-gray-500">N/A</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={(e) => handleSellClick(stock, e)}
                      className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded text-sm"
                    >
                      Sell
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Sell Modal */}
      {sellModalOpen && selectedStock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Sell {selectedStock.symbol} Stock</h3>
            
            <div className="mb-4">
              <p className="mb-2">Current Price: {selectedStock.current_price !== undefined ? 
                formatCurrency(selectedStock.current_price) : 
                <span className="text-gray-500">Data unavailable, using average price</span>}
              </p>
              <p className="mb-2">Shares Owned: {safeValue(selectedStock.shares)}</p>
              <p className="mb-2">Total Value: {selectedStock.current_value !== undefined ? 
                formatCurrency(selectedStock.current_value) :
                formatCurrency(selectedStock.shares * selectedStock.average_price)}
              </p>
            </div>
            
            <form onSubmit={handleSellSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Shares to Sell</label>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  max={selectedStock.shares}
                  value={sharesToSell}
                  onChange={(e) => setSharesToSell(e.target.value)}
                  className="input"
                  required
                />
              </div>
              
              {sharesToSell && (
                <div className="mb-4 p-3 bg-gray-100 rounded">
                  <p>Total Value: {formatCurrency(sharesToSell * (selectedStock.current_price || selectedStock.average_price))}</p>
                  {!selectedStock.current_price && 
                    <p className="text-yellow-600 text-sm mt-1">
                      Note: Using average price as current price is unavailable
                    </p>
                  }
                </div>
              )}
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setSellModalOpen(false)}
                  className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                  disabled={loading || !sharesToSell}
                >
                  {loading ? 'Processing...' : 'Sell Shares'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioList; 