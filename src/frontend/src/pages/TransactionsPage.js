import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchTransactions } from '../store/slices/portfolioSlice';
import Header from '../components/Header';

const TransactionsPage = () => {
  const dispatch = useDispatch();
  const { transactions, loading, error } = useSelector((state) => state.portfolio);
  const [source, setSource] = useState('all'); // 'all', 'manual', 'bot'
  
  useEffect(() => {
    dispatch(fetchTransactions());
  }, [dispatch]);
  
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter transactions based on source
  const filteredTransactions = source === 'all' 
    ? transactions 
    : transactions.filter(t => source === 'bot' ? t.is_bot : !t.is_bot);
  
  return (
    <div>
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Transaction History</h1>
          
          <div className="flex space-x-2">
            <button 
              className={`px-4 py-2 rounded ${source === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setSource('all')}
            >
              All Transactions
            </button>
            <button 
              className={`px-4 py-2 rounded ${source === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setSource('manual')}
            >
              Manual Trades
            </button>
            <button 
              className={`px-4 py-2 rounded ${source === 'bot' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setSource('bot')}
            >
              Bot Trades
            </button>
          </div>
        </div>
        
        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-6">{error}</div>}
        
        {loading ? (
          <div className="card p-6 text-center">Loading transaction data...</div>
        ) : (
          <>
            {filteredTransactions.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-gray-500 mb-4">
                  {source === 'all' 
                    ? "You don't have any transactions yet." 
                    : source === 'bot' 
                      ? "No bot transactions found." 
                      : "No manual transactions found."}
                </p>
                <a href="/stocks" className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded">
                  Start Investing
                </a>
              </div>
            ) : (
              <div className="card">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-3 px-4 text-left font-semibold">Date</th>
                        <th className="py-3 px-4 text-left font-semibold">Symbol</th>
                        <th className="py-3 px-4 text-left font-semibold">Type</th>
                        <th className="py-3 px-4 text-center font-semibold">Source</th>
                        <th className="py-3 px-4 text-right font-semibold">Shares</th>
                        <th className="py-3 px-4 text-right font-semibold">Price</th>
                        <th className="py-3 px-4 text-right font-semibold">Total</th>
                        <th className="py-3 px-4 text-right font-semibold">Profit/Loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((transaction) => (
                        <tr key={transaction.id} className="border-t hover:bg-gray-50">
                          <td className="py-3 px-4">{formatDate(transaction.date)}</td>
                          <td className="py-3 px-4 font-medium">{transaction.symbol}</td>
                          <td className={`py-3 px-4 ${transaction.type === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.type}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${transaction.is_bot ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                              {transaction.is_bot ? 'Bot' : 'Manual'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">{parseFloat(transaction.shares).toFixed(4)}</td>
                          <td className="py-3 px-4 text-right">{formatCurrency(transaction.price)}</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(transaction.total_amount)}</td>
                          <td className="py-3 px-4 text-right">
                            {transaction.type === 'SELL' && transaction.profit != null ? (
                              <span className={transaction.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(transaction.profit)} 
                                {transaction.profit_percentage != null && (
                                  <span className="text-xs ml-1">
                                    ({transaction.profit_percentage >= 0 ? '+' : ''}{transaction.profit_percentage.toFixed(2)}%)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TransactionsPage; 