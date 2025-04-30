import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchTransactions } from '../store/slices/portfolioSlice';
import Header from '../components/Header';

const TransactionsPage = () => {
  const dispatch = useDispatch();
  const { transactions, loading, error } = useSelector((state) => state.portfolio);
  
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
  
  return (
    <div>
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Transaction History</h1>
        
        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-6">{error}</div>}
        
        {loading ? (
          <div className="card p-6 text-center">Loading transaction data...</div>
        ) : (
          <>
            {transactions.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-gray-500 mb-4">You don't have any transactions yet.</p>
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
                        <th className="py-3 px-4 text-right font-semibold">Shares</th>
                        <th className="py-3 px-4 text-right font-semibold">Price</th>
                        <th className="py-3 px-4 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="border-t hover:bg-gray-50">
                          <td className="py-3 px-4">{formatDate(transaction.date)}</td>
                          <td className="py-3 px-4 font-medium">{transaction.symbol}</td>
                          <td className={`py-3 px-4 ${transaction.type === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.type}
                          </td>
                          <td className="py-3 px-4 text-right">{transaction.shares}</td>
                          <td className="py-3 px-4 text-right">{formatCurrency(transaction.price)}</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(transaction.total_amount)}</td>
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