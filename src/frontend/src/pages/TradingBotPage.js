import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
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
import { fetchUserProfile } from '../store/slices/userSlice';

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
  const dispatch = useDispatch();
  const user = useSelector(state => state.user.profile);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [loading, setLoading] = useState({
    botStats: true,
    tradeHistory: true,
    watchlist: true,
    config: true,
    search: false
  });
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'buy', 'sell', 'hold'
  const [botSettings, setBotSettings] = useState({
    isActive: false,
    buyThreshold: 1.5,
    sellThreshold: -0.5,
    maxInvestmentPerStock: 100,
    maxDailyInvestment: 300,
    pollingInterval: 60,
    allocatedFunds: 0
  });
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState({});
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
    successRate: 0,
    investedAmount: 0, // The amount currently invested in stocks
    availableAmount: 0 // The amount available for investment from allocated funds
  });
  const [lastRunInfo, setLastRunInfo] = useState({
    timestamp: null,
    actions: [],
    status: 'idle' // 'idle', 'running', 'completed', 'error'
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimerRef = useRef(null);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(30);
  const [watchlist, setWatchlist] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [expandedStocks, setExpandedStocks] = useState({});
  const [stockDetails, setStockDetails] = useState({});
  const [pageSize, setPageSize] = useState(10); // Number of trades to show per page
  const [currentPage, setCurrentPage] = useState(1);
  const [successMessage, setSuccessMessage] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);

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
          fetchBotData(false);
          return 30; // Reset counter after refresh
        }
        return prev - 1;
      });
    }, 1000);
  };

  const triggerBotRun = async () => {
    try {
      if (lastRunInfo.status !== 'running') {
        setLastRunInfo(prev => ({
          ...prev, 
          status: 'running'
        }));
      }
      
      const response = await api.post('/api/bot/run');
      
      if (response.status === 200) {
        // Extract information from the response
        const { actions, timestamp, stats } = response.data;
        
        // Check if any actions were successful transactions
        const successfulTransactions = actions.filter(a => a.transaction_completed === true);
        const failedTransactions = actions.filter(a => a.transaction_completed === false);
        
        // Update last run info
        setLastRunInfo(prev => ({
          ...prev,
          status: 'completed',
          actions: actions.map(a => ({
            symbol: a.symbol,
            action: a.action,
            shares: a.shares,
            currentPrice: a.currentPrice,
            reason: a.reason,
            transaction_completed: a.transaction_completed,
            transaction_error: a.transaction_error
          })),
          timestamp: timestamp
        }));
        
        // Update bot stats if provided
        if (stats) {
          setBotStats({
            totalInvested: stats.totalInvested || 0,
            currentValue: stats.currentValue || 0,
            profit: stats.profit || 0,
            profitPercentage: stats.profitPercentage || 0,
            tradesMade: stats.tradesMade || 0,
            successRate: stats.successRate || 0,
            investedAmount: stats.investedAmount || 0,
            availableAmount: stats.availableAmount || 0
          });
        }
        
        // Show feedback message
        let message = `Bot run completed. `;
        if (successfulTransactions.length > 0) {
          message += `${successfulTransactions.length} transactions executed successfully. `;
        }
        if (failedTransactions.length > 0) {
          message += `${failedTransactions.length} transactions failed. `;
        }
        
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 5000);
        
        // Refresh data to show latest changes
        await refreshDataWithoutLoading();
        
        setError(null);
      }
    } catch (error) {
      console.error('Error running the bot:', error);
      setError('Failed to trigger bot run: ' + (error.response?.data?.error || error.message));
      setLastRunInfo(prev => ({
        ...prev,
        status: 'error',
        message: error.response?.data?.error || error.message
      }));
    }
  };

  const refreshDataWithoutLoading = async () => {
    try {
      const [statsResponse, actionsResponse, watchlistResponse, configResponse] = await Promise.all([
        api.get('/api/bot/stats'),
        api.get('/api/bot/actions'),
        api.get('/api/bot/watchlist'),
        api.get('/api/bot/config')
      ]);
      
      if (statsResponse.status === 200) {
        setBotStats({
          totalInvested: statsResponse.data.totalInvested || 0,
          currentValue: statsResponse.data.currentValue || 0,
          profit: statsResponse.data.profit || 0,
          profitPercentage: statsResponse.data.profitPercentage || 0,
          tradesMade: statsResponse.data.tradesMade || 0,
          successRate: statsResponse.data.successRate || 0,
          investedAmount: statsResponse.data.investedAmount || 0,
          availableAmount: statsResponse.data.availableAmount || 0
        });
        
        setLastRunInfo(prev => ({
          ...prev,
          timestamp: statsResponse.data.lastRunTime
        }));
        
        createPerformanceChart(statsResponse.data);
      }
      
      if (actionsResponse.status === 200) {
        const formattedHistory = actionsResponse.data.map(action => ({
          ...action,
          timestamp: action.createdAt || action.timestamp,
          current_price: action.currentPrice || 0,
          predicted_price: action.predictedPrice || 0,
          potential_gain_percent: action.potentialGainPercent || 0,
          shares: action.shares || 0,
          reason: action.reason || 'Analysis based on market conditions'
        }));
        
        setTradeHistory(formattedHistory);
        
        // Extract the last run actions for the detailed view
        const recentActions = formattedHistory
          .filter(action => action.createdAt === formattedHistory[0]?.createdAt)
          .map(action => ({
            symbol: action.symbol,
            action: action.action,
            shares: action.shares,
            currentPrice: action.current_price,
            reason: action.reason,
            transaction_completed: action.transaction_completed,
            transaction_error: action.transaction_error
          }));
          
        if (recentActions.length > 0 && lastRunInfo.status !== 'running') {
          setLastRunInfo(prev => ({
            ...prev,
            actions: recentActions,
            status: 'completed'
          }));
        }
      }
      
      if (watchlistResponse.status === 200) {
        setWatchlist(watchlistResponse.data);
      }
      
      if (configResponse.status === 200) {
        setBotSettings(configResponse.data);
        setTempSettings(configResponse.data);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const fetchBotData = async (showLoading = true) => {
    try {
      setError(null);
      
      if (showLoading) {
        await Promise.all([
          fetchBotStats(),
          fetchBotActions(),
          fetchBotWatchlist(),
          fetchBotConfig()
        ]);
      } else {
        await refreshDataWithoutLoading();
      }
    } catch (error) {
      console.error('Error fetching bot data:', error);
      setError('Could not fetch real-time bot statistics. Showing demo data.');
    }
  };

  const fetchBotStats = async () => {
    try {
      setLoading(prev => ({ ...prev, botStats: true }));
      const response = await api.get('/api/bot/stats');
      if (response.status === 200) {
        setBotStats({
          totalInvested: response.data.totalInvested || 0,
          currentValue: response.data.currentValue || 0,
          profit: response.data.profit || 0,
          profitPercentage: response.data.profitPercentage || 0,
          tradesMade: response.data.tradesMade || 0,
          successRate: response.data.successRate || 0,
          investedAmount: response.data.investedAmount || 0,
          availableAmount: response.data.availableAmount || 0
        });
        
        setLastRunInfo(prev => ({
          ...prev,
          timestamp: response.data.lastRunTime
        }));
        
        // Update performance data from historical actions
        createPerformanceChart(response.data);
      }
    } catch (error) {
      console.error('Error fetching bot stats:', error);
      // Provide fallback data
      const fallbackStats = {
        totalInvested: 1000,
        currentValue: 1050,
        profit: 50,
        profitPercentage: 5,
        tradesMade: 10,
        successRate: 70,
        investedAmount: 800,
        availableAmount: 200
      };
      setBotStats(fallbackStats);
      createPerformanceChart(fallbackStats);
      
      // Don't throw error to allow the page to render with fallback data
      // Simply display a warning to the user
      setError('Could not fetch real-time bot statistics. Showing demo data.');
    } finally {
      setLoading(prev => ({ ...prev, botStats: false }));
    }
  };

  const fetchBotActions = async () => {
    try {
      setLoading(prev => ({ ...prev, tradeHistory: true }));
      const response = await api.get('/api/bot/actions');
      if (response.status === 200) {
        // Format the data to include more detailed information
        const formattedHistory = response.data.map(action => ({
          ...action,
          timestamp: action.createdAt || action.timestamp,
          current_price: action.currentPrice || 0,
          predicted_price: action.predictedPrice || 0,
          potential_gain_percent: action.potentialGainPercent || 0,
          shares: action.shares || 0,
          reason: action.reason || 'Analysis based on market conditions'
        }));
        
        setTradeHistory(formattedHistory);
        
        // Extract the last run actions for the detailed view
        const recentActions = formattedHistory
          .filter(action => action.createdAt === formattedHistory[0]?.createdAt)
          .map(action => ({
            symbol: action.symbol,
            action: action.action,
            shares: action.shares,
            currentPrice: action.current_price,
            reason: action.reason,
            transaction_completed: action.transaction_completed,
            transaction_error: action.transaction_error
          }));
          
        if (recentActions.length > 0 && lastRunInfo.status !== 'running') {
          setLastRunInfo(prev => ({
            ...prev,
            actions: recentActions,
            status: 'completed'
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching bot actions:', error);
      setTradeHistory([]);
      setLastRunInfo(prev => ({
        ...prev,
        actions: []
      }));
    } finally {
      setLoading(prev => ({ ...prev, tradeHistory: false }));
    }
  };

  const fetchBotWatchlist = async () => {
    try {
      setLoading(prev => ({ ...prev, watchlist: true }));
      const response = await api.get('/api/bot/watchlist');
      if (response.status === 200) {
        setWatchlist(response.data);
      }
    } catch (error) {
      console.error('Error fetching bot watchlist:', error);
      setWatchlist([]);
    } finally {
      setLoading(prev => ({ ...prev, watchlist: false }));
    }
  };

  const fetchBotConfig = async () => {
    try {
      setLoading(prev => ({ ...prev, config: true }));
      const response = await api.get('/api/bot/config');
      if (response.status === 200) {
        setBotSettings(response.data);
        setTempSettings(response.data);
      }
    } catch (error) {
      console.error('Error fetching bot config:', error);
    } finally {
      setLoading(prev => ({ ...prev, config: false }));
    }
  };

  const createPerformanceChart = (stats) => {
    // This function would normally use historical data to create the chart
    // For now, we'll still use a simulated chart
    const mockPerformanceData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
      datasets: [
        {
          label: 'Bot Performance',
          data: [stats.totalInvested * 0.9, stats.totalInvested * 0.92, stats.totalInvested * 0.95, 
                 stats.totalInvested * 0.93, stats.totalInvested * 0.97, stats.totalInvested * 0.99, 
                 stats.totalInvested * 1.02, stats.totalInvested * 1.04, stats.currentValue],
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.4
        },
        {
          label: 'Investment',
          data: [stats.totalInvested * 0.9, stats.totalInvested * 0.9, stats.totalInvested * 0.92, 
                 stats.totalInvested * 0.92, stats.totalInvested * 0.94, stats.totalInvested * 0.96, 
                 stats.totalInvested * 0.98, stats.totalInvested * 0.99, stats.totalInvested],
          borderColor: 'rgba(153, 102, 255, 1)',
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          borderDash: [5, 5],
          tension: 0.4
        }
      ]
    };
    
    setPerformanceData(mockPerformanceData);
    
    // Create the chart on the next tick after the component has updated
    setTimeout(() => {
      const ctx = document.getElementById('performanceChart');
      if (ctx) {
        // Check if Chart.js is loaded
        if (typeof ChartJS === 'undefined') {
          console.error('Chart.js is not loaded');
          return;
        }
        
        // Destroy any existing chart instance
        if (window.chartInstance) {
          window.chartInstance.destroy();
        }
        
        try {
          // Create new chart
          window.chartInstance = new ChartJS(ctx, {
            type: 'line',
            data: mockPerformanceData,
            options: chartOptions
          });
        } catch (error) {
          console.error('Error creating chart:', error);
        }
      }
    }, 100); // Slightly longer timeout to ensure DOM is ready
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTempSettings({
      ...tempSettings,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value
    });
  };

  const saveSettings = async () => {
    try {
      const response = await api.put('/api/bot/config', tempSettings);
      if (response.status === 200) {
        setBotSettings(response.data);
        setIsEditingSettings(false);
        
        // Restart the bot auto-run timer with new settings
        if (response.data.isActive) {
          startBotAutoRunTimer();
        }
      }
    } catch (error) {
      setError('Failed to update bot settings');
      console.error('Error updating bot settings:', error);
    }
  };

  const cancelEdit = () => {
    setTempSettings({...botSettings});
    setIsEditingSettings(false);
  };
  
  const allocateFunds = async (amount) => {
    try {
      const response = await api.post('/api/bot/funds/allocate', { amount });
      if (response.status === 200) {
        await fetchBotConfig();
        await fetchBotStats();
        
        // Update user profile to get latest balance
        dispatch(fetchUserProfile());
      }
    } catch (error) {
      setError('Failed to allocate funds to the bot');
      console.error('Error allocating funds:', error);
    }
  };
  
  const withdrawFunds = async (amount) => {
    try {
      const response = await api.post('/api/bot/funds/withdraw', { amount });
      if (response.status === 200) {
        await fetchBotConfig();
        await fetchBotStats();
        
        // Update user profile to get latest balance
        dispatch(fetchUserProfile());
      }
    } catch (error) {
      setError('Failed to withdraw funds from the bot');
      console.error('Error withdrawing funds:', error);
    }
  };
  
  const addToWatchlist = async (symbol) => {
    try {
      const response = await api.post('/api/bot/watchlist', { symbol });
      if (response.status === 201) {
        await fetchBotWatchlist();
      }
    } catch (error) {
      setError(`Failed to add ${symbol} to watchlist`);
      console.error('Error adding to watchlist:', error);
    }
  };
  
  const handleRemoveWatchlistItem = async (symbol) => {
    setProcessingAction(true);
    try {
      const response = await api.delete(`/api/bot/watchlist/${symbol}`);
      if (response.status === 200) {
        await fetchBotWatchlist();
        setSuccessMessage(`Successfully removed ${symbol} from watchlist`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (error) {
      setError(`Failed to remove ${symbol} from watchlist: ${error.response?.data?.error || error.message}`);
    } finally {
      setConfirmRemove(null);
      setProcessingAction(false);
    }
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
    : tradeHistory.filter(item => item.action && item.action.toLowerCase() === activeFilter);

  // Toggle expanded state for a stock
  const toggleStockDetails = async (symbol) => {
    // If not yet loaded, fetch the details
    if (!stockDetails[symbol]) {
      try {
        // Fetch stock transactions
        const transactionsResponse = await api.get(`/api/bot/transactions/${symbol}`);
        // Fetch stock performance
        const performanceResponse = await api.get(`/api/stocks/predict/${symbol}`);
        
        setStockDetails(prev => ({
          ...prev,
          [symbol]: {
            transactions: transactionsResponse.data || [],
            performance: performanceResponse.data || {},
            loading: false
          }
        }));
      } catch (error) {
        console.error(`Error fetching details for ${symbol}:`, error);
        setStockDetails(prev => ({
          ...prev,
          [symbol]: {
            transactions: [],
            performance: {},
            loading: false,
            error: 'Failed to load details'
          }
        }));
      }
    }
    
    // Toggle the expanded state
    setExpandedStocks(prev => ({
      ...prev,
      [symbol]: !prev[symbol]
    }));
  };

  // Function to start the bot auto-run timer
  const startBotAutoRunTimer = () => {
    const interval = botSettings.pollingInterval || 60; // Default to 60 seconds if not set
    
    console.log(`Setting up bot auto-run every ${interval} seconds`);
    
    // Clear existing timer if any
    if (window.botRunTimerRef) {
      clearInterval(window.botRunTimerRef);
    }
    
    // Only set up timer if bot is active
    if (botSettings.isActive) {
      let isCurrentlyRunning = false;
      
      window.botRunTimerRef = setInterval(async () => {
        if (!isCurrentlyRunning) {
          try {
            isCurrentlyRunning = true;
            
            console.log('Auto-running bot...');
            const response = await api.post('/api/bot/run');
            
            if (response.status === 200) {
              await refreshDataWithoutLoading();
            }
          } catch (error) {
            console.error('Error auto-running bot:', error);
          } finally {
            isCurrentlyRunning = false;
          }
        }
      }, interval * 1000);
      
      return () => {
        if (window.botRunTimerRef) {
          clearInterval(window.botRunTimerRef);
        }
      };
    }
  };
  
  useEffect(() => {
    // Start the bot auto-run timer whenever settings change
    if (botSettings.isActive) {
      startBotAutoRunTimer();
    }
    
    // Cleanup on unmount
    return () => {
      if (window.botRunTimerRef) {
        clearInterval(window.botRunTimerRef);
      }
    };
  }, [botSettings.isActive, botSettings.pollingInterval]);

  // Calculate paginaton for trade history
  const totalPages = Math.ceil(filteredHistory.length / pageSize);
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  
  // Previous and next page handlers
  const goToPreviousPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const goToNextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));

  // Make sure we clean up chart instance on component unmount
  useEffect(() => {
    return () => {
      if (window.chartInstance) {
        window.chartInstance.destroy();
      }
      
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      
      if (window.botRunTimerRef) {
        clearInterval(window.botRunTimerRef);
      }
    };
  }, []);

  // Add back the missing useEffect
  useEffect(() => {
    fetchBotData();
    
    if (autoRefresh) {
      startAutoRefreshTimer();
    }
    
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh]);

  // Add this function to toggle watchlist item active status
  const toggleWatchlistItemStatus = async (symbol, isActive) => {
    setProcessingAction(true);
    try {
      const response = await api.put(`/api/bot/watchlist/${symbol}/status`, { isActive });
      if (response.status === 200) {
        await fetchBotWatchlist();
        setSuccessMessage(`${symbol} is now ${isActive ? 'active' : 'inactive'}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (error) {
      setError(`Failed to update ${symbol} status: ${error.response?.data?.error || error.message}`);
    } finally {
      setProcessingAction(false);
    }
  };

  return (
    <div>
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded mb-6">
            {successMessage}
          </div>
        )}
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Trading Bot Dashboard</h1>
          
          <div className="flex items-center">
            <span className="text-sm text-gray-500 mr-3">
              Auto-refresh in {timeUntilRefresh}s
            </span>
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`mr-2 px-4 py-2 rounded ${autoRefresh ? 'bg-red-500 text-white' : 'bg-gray-300'}`}
            >
              {autoRefresh ? 'Disable Auto-refresh' : 'Enable Auto-refresh'}
            </button>
            <button
              onClick={fetchBotData}
              className="mr-2 px-4 py-2 bg-blue-500 text-white rounded"
              disabled={loading.botStats || loading.tradeHistory || loading.watchlist || loading.config}
            >
              <svg className={`inline w-4 h-4 mr-1 ${(loading.botStats || loading.tradeHistory || loading.watchlist || loading.config) ? 'animate-spin' : ''}`} viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refresh Now
            </button>
            <button
              onClick={triggerBotRun}
              className="px-4 py-2 bg-purple-600 text-white rounded"
              disabled={lastRunInfo.status === 'running' || !botSettings.isActive}
            >
              {lastRunInfo.status === 'running' ? (
                <svg className="inline w-4 h-4 mr-1 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : null}
              Run Bot Now
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Performance Overview</h2>
            {loading.botStats ? (
              <div className="flex justify-center items-center h-64">
                <svg className="w-8 h-8 animate-spin text-primary-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : (
              <div className="h-64">
                <canvas id="performanceChart" width="400" height="200"></canvas>
              </div>
            )}
          </div>
          
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Bot Summary</h2>
            {loading.botStats || loading.config ? (
              <div className="space-y-2">
                <div className="animate-pulse flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                </div>
                <div className="animate-pulse flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                </div>
                <div className="animate-pulse flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${botSettings.isActive ? 'text-green-500' : 'text-gray-500'}`}>
                    {botSettings.isActive ? 'Running' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Invested:</span>
                  <span className="font-medium">${Math.round(parseFloat(botStats.totalInvested) || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Current Value:</span>
                  <span className="font-medium">${Math.round(parseFloat(botStats.currentValue) || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Profit/Loss:</span>
                  <span className={`font-medium ${botStats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${Math.round(parseFloat(botStats.profit) || 0).toLocaleString()} 
                    ({parseFloat(botStats.profit) >= 0 ? '+' : ''}
                    {typeof botStats.profitPercentage === 'number' ? 
                      botStats.profitPercentage.toFixed(2) : 
                      parseFloat(botStats.profitPercentage || 0).toFixed(2)}%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Allocated Funds:</span>
                  <span className="font-medium">${parseFloat(botSettings.allocatedFunds).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Currently Invested:</span>
                  <span className="font-medium">${parseFloat(botStats.investedAmount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Available for Trading:</span>
                  <span className={`font-medium ${(parseFloat(botStats.availableAmount) < 0) ? 'text-red-600' : ''}`}>
                    ${parseFloat(botStats.availableAmount || 0).toFixed(2)}
                    {parseFloat(botStats.availableAmount) < 0 && 
                      <span className="ml-1 text-xs text-red-600">(Inconsistent data, please check with admin)</span>
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Trades Made:</span>
                  <span className="font-medium">{botStats.tradesMade}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Success Rate:</span>
                  <span className="font-medium">
                    {typeof botStats.successRate === 'number' ? 
                      botStats.successRate.toFixed(1) : 
                      parseFloat(botStats.successRate || 0).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Last Run:</span>
                  <span className="font-medium">
                    {lastRunInfo.timestamp ? formatDate(lastRunInfo.timestamp) : 'Never'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="card p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Bot Funds Management</h2>
          
          {loading.botStats || loading.config ? (
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-10 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg flex-1">
                  <h3 className="text-lg font-medium mb-2">Allocated Funds</h3>
                  <div className="text-2xl font-bold text-blue-600">${parseFloat(botSettings.allocatedFunds).toFixed(2)}</div>
                  <div className="text-sm text-gray-600 mt-1">Total funds assigned to the bot</div>
                </div>
                
                <div className="p-4 bg-green-50 rounded-lg flex-1">
                  <h3 className="text-lg font-medium mb-2">Currently Invested</h3>
                  <div className="text-2xl font-bold text-green-600">${parseFloat(botStats.investedAmount).toFixed(2)}</div>
                  <div className="text-sm text-gray-600 mt-1">Funds currently in stock positions</div>
                </div>
                
                <div className={`p-4 ${parseFloat(botStats.availableAmount) < 0 ? 'bg-red-50' : 'bg-gray-50'} rounded-lg flex-1`}>
                  <h3 className="text-lg font-medium mb-2">Available for Trading</h3>
                  <div className={`text-2xl font-bold ${parseFloat(botStats.availableAmount) < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    ${parseFloat(botStats.availableAmount).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Funds available for new positions</div>
                </div>
              </div>
              
              <div className="mb-6">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <h3 className="text-md font-medium mb-2">Fund Allocation</h3>
                  <div className="h-8 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500" 
                      style={{ 
                        width: `${Math.min(100, Math.max(0, (botStats.investedAmount / botSettings.allocatedFunds) * 100))}%`,
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <span>{((botStats.investedAmount / botSettings.allocatedFunds) * 100).toFixed(0)}% Invested</span>
                    <span>${parseFloat(botStats.investedAmount).toFixed(2)} / ${parseFloat(botSettings.allocatedFunds).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {parseFloat(botStats.availableAmount) < 0 && (
                <div className="mb-6">
                  <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded">
                    <p className="font-bold">Warning: Negative Available Funds</p>
                    <p className="mb-2">Available funds are negative. This can happen if funds were allocated incorrectly or if there's a data inconsistency.</p>
                    <button
                      onClick={async () => {
                        try {
                          // Calculate how much to add to fix the negative balance
                          const amountToAdd = Math.abs(parseFloat(botStats.availableAmount)) + 100; // Add $100 buffer
                          
                          // Call the allocate funds endpoint
                          const response = await api.post('/api/bot/funds/allocate', { amount: amountToAdd });
                          
                          if (response.status === 200) {
                            // Update user profile to show new balance
                            dispatch(fetchUserProfile());
                            
                            // Refresh bot data
                            fetchBotData();
                            
                            // Show success message
                            setSuccessMessage(`Successfully added $${amountToAdd.toFixed(2)} to resolve the negative balance`);
                            setTimeout(() => setSuccessMessage(null), 5000);
                          }
                        } catch (error) {
                          console.error('Error resolving negative balance:', error);
                          setError(error.response?.data?.error || 'Failed to fix negative balance. You may need to add funds to your account first.');
                        }
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                    >
                      Fix Negative Balance
                    </button>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <h3 className="font-medium mb-2">Add Funds</h3>
                  <div className="flex">
                    <input 
                      type="number" 
                      id="fundAmount" 
                      className="flex-1 px-3 py-2 border rounded-l"
                      placeholder="Enter amount..."
                      min="10"
                      step="10"
                    />
                    <button
                      onClick={async () => {
                        const amount = document.getElementById('fundAmount').value;
                        if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
                          await allocateFunds(parseFloat(amount));
                          document.getElementById('fundAmount').value = '';
                        }
                      }}
                      className="px-4 py-2 bg-green-500 text-white rounded-r hover:bg-green-600"
                    >
                      Allocate
                    </button>
                  </div>
                  {user && (
                    <div className="mt-1 text-sm text-gray-600">
                      Account balance: ${parseFloat(user.balance).toFixed(2)}
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className="font-medium mb-2">Withdraw Funds</h3>
                  <div className="flex">
                    <input 
                      type="number" 
                      id="withdrawAmount" 
                      className="flex-1 px-3 py-2 border rounded-l"
                      placeholder="Enter amount..."
                      min="10"
                      step="10"
                    />
                    <button
                      onClick={async () => {
                        const amount = document.getElementById('withdrawAmount').value;
                        if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
                          await withdrawFunds(parseFloat(amount));
                          document.getElementById('withdrawAmount').value = '';
                        }
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded-r hover:bg-red-600"
                      disabled={parseFloat(botStats.availableAmount) <= 0}
                    >
                      Withdraw
                    </button>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {parseFloat(botStats.availableAmount) <= 0 ? 
                      "No funds available to withdraw" : 
                      `Available to withdraw: $${parseFloat(botStats.availableAmount).toFixed(2)}`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="card p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Last Bot Run Details</h2>
          {lastRunInfo.status === 'running' ? (
            <div className="flex items-center justify-center py-6">
              <svg className="w-6 h-6 mr-3 animate-spin text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Bot is currently analyzing market data and making trading decisions...</p>
            </div>
          ) : lastRunInfo.status === 'error' ? (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded">
              <p className="font-bold">Error running bot</p>
              <p>{lastRunInfo.message || 'An unknown error occurred'}</p>
            </div>
          ) : lastRunInfo.actions && lastRunInfo.actions.length > 0 ? (
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-600">Last run: {formatDate(lastRunInfo.timestamp || new Date())}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Shares</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {lastRunInfo.actions.map((action, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{action.symbol}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            action.action === 'BUY' ? 'bg-green-100 text-green-800' :
                            action.action === 'SELL' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {action.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {action.shares && typeof action.shares === 'number' ? action.shares.toFixed(4) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {action.currentPrice && typeof action.currentPrice === 'number' ? `$${action.currentPrice.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {action.action === 'HOLD' ? (
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">N/A</span>
                          ) : action.transaction_completed ? (
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">Completed</span>
                          ) : action.transaction_error ? (
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800" title={action.transaction_error}>Failed</span>
                          ) : (
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {action.transaction_error ? (
                            <div>
                              <div>{action.reason}</div>
                              <div className="text-red-600 text-xs mt-1">Error: {action.transaction_error}</div>
                            </div>
                          ) : (
                            action.reason
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p>No recent bot runs found. Click "Run Bot Now" to trigger a trading session.</p>
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
          
          {loading.tradeHistory && tradeHistory.length === 0 ? (
            <div className="text-center py-10">
              <svg className="w-8 h-8 mx-auto animate-spin text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-3 text-gray-500">Loading trade history...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">No trading activity found.</p>
            </div>
          ) : (
            <>
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
                    {loading.tradeHistory && filteredHistory.length > 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-2 bg-blue-50">
                          <div className="flex justify-center items-center">
                            <svg className="w-5 h-5 mr-2 animate-spin text-blue-500" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Refreshing...</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {paginatedHistory.map((trade, index) => (
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
                        <td className="py-3 px-4 text-right">
                          ${typeof trade.currentPrice === 'number' ? trade.currentPrice.toFixed(2) : 
                             parseFloat(trade.currentPrice).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={parseFloat(trade.potentialGainPercent) >= 0 ? 'text-green-600' : 'text-red-600'}>
                            ${typeof trade.predictedPrice === 'number' ? trade.predictedPrice.toFixed(2) : 
                               parseFloat(trade.predictedPrice).toFixed(2)}
                            <span className="ml-1">
                              ({parseFloat(trade.potentialGainPercent) >= 0 ? '+' : ''}
                              {typeof trade.potentialGainPercent === 'number' ? 
                                trade.potentialGainPercent.toFixed(2) : 
                                parseFloat(trade.potentialGainPercent).toFixed(2)}%)
                            </span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {trade.action !== 'HOLD' && trade.shares && typeof trade.shares === 'number' ? trade.shares.toFixed(4) : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{trade.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-600">
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredHistory.length)} of {filteredHistory.length} entries
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={goToPreviousPage} 
                      disabled={currentPage === 1}
                      className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button 
                      onClick={goToNextPage} 
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1 rounded ${currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                    >
                      Next
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="pageSize" className="text-sm text-gray-600">Show:</label>
                    <select 
                      id="pageSize" 
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1); // Reset to first page when changing page size
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="card p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Bot Watchlist</h2>
            <button 
              onClick={() => setIsEditingSettings(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Manage Settings
            </button>
          </div>
          
          {isEditingSettings ? (
            <div className="bg-gray-50 p-4 rounded mb-4">
              <h3 className="text-lg font-medium mb-3">Bot Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    checked={tempSettings.isActive}
                    onChange={handleSettingsChange}
                    className="mr-2"
                  />
                  <label htmlFor="isActive">Bot Active</label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="buyThreshold" className="block text-sm mb-1">Buy Threshold (%)</label>
                    <input
                      type="number"
                      id="buyThreshold"
                      name="buyThreshold"
                      value={tempSettings.buyThreshold}
                      onChange={handleSettingsChange}
                      className="w-full p-2 border rounded"
                      step="0.1"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="sellThreshold" className="block text-sm mb-1">Sell Threshold (%)</label>
                    <input
                      type="number"
                      id="sellThreshold"
                      name="sellThreshold"
                      value={tempSettings.sellThreshold}
                      onChange={handleSettingsChange}
                      className="w-full p-2 border rounded"
                      step="0.1"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="maxInvestmentPerStock" className="block text-sm mb-1">Max Investment Per Stock ($)</label>
                    <input
                      type="number"
                      id="maxInvestmentPerStock"
                      name="maxInvestmentPerStock"
                      value={tempSettings.maxInvestmentPerStock}
                      onChange={handleSettingsChange}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="maxDailyInvestment" className="block text-sm mb-1">Max Daily Investment ($)</label>
                    <input
                      type="number"
                      id="maxDailyInvestment"
                      name="maxDailyInvestment"
                      value={tempSettings.maxDailyInvestment}
                      onChange={handleSettingsChange}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="pollingInterval" className="block text-sm mb-1">Polling Interval (seconds)</label>
                    <input
                      type="number"
                      id="pollingInterval"
                      name="pollingInterval"
                      value={tempSettings.pollingInterval}
                      onChange={handleSettingsChange}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSettings}
                    className="px-4 py-2 bg-blue-500 rounded text-white hover:bg-blue-600"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between mb-4">
                <div className="w-1/2">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium mb-2">Add Stock to Watchlist</h3>
                    <div className="relative">
                      <input 
                        type="text" 
                        id="newSymbol" 
                        placeholder="Search for symbol (e.g., AAPL)" 
                        className="border rounded px-3 py-2 w-full"
                        onChange={(e) => {
                          const query = e.target.value.trim();
                          if (query.length >= 2) {
                            setLoading(prev => ({ ...prev, search: true }));
                            api.get(`/api/stocks/search-symbol?q=${query}`)
                              .then(response => {
                                setSearchResults(response.data.slice(0, 8)); // Limit to top 8 results
                              })
                              .catch(err => {
                                console.error('Error searching stocks:', err);
                                setSearchResults([]);
                              })
                              .finally(() => setLoading(prev => ({ ...prev, search: false })));
                          } else {
                            setSearchResults([]);
                          }
                        }}
                      />
                      
                      {searchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                          {searchResults.map((stock, index) => (
                            <div 
                              key={index} 
                              className="p-2 hover:bg-gray-100 cursor-pointer border-b"
                              onClick={() => {
                                addToWatchlist(stock.symbol);
                                setSearchResults([]);
                                document.getElementById('newSymbol').value = '';
                              }}
                            >
                              <div className="font-medium">{stock.symbol}</div>
                              <div className="text-sm text-gray-600">{stock.name}</div>
                              <div className="text-xs text-gray-500">{stock.type}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="w-1/2 pl-4">
                  <h3 className="text-lg font-medium mb-2">Bot Configuration</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={`font-medium ${botSettings.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {botSettings.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Buy Threshold:</span>
                      <span>{botSettings.buyThreshold}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sell Threshold:</span>
                      <span>{botSettings.sellThreshold}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Poll Interval:</span>
                      <span>{botSettings.pollingInterval} seconds</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                {loading.watchlist && watchlist.length === 0 ? (
                  <div className="flex justify-center items-center py-10">
                    <svg className="w-8 h-8 animate-spin text-blue-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : (
                  <table className="min-w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current Price</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Last Trade</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {watchlist.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                            No stocks in watchlist. Add some stocks to get started.
                          </td>
                        </tr>
                      ) : (
                        watchlist.map((item) => (
                          <React.Fragment key={item.id}>
                            <tr 
                              className={`hover:bg-gray-50 cursor-pointer ${expandedStocks[item.symbol] ? 'bg-gray-50' : ''}`}
                              onClick={() => toggleStockDetails(item.symbol)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap font-medium">
                                <div className="flex items-center">
                                  <span className={`mr-2 text-xs transition-transform ${expandedStocks[item.symbol] ? 'transform rotate-90' : ''}`}>▶</span>
                                  {item.symbol}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                {item.currentPrice ? `$${item.currentPrice.toFixed(2)}` : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent row click event
                                    toggleWatchlistItemStatus(item.symbol, !item.isActive);
                                  }}
                                  className={`px-2 py-1 rounded-full ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                                  disabled={processingAction}
                                  title={item.isActive ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                                >
                                  <span className={`inline-block w-2 h-2 mr-1 rounded-full ${item.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                  {item.isActive ? 'Active' : 'Inactive'}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                {item.lastTradeTime ? formatDate(item.lastTradeTime) : 'Never'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent row click event
                                    setConfirmRemove(item.symbol);
                                  }}
                                  className="text-red-600 hover:text-red-900"
                                  disabled={processingAction}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                            
                            {/* Collapsible details row */}
                            {expandedStocks[item.symbol] && (
                              <tr>
                                <td colSpan="5" className="px-6 py-2 bg-gray-50 border-b">
                                  <div className="p-3">
                                    {!stockDetails[item.symbol] ? (
                                      <div className="flex justify-center items-center py-4">
                                        <svg className="animate-spin h-5 w-5 text-blue-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Loading stock details...</span>
                                      </div>
                                    ) : stockDetails[item.symbol].error ? (
                                      <div className="text-red-500 py-2">{stockDetails[item.symbol].error}</div>
                                    ) : (
                                      <div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                          <div className="bg-white p-3 rounded shadow-sm">
                                            <h4 className="font-medium text-gray-700 mb-2">Holdings</h4>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                              <div>
                                                <span className="text-gray-500">Shares Owned:</span>
                                                <span className="ml-1 font-medium">
                                                  {stockDetails[item.symbol].performance?.shares_owned?.toFixed(4) || '0'}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Avg. Price:</span>
                                                <span className="ml-1 font-medium">
                                                  ${stockDetails[item.symbol].performance?.average_price?.toFixed(2) || '0.00'}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Total Investment:</span>
                                                <span className="ml-1 font-medium">
                                                  ${stockDetails[item.symbol].performance?.total_investment?.toFixed(2) || '0.00'}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Current Value:</span>
                                                <span className="ml-1 font-medium">
                                                  ${stockDetails[item.symbol].performance?.total_value?.toFixed(2) || '0.00'}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                          
                                          <div className="bg-white p-3 rounded shadow-sm">
                                            <h4 className="font-medium text-gray-700 mb-2">Performance</h4>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                              <div>
                                                <span className="text-gray-500">Profit/Loss:</span>
                                                <span className={`ml-1 font-medium ${
                                                  (stockDetails[item.symbol].performance?.profit || 0) >= 0 
                                                    ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                  ${stockDetails[item.symbol].performance?.profit?.toFixed(2) || '0.00'}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Percent:</span>
                                                <span className={`ml-1 font-medium ${
                                                  (stockDetails[item.symbol].performance?.profit_percent || 0) >= 0 
                                                    ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                  {(stockDetails[item.symbol].performance?.profit_percent || 0) >= 0 ? '+' : ''}
                                                  {stockDetails[item.symbol].performance?.profit_percent?.toFixed(2) || '0.00'}%
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Last Trade:</span>
                                                <span className="ml-1 font-medium">
                                                  {item.lastTradeTime ? formatDate(item.lastTradeTime) : 'Never'}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Status:</span>
                                                <span className={`ml-1 font-medium ${item.isActive ? 'text-green-600' : 'text-red-600'}`}>
                                                  {item.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Transactions table */}
                                        <div className="bg-white p-3 rounded shadow-sm">
                                          <h4 className="font-medium text-gray-700 mb-2">Transaction History</h4>
                                          {stockDetails[item.symbol].transactions?.length > 0 ? (
                                            <div className="overflow-x-auto">
                                              <table className="min-w-full divide-y divide-gray-200 text-sm">
                                                <thead className="bg-gray-50">
                                                  <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Shares</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                  {stockDetails[item.symbol].transactions.map((tx, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(tx.date)}</td>
                                                      <td className="px-3 py-2 whitespace-nowrap">
                                                        <span className={`inline-block px-2 py-1 text-xs rounded ${
                                                          tx.type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                        }`}>
                                                          {tx.type}
                                                        </span>
                                                      </td>
                                                      <td className="px-3 py-2 whitespace-nowrap text-right">{parseFloat(tx.shares).toFixed(4)}</td>
                                                      <td className="px-3 py-2 whitespace-nowrap text-right">${parseFloat(tx.price).toFixed(2)}</td>
                                                      <td className="px-3 py-2 whitespace-nowrap text-right">${parseFloat(tx.total).toFixed(2)}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          ) : (
                                            <p className="text-gray-500 text-sm py-2">No transactions recorded for this stock</p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>

        {/* Add the loading indicator for watchlist at the bottom of the watchlist table */}
        {loading.watchlist && watchlist.length > 0 && (
          <div className="text-center py-2 text-xs text-gray-500">
            <span className="inline-block bg-blue-50 text-blue-500 px-2 py-1 rounded">Updating watchlist data...</span>
          </div>
        )}

        {/* Confirmation Modal for Remove */}
        {confirmRemove && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold mb-4">Remove Stock</h3>
              <p className="mb-6">Are you sure you want to remove <span className="font-bold">{confirmRemove}</span> from your watchlist?</p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setConfirmRemove(null)}
                  className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-100"
                  disabled={processingAction}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRemoveWatchlistItem(confirmRemove)}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  disabled={processingAction}
                >
                  {processingAction ? (
                    <svg className="inline w-4 h-4 mr-1 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : null}
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingBotPage; 