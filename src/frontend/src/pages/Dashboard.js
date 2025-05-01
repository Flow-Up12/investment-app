import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchUserProfile, addFunds } from '../store/slices/userSlice';
import { fetchPortfolio, fetchPortfolioSummary } from '../store/slices/portfolioSlice';
import Header from '../components/Header';
import PortfolioList from '../components/PortfolioList';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
);

const Dashboard = () => {
  const dispatch = useDispatch();
  const { profile, loading: userLoading, error: userError } = useSelector((state) => state.user);
  const { holdings, summary, loading: portfolioLoading, error: portfolioError } = useSelector((state) => state.portfolio);
  const [addFundsModalOpen, setAddFundsModalOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1m'); // '1w', '1m', '3m', '1y', 'all'
  
  // Portfolio performance mock data
  const [performanceData, setPerformanceData] = useState({
    labels: [],
    datasets: []
  });
  
  // Add refresh timer for auto-refreshing data
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimerRef = useRef(null);
  
  // Generate mock performance data based on timeframe
  useEffect(() => {
    if (summary) {
      let labels = [];
      let values = [];
      let startValue = summary.totalValue * 0.9; // Start with slightly lower value
      
      switch (selectedTimeframe) {
        case '1w':
          labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Today'];
          break;
        case '1m':
          labels = [...Array(30).keys()].map(i => `Day ${i+1}`);
          labels[labels.length - 1] = 'Today';
          break;
        case '3m':
          labels = ['Jan', 'Feb', 'Mar', 'Apr'];
          break;
        case '1y':
          labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          break;
        default:
          labels = ['2022', '2023', '2024', '2025'];
      }
      
      // Generate mock growth with some randomness
      values = labels.map((_, index) => {
        const progress = index / (labels.length - 1);
        const randomFactor = 0.95 + Math.random() * 0.1; // 0.95 to 1.05
        return startValue + (summary.totalValue - startValue) * progress * randomFactor;
      });
      
      // Ensure last value exactly matches current total
      values[values.length - 1] = summary.totalValue;
      
      setPerformanceData({
        labels,
        datasets: [
          {
            label: 'Portfolio Value',
            data: values,
            fill: true,
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            tension: 0.4
          }
        ]
      });
    }
  }, [summary, selectedTimeframe]);
  
  // Portfolio allocation data
  const getAllocationData = () => {
    if (!holdings || holdings.length === 0) return null;
    
    const labels = holdings.map(h => h.symbol);
    const data = holdings.map(h => parseFloat(h.current_value));
    
    // Add cash if available in summary
    if (summary && profile) {
      labels.push('Cash');
      data.push(parseFloat(profile.balance));
    }
    
    return {
      labels,
      datasets: [
        {
          label: 'Portfolio Allocation',
          data,
          backgroundColor: [
            'rgba(255, 99, 132, 0.5)',
            'rgba(54, 162, 235, 0.5)',
            'rgba(255, 206, 86, 0.5)',
            'rgba(75, 192, 192, 0.5)',
            'rgba(153, 102, 255, 0.5)',
            'rgba(255, 159, 64, 0.5)',
            'rgba(199, 199, 199, 0.5)',
            'rgba(83, 102, 255, 0.5)',
            'rgba(40, 159, 64, 0.5)',
            'rgba(210, 199, 199, 0.5)',
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(199, 199, 199, 1)',
            'rgba(83, 102, 255, 1)',
            'rgba(40, 159, 64, 1)',
            'rgba(210, 199, 199, 1)',
          ],
          borderWidth: 1,
        },
      ],
    };
  };
  
  useEffect(() => {
    // Load initial data
    dispatch(fetchUserProfile());
    dispatch(fetchPortfolio());
    dispatch(fetchPortfolioSummary());
    
    // Set up auto-refresh
    if (autoRefresh) {
      startAutoRefreshTimer();
    }
    
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [dispatch, autoRefresh]);
  
  const startAutoRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    
    // Refresh every 30 seconds
    refreshTimerRef.current = setInterval(() => {
      refreshDashboardData();
    }, 30000);
  };
  
  const refreshDashboardData = () => {
    // Refresh all data silently (without loading indicators)
    dispatch(fetchUserProfile());
    dispatch(fetchPortfolio());
    dispatch(fetchPortfolioSummary());
  };
  
  const handleAddFundsSubmit = (e) => {
    e.preventDefault();
    
    if (fundAmount) {
      dispatch(addFunds(parseFloat(fundAmount))).then((result) => {
        if (!result.error) {
          setAddFundsModalOpen(false);
          setFundAmount('');
          dispatch(fetchPortfolioSummary());
        }
      });
    }
  };
  
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };
  
  // Calculate performance metrics
  const calculateMetrics = () => {
    if (!summary) return {};
    
    // Mock data for demonstration
    const initialInvestment = summary.totalInvestment;
    const currentValue = summary.totalValue;
    const profitLoss = currentValue - initialInvestment;
    const returnPercentage = initialInvestment > 0 ? (profitLoss / initialInvestment) * 100 : 0;
    
    const mockDailyChange = (Math.random() * 2 - 1) * 2; // -2% to +2%
    const mockWeeklyChange = mockDailyChange * 3; // Rough approximation
    
    return {
      profitLoss,
      returnPercentage,
      dailyChange: mockDailyChange,
      weeklyChange: mockWeeklyChange
    };
  };
  
  const metrics = calculateMetrics();
  const loading = userLoading || portfolioLoading;
  const error = userError || portfolioError;
  
  return (
    <div>
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Investment Dashboard</h1>
        
        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-6">{error}</div>}
        
        {loading ? (
          <div className="card p-6 text-center">Loading dashboard data...</div>
        ) : (
          <>
            {profile && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="card flex flex-col items-center justify-center">
                  <h2 className="text-xl font-semibold mb-2">Cash Balance</h2>
                  <p className="text-3xl text-primary-600">{formatCurrency(profile.balance)}</p>
                  <button
                    onClick={() => setAddFundsModalOpen(true)}
                    className="mt-4 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded"
                  >
                    Add Funds
                  </button>
                </div>
                
                {summary && (
                  <>
                    <div className="card flex flex-col items-center justify-center">
                      <h2 className="text-xl font-semibold mb-2">Total Investment</h2>
                      <p className="text-3xl text-primary-600">{formatCurrency(summary.totalInvestment)}</p>
                      <p className="text-sm text-gray-500 mt-2">
                        {holdings.length} stock{holdings.length !== 1 ? 's' : ''} in portfolio
                      </p>
                    </div>
                    
                    <div className="card flex flex-col items-center justify-center">
                      <h2 className="text-xl font-semibold mb-2">Total Portfolio Value</h2>
                      <p className="text-3xl text-primary-600">{formatCurrency(summary.totalValue)}</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Cash + Investments
                      </p>
                    </div>
                    
                    <div className="card flex flex-col items-center justify-center">
                      <h2 className="text-xl font-semibold mb-2">Total Return</h2>
                      <p className={`text-3xl ${metrics.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(metrics.profitLoss)}
                        <span className="text-lg ml-1">
                          ({metrics.profitLoss >= 0 ? '+' : ''}{metrics.returnPercentage.toFixed(2)}%)
                        </span>
                      </p>
                      <div className="flex space-x-4 text-sm mt-2">
                        <span className={metrics.dailyChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                          Today: {metrics.dailyChange >= 0 ? '+' : ''}{metrics.dailyChange.toFixed(2)}%
                        </span>
                        <span className={metrics.weeklyChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                          This Week: {metrics.weeklyChange >= 0 ? '+' : ''}{metrics.weeklyChange.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="card p-6 md:col-span-2">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Portfolio Performance</h2>
                  <div className="flex space-x-2">
                    {['1w', '1m', '3m', '1y', 'all'].map((timeframe) => (
                      <button
                        key={timeframe}
                        onClick={() => setSelectedTimeframe(timeframe)}
                        className={`px-2 py-1 text-sm rounded ${
                          selectedTimeframe === timeframe 
                            ? 'bg-primary-600 text-white' 
                            : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        {timeframe === '1w' ? '1W' : 
                          timeframe === '1m' ? '1M' : 
                          timeframe === '3m' ? '3M' : 
                          timeframe === '1y' ? '1Y' : 
                          'All'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-64">
                  {performanceData.labels.length > 0 && (
                    <Line 
                      data={performanceData}
                      options={{
                        responsive: true,
                        scales: {
                          y: {
                            ticks: {
                              callback: (value) => formatCurrency(value)
                            }
                          }
                        },
                        plugins: {
                          tooltip: {
                            callbacks: {
                              label: (context) => `Value: ${formatCurrency(context.raw)}`
                            }
                          }
                        }
                      }}
                    />
                  )}
                </div>
              </div>
              
              <div className="card p-6">
                <h2 className="text-xl font-semibold mb-4">Portfolio Allocation</h2>
                <div className="h-64 flex justify-center items-center">
                  {getAllocationData() ? (
                    <Doughnut 
                      data={getAllocationData()}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'right',
                            display: true
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => `${context.label}: ${formatCurrency(context.raw)} (${(context.raw / summary.totalValue * 100).toFixed(1)}%)`
                            }
                          }
                        }
                      }}
                    />
                  ) : (
                    <p className="text-gray-500">No portfolio data available</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="card p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Your Holdings</h2>
              <PortfolioList />
            </div>
          </>
        )}
      </div>
      
      {/* Add Funds Modal */}
      {addFundsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Add Funds to Your Account</h3>
            
            <form onSubmit={handleAddFundsSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Amount to Add ($)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="input"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setAddFundsModalOpen(false)}
                  className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
                  disabled={userLoading || !fundAmount}
                >
                  {userLoading ? 'Processing...' : 'Add Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 