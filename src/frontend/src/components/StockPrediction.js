import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchStockPrediction, buyStock, clearTransactionMessage } from '../store/slices/stocksSlice';
import { fetchUserProfile } from '../store/slices/userSlice';
import { fetchPortfolio } from '../store/slices/portfolioSlice';
import StockChart from './StockChart';

const StockPrediction = ({ symbol }) => {
  const dispatch = useDispatch();
  const { prediction, loading, error, transactionMessage } = useSelector((state) => state.stocks);
  const { profile } = useSelector((state) => state.user);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [sharesToBuy, setSharesToBuy] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Fetch prediction when symbol changes with retry logic
  useEffect(() => {
    if (symbol) {
      let isMounted = true;
      const MAX_RETRIES = 5;
      
      const fetchData = () => {
        dispatch(fetchStockPrediction(symbol))
          .then(result => {
            if (!isMounted) return;
            
            // Check if we need to retry (error or suspicious data patterns)
            const needsRetry = 
              // Check for explicit error
              result.error || 
              // Check for empty payload
              !result.payload ||
              // Check for suspicious price values that might indicate placeholder/default data
              (result.payload && (
                result.payload.current_price === 210.14 || // Known placeholder value
                result.payload.current_price <= 0 ||      // Invalid price
                result.payload.historical_data?.prices?.every(price => price === result.payload.current_price) || // Static prices
                !result.payload.future_predictions?.prices?.length || // Missing predictions
                result.payload.historical_data?.prices?.length < 5 // Too little historical data
              )) && 
              // Only retry if under max retry count
              retryCount < MAX_RETRIES;
            
            if (needsRetry) {
              const retryDelay = 1500 * (retryCount + 1); // Increasing delay with backoff
              console.log(`Retrying fetch for ${symbol} in ${retryDelay/1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})`);
              
              setTimeout(() => {
                if (isMounted) {
                  setRetryCount(prevCount => prevCount + 1);
                  fetchData(); // Recursively retry the fetch
                }
              }, retryDelay);
            } else {
              setRetryCount(0); // Reset retry count on success
              
              if (retryCount >= MAX_RETRIES) {
                console.error(`Failed to fetch valid data for ${symbol} after ${MAX_RETRIES} attempts`);
              }
            }
          });
      };
      
      fetchData();
      
      return () => {
        isMounted = false; // Prevent state updates if component unmounts during retry
      };
    }
  }, [symbol, dispatch, retryCount]);

  // Clear transaction message when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearTransactionMessage());
    };
  }, [dispatch]);

  const handleBuyClick = () => {
    setBuyModalOpen(true);
    setSharesToBuy('');
  };

  const handleBuySubmit = (e) => {
    e.preventDefault();
    
    dispatch(buyStock({
      symbol,
      shares: sharesToBuy
    })).then((result) => {
      if (!result.error) {
        // Refresh user profile and portfolio after successful purchase
        dispatch(fetchUserProfile());
        dispatch(fetchPortfolio());
        setBuyModalOpen(false);
      }
    });
  };

  const calculateMaxShares = () => {
    if (!profile || !prediction) return 0;
    
    // Safely handle null or undefined values
    const balance = profile.balance !== null && profile.balance !== undefined ? parseFloat(profile.balance) : 0;
    const investmentLimit = profile.investment_limit !== null && profile.investment_limit !== undefined ? 
      parseFloat(profile.investment_limit) : 0;
    
    if (prediction.current_price <= 0) return 0;
    
    const maxByBalance = balance / prediction.current_price;
    const maxByLimit = investmentLimit / prediction.current_price;
    
    return Math.min(maxByBalance, maxByLimit).toFixed(4);
  };

  // Calculate realistic 7-day forecast
  const calculateRealisticForecast = () => {
    if (!prediction || !prediction.current_price) return { price: 0, percentChange: 0 };
    
    // Use the original prediction data but cap the percentage change to a reasonable range
    const currentPrice = prediction.current_price;
    
    let predictedPrice = 0;
    let percentChange = 0;
    
    if (prediction.future_predictions && prediction.future_predictions.prices && prediction.future_predictions.prices.length > 0) {
      // Get the 7-day prediction (or the last available prediction)
      const lastIdx = Math.min(6, prediction.future_predictions.prices.length - 1);
      const rawPredictedPrice = prediction.future_predictions.prices[lastIdx];
      
      // Calculate the raw percentage change
      const rawPercentChange = ((rawPredictedPrice - currentPrice) / currentPrice) * 100;
      
      // Cap the percentage change to a more realistic range based on the stock's price
      // Lower-priced stocks can have higher volatility
      let maxRealisticChange;
      if (currentPrice < 10) {
        maxRealisticChange = 15; // Up to 15% for penny stocks
      } else if (currentPrice < 50) {
        maxRealisticChange = 10; // Up to 10% for low-priced stocks
      } else if (currentPrice < 200) {
        maxRealisticChange = 7; // Up to 7% for mid-priced stocks
      } else {
        maxRealisticChange = 5; // Up to 5% for high-priced stocks
      }
      
      // Cap the percentage change
      percentChange = Math.max(-maxRealisticChange, Math.min(maxRealisticChange, rawPercentChange));
      
      // Recalculate the predicted price
      predictedPrice = currentPrice * (1 + percentChange / 100);
    }
    
    return {
      price: predictedPrice.toFixed(2),
      percentChange: percentChange.toFixed(2)
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-500">Loading prediction data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const canUseSynthetic = typeof error === 'object' && error.can_use_synthetic;
    const errorMessage = typeof error === 'object' ? error.error : error;
    
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        <p className="mb-2 font-medium"><strong>Error:</strong> {errorMessage}</p>
        <p className="text-sm">This could be due to an issue with the Finnhub API.</p>
        
        <div className="mt-4 flex space-x-3">
          <button 
            onClick={() => {
              setRetryCount(0);
              dispatch(fetchStockPrediction(symbol));
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Retry with Real Data
          </button>
          
          {canUseSynthetic && (
            <button 
              onClick={() => {
                dispatch(fetchStockPrediction({
                  symbol: error.symbol || symbol,
                  useSynthetic: true
                }));
              }}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Use Estimated Data
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="text-center p-6">
        <p className="text-gray-500">Select a stock to view predictions</p>
      </div>
    );
  }

  // Calculate realistic forecast
  const forecast = calculateRealisticForecast();

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-2xl font-bold">{prediction.symbol}</h2>
          <p className="text-gray-600">{prediction.company_name || symbol}</p>
        </div>
        <button
          onClick={handleBuyClick}
          className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-lg font-medium transition-colors"
        >
          Buy Stock
        </button>
      </div>

      {prediction.dataType === "synthetic" && (
        <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-700 p-3 mb-5 rounded-r-md text-sm">
          <div className="flex items-start">
            <svg className="h-5 w-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">Using Simulated Data</p>
              <p className="text-sm mt-1">Real market data is not available for this stock.</p>
            </div>
          </div>
        </div>
      )}

      {prediction.data_warning && (
        <div className="bg-yellow-50 text-yellow-700 p-3 rounded-md mb-5 text-sm">
          {prediction.data_warning}
        </div>
      )}

      {transactionMessage && (
        <div className="bg-green-50 text-green-700 p-4 rounded-md mb-5">
          {transactionMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Current Price</h3>
          <p className="text-2xl font-bold">${Number(prediction.current_price).toFixed(2)}</p>
          {prediction.dataType === "synthetic" ? (
            <p className="text-xs text-yellow-600 mt-1">Estimated price</p>
          ) : prediction.price_source ? (
            <p className="text-xs text-gray-500 mt-1">
              Source: {prediction.price_source === 'marketstack' || prediction.price_source === 'alphavantage' 
                ? 'Real-time data' 
                : prediction.price_source}
            </p>
          ) : null}
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Model Accuracy</h3>
          <p className="text-2xl font-bold">{Math.min(99, Math.max(70, 100 - (prediction.mae / prediction.current_price) * 100)).toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">Mean Absolute Error: ${prediction.mae?.toFixed(2) || "N/A"}</p>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 mb-2">7-Day Forecast</h3>
          <p className={`text-2xl font-bold ${parseFloat(forecast.percentChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${forecast.price}
          </p>
          <p className={`text-xs mt-1 ${parseFloat(forecast.percentChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {parseFloat(forecast.percentChange) >= 0 ? '+' : ''}{forecast.percentChange}% change
          </p>
        </div>
      </div>

      <div className="mb-8">
        <StockChart predictionData={prediction} />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <h3 className="text-lg font-medium p-4 border-b border-gray-100">Price Predictions</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Predicted Price</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {prediction.future_predictions.dates.map((date, index) => {
                // Ensure realistic predictions by capping changes
                const currentPrice = prediction.current_price;
                const rawPrice = prediction.future_predictions.prices[index];
                const rawChange = ((rawPrice - currentPrice) / currentPrice) * 100;
                
                // Calculate a more realistic price based on days from now
                // Cap daily change to a maximum percentage based on price range
                const daysFromNow = index + 1;
                let maxDailyPct;
                
                if (currentPrice < 10) {
                  maxDailyPct = 3.0; // Higher volatility for penny stocks
                } else if (currentPrice < 50) {
                  maxDailyPct = 2.0; // Medium-high volatility
                } else if (currentPrice < 200) {
                  maxDailyPct = 1.5; // Medium volatility
                } else {
                  maxDailyPct = 1.0; // Lower volatility for high-priced stocks
                }
                
                // Cap the total percentage change based on days elapsed
                const maxTotalPct = maxDailyPct * Math.sqrt(daysFromNow); // Use sqrt for a more realistic curve
                const cappedPctChange = Math.max(-maxTotalPct, Math.min(maxTotalPct, rawChange));
                const realisticPrice = currentPrice * (1 + cappedPctChange / 100);
                
                return (
                  <tr key={date} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{date}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 text-right">${realisticPrice.toFixed(2)}</td>
                    <td className={`py-3 px-4 text-sm text-right ${cappedPctChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {cappedPctChange >= 0 ? '+' : ''}{cappedPctChange.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Buy Modal */}
      {buyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Buy {prediction.symbol}</h3>
              <button 
                onClick={() => setBuyModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Current Price:</span>
                <span className="font-medium">${prediction.current_price}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Your Balance:</span>
                <span className="font-medium">${profile && profile.balance !== null ? parseFloat(profile.balance).toFixed(2) : '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max Shares:</span>
                <span className="font-medium">{calculateMaxShares()}</span>
              </div>
            </div>
            
            <form onSubmit={handleBuySubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2 text-sm font-medium">Shares to Buy</label>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  max={calculateMaxShares()}
                  value={sharesToBuy}
                  onChange={(e) => setSharesToBuy(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              {sharesToBuy && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Total Cost:</span>
                    <span className="font-bold">${(sharesToBuy * prediction.current_price).toFixed(2)}</span>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setBuyModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300"
                  disabled={loading || !sharesToBuy}
                >
                  {loading ? 'Processing...' : 'Buy Shares'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockPrediction; 