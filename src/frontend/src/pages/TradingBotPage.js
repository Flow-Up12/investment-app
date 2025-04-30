import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import Header from '../components/Header';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import api from '../services/api';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const TradingBotPage = () => {
  const [tradeHistory, setTradeHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'buy', 'sell', 'hold'
  const [botSettings, setBotSettings] = useState({
    isActive: true,
    maxInvestment: 500,
    riskLevel: 'medium', // 'low', 'medium', 'high'
    investmentTerm: 'balanced', // 'short', 'balanced', 'long'
    autoReinvest: true
  });
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState({...botSettings});
  const [performanceData, setPerformanceData] = useState({
    labels: [],
    datasets: []
  });
  const [botStats, setBotStats] = useState({
    totalInvested: 0,
    currentValue: 0,
    profit: 0,
    profitPercentage: 0,
    tradesMade: 0,
    successRate: 0
  });
  const [lastRunInfo, setLastRunInfo] = useState({
    timestamp: null,
    actions: [],
    status: 'idle' // 'idle', 'running', 'completed', 'error'
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimerRef = useRef(null);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(30);

  const startAutoRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    
    // Set initial countdown
    setTimeUntilRefresh(30);
    
    // Create timer that counts down and refreshes data
    refreshTimerRef.current = setInterval(() => {
      setTimeUntilRefresh(prev => {
        if (prev <= 1) {
          fetchTradeHistory();
          return 30; // Reset counter after refresh
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    fetchTradeHistory();
    
    if (autoRefresh) {
      startAutoRefreshTimer();
    }
    
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh]);

  const fetchTradeHistory = async () => {
    setLoading(true);
    try {
      // In a real application, this would fetch from your backend
      // For this demo, we'll simulate it with a mock
      
      // First update bot status to running
      setLastRunInfo(prev => ({
        ...prev,
        status: 'running'
      }));
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Generate a timestamp that's very recent
      const now = new Date();
      const recentTimestamp = now.toISOString();
      const lastRunTimestamp = new Date(now - 60000 * (now.getMinutes() % 5)).toISOString(); // Last run was 0-5 minutes ago
      
      // Generate decision actions
      const decisionActions = [
        {
          symbol: "AAPL",
          decision: "HOLD",
          reason: "Price stable within thresholds (+0.11%), prediction shows minimal movement"
        },
        {
          symbol: "TSLA", 
          decision: "BUY",
          shares: 0.15,
          price: 856.42,
          investment: 128.46,
          reason: "Strong upward prediction +3.2% expected in next 24 hours"
        },
        {
          symbol: "MSFT",
          decision: "HOLD",
          reason: "Already at maximum position size per risk settings"
        }
      ];
      
      // Demo data
      const mockHistory = [
        {
          timestamp: recentTimestamp,
          symbol: "TSLA",
          current_price: 856.42,
          predicted_price: 883.82,
          potential_gain_percent: 3.2,
          owned_shares: 0,
          action: "BUY",
          shares: 0.15,
          investment: 128.46,
          reason: "Strong upward prediction: +3.20%"
        },
        {
          timestamp: "2025-04-29T14:30:00",
          symbol: "AAPL",
          current_price: 210.14,
          predicted_price: 215.82,
          potential_gain_percent: 2.7,
          owned_shares: 0,
          action: "BUY",
          shares: 0.4757,
          investment: 100,
          reason: "Strong upward prediction: +2.70%"
        },
        {
          timestamp: "2025-04-29T14:30:00",
          symbol: "MSFT",
          current_price: 389.56,
          predicted_price: 388.74,
          potential_gain_percent: -0.21,
          owned_shares: 0.2517,
          action: "HOLD",
          reason: "Hold position, prediction (-0.21%) within thresholds"
        },
        {
          timestamp: "2025-04-29T14:30:00",
          symbol: "GOOGL",
          current_price: 166.89,
          predicted_price: 163.55,
          potential_gain_percent: -2.0,
          owned_shares: 0.6048,
          action: "SELL",
          shares: 0.6048,
          reason: "Downward prediction: -2.00%"
        },
        {
          timestamp: "2025-04-29T14:30:00",
          symbol: "NVDA",
          current_price: 950.02,
          predicted_price: 975.67,
          potential_gain_percent: 2.7,
          owned_shares: 0,
          action: "BUY",
          shares: 0.1052,
          investment: 100,
          reason: "Strong upward prediction: +2.70%"
        },
        {
          timestamp: "2025-04-29T13:30:00",
          symbol: "AMZN",
          current_price: 182.51,
          predicted_price: 185.42,
          potential_gain_percent: 1.6,
          owned_shares: 0,
          action: "BUY",
          shares: 0.5479,
          investment: 100,
          reason: "Strong upward prediction: +1.60%"
        }
      ];
      
      setTradeHistory(mockHistory);
      
      // Update last run info
      setLastRunInfo({
        timestamp: lastRunTimestamp,
        actions: decisionActions,
        status: 'completed'
      });
      
      // Mock performance data
      const mockPerformanceData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
        datasets: [
          {
            label: 'Bot Performance',
            data: [5000, 5120, 5250, 5180, 5320, 5460, 5580, 5740, 5950],
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.4
          },
          {
            label: 'Investment',
            data: [5000, 5000, 5100, 5100, 5200, 5300, 5400, 5500, 5600],
            borderColor: 'rgba(153, 102, 255, 1)',
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            borderDash: [5, 5],
            tension: 0.4
          }
        ]
      };
      
      setPerformanceData(mockPerformanceData);
      
      // Mock bot stats - update with some random fluctuations to simulate real-time changes
      const randomFactor = 1 + ((Math.random() - 0.5) * 0.02); // +/- 1% random change
      setBotStats({
        totalInvested: 5600 * randomFactor,
        currentValue: 5950 * randomFactor,
        profit: 350 * randomFactor,
        profitPercentage: 6.25 * randomFactor,
        tradesMade: 24 + (now.getMinutes() % 2),
        successRate: 72 + (now.getSeconds() % 5 - 2)
      });
      
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to fetch trade history');
      setLoading(false);
      setLastRunInfo(prev => ({
        ...prev,
        status: 'error'
      }));
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTempSettings({
      ...tempSettings,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const saveSettings = () => {
    // In a real app, you would save these to the backend
    setBotSettings(tempSettings);
    setIsEditingSettings(false);
  };

  const cancelEdit = () => {
    setTempSettings({...botSettings});
    setIsEditingSettings(false);
  };
  
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Bot Performance Over Time',
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value) => `$${value}`
        }
      }
    }
  };

  const filteredHistory = activeFilter === 'all' 
    ? tradeHistory 
    : tradeHistory.filter(item => item.action.toLowerCase() === activeFilter);

  return (
    <div>
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Trading Bot Dashboard</h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              {autoRefresh ? (
                <span>Auto-refresh in {timeUntilRefresh}s</span>
              ) : (
                <span>Auto-refresh disabled</span>
              )}
            </div>
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded text-white ${autoRefresh ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
            >
              {autoRefresh ? 'Disable' : 'Enable'} Auto-refresh
            </button>
            <button 
              onClick={fetchTradeHistory}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center"
              disabled={lastRunInfo.status === 'running'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Now
            </button>
          </div>
        </div>
        
        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-6">{error}</div>}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 md:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Performance Overview</h2>
            <div className="h-64">
              <Line data={performanceData} options={chartOptions} />
            </div>
          </div>
          
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Bot Summary</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status:</span>
                <div className="flex items-center">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    lastRunInfo.status === 'running' ? 'bg-blue-500 animate-pulse' : 
                    botSettings.isActive ? 'bg-green-500' : 'bg-red-500'
                  }`}></span>
                  <span className={`font-medium ${botSettings.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {lastRunInfo.status === 'running' ? 'Running' : 
                      botSettings.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Invested:</span>
                <span className="font-medium">${Math.round(botStats.totalInvested).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Current Value:</span>
                <span className="font-medium">${Math.round(botStats.currentValue).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Profit/Loss:</span>
                <span className={`font-medium ${botStats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${Math.round(botStats.profit).toLocaleString()} ({botStats.profit >= 0 ? '+' : ''}{botStats.profitPercentage.toFixed(2)}%)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Trades Made:</span>
                <span className="font-medium">{botStats.tradesMade}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Success Rate:</span>
                <span className="font-medium">{botStats.successRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Last Run:</span>
                <span className="font-medium">
                  {lastRunInfo.timestamp ? new Date(lastRunInfo.timestamp).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="card p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Last Bot Run Details</h2>
          
          {lastRunInfo.status === 'running' ? (
            <div className="flex items-center justify-center py-6">
              <div className="mr-3">
                <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <span className="text-gray-600">Bot is currently analyzing market data and making trading decisions...</span>
            </div>
          ) : lastRunInfo.timestamp ? (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <div>
                  <span className="text-gray-600">Last Run: </span>
                  <span className="font-medium">{new Date(lastRunInfo.timestamp).toLocaleString()}</span>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm ${
                  lastRunInfo.status === 'completed' ? 'bg-green-100 text-green-800' : 
                  lastRunInfo.status === 'error' ? 'bg-red-100 text-red-800' : 
                  'bg-gray-100 text-gray-800'
                }`}>
                  {lastRunInfo.status === 'completed' ? 'Completed' : 
                   lastRunInfo.status === 'error' ? 'Error' : 
                   'Unknown'}
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decision</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Shares</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lastRunInfo.actions.map((action, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{action.symbol}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            action.decision === 'BUY' ? 'bg-green-100 text-green-800' :
                            action.decision === 'SELL' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {action.decision}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {action.shares ? action.shares.toFixed(4) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {action.price ? `$${action.price.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{action.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              No bot runs recorded yet
            </div>
          )}
        </div>
        
        <div className="card p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Trading Activity</h2>
            
            <div className="flex space-x-2">
              <button 
                className={`px-3 py-1 rounded ${activeFilter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setActiveFilter('all')}
              >
                All
              </button>
              <button 
                className={`px-3 py-1 rounded ${activeFilter === 'buy' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setActiveFilter('buy')}
              >
                Buy
              </button>
              <button 
                className={`px-3 py-1 rounded ${activeFilter === 'sell' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setActiveFilter('sell')}
              >
                Sell
              </button>
              <button 
                className={`px-3 py-1 rounded ${activeFilter === 'hold' ? 'bg-gray-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setActiveFilter('hold')}
              >
                Hold
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-10">
              <p className="text-gray-500">Loading trade history...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">No trading activity found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-3 px-4 text-left">Time</th>
                    <th className="py-3 px-4 text-left">Symbol</th>
                    <th className="py-3 px-4 text-left">Action</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4 text-right">Prediction</th>
                    <th className="py-3 px-4 text-right">Shares</th>
                    <th className="py-3 px-4 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredHistory.map((trade, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="py-3 px-4">{formatDate(trade.timestamp)}</td>
                      <td className="py-3 px-4 font-medium">{trade.symbol}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 text-xs rounded ${
                          trade.action === 'BUY' 
                            ? 'bg-green-100 text-green-800' 
                            : trade.action === 'SELL' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {trade.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">${trade.current_price.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={trade.potential_gain_percent >= 0 ? 'text-green-600' : 'text-red-600'}>
                          ${trade.predicted_price.toFixed(2)}
                          <span className="ml-1">
                            ({trade.potential_gain_percent >= 0 ? '+' : ''}{trade.potential_gain_percent.toFixed(2)}%)
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {trade.action !== 'HOLD' ? trade.shares.toFixed(4) : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{trade.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TradingBotPage; 