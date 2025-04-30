import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Spin, Statistic, Alert, Button, Select, Tabs } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, LineChartOutlined, HistoryOutlined } from '@ant-design/icons';
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
import Layout from '../components/Layout';
import { realTimeStockService } from '../services/api';
import axios from 'axios';

// Register ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const { Title: AntTitle, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

const TIME_RANGES = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'max' },
];

const StockDetailPage = () => {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('1w');
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [realtimePrice, setRealtimePrice] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const timerRef = useRef(null);
  const refreshTimerRef = useRef(null);

  // Load initial stock data
  useEffect(() => {
    if (symbol) {
      fetchStockDetails();
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [symbol]);
  
  // Set up auto-refresh timer
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    
    if (autoRefresh) {
      setCountdown(30);
      refreshTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            fetchRealTimePrice();
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [autoRefresh, symbol]);
  
  // Update chart when timeRange or stockData changes
  useEffect(() => {
    if (stockData) {
      generateChartData();
    }
  }, [timeRange, stockData]);
  
  // Fetch real-time price periodically
  const fetchRealTimePrice = async () => {
    if (!symbol) return;
    
    try {
      setRefreshing(true);
      const data = await realTimeStockService.getCurrentPrice(symbol);
      setRealtimePrice(data);
      setLastUpdate(new Date());
      setRefreshing(false);
    } catch (err) {
      console.error('Error fetching real-time price:', err);
      setRefreshing(false);
    }
  };

  const fetchStockDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the prediction API endpoint
      const response = await axios.get(`http://localhost:5100/api/stocks/predict/${symbol}`);
      setStockData(response.data);
      setLoading(false);
      
      // After loading main data, fetch real-time price
      fetchRealTimePrice();
      
    } catch (err) {
      console.error('Error fetching stock details:', err);
      setError('Failed to load stock data. Please try again later.');
      setLoading(false);
    }
  };
  
  const generateChartData = () => {
    if (!stockData) return;
    
    let labels = [];
    let historicalPrices = [];
    let futurePrices = [];
    
    // Get historical data
    switch(timeRange) {
      case '1d':
        // For 1-day view, generate hourly data points
        labels = Array.from({ length: 7 }, (_, i) => {
          const hour = 9 + i;
          return `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'PM' : 'AM'}`;
        });
        
        // Generate intraday price data with some random variations
        const basePrice = stockData.current_price;
        const variationPercent = 0.02; // 2% max variation
        historicalPrices = labels.map(() => {
          const variation = basePrice * variationPercent * (Math.random() * 2 - 1);
          return basePrice + variation;
        });
        futurePrices = [];
        break;
        
      case '1w':
        // Use last 7 days of historical data
        if (stockData.historical_data.dates.length >= 7) {
          labels = stockData.historical_data.dates.slice(-7);
          historicalPrices = stockData.historical_data.prices.slice(-7);
        } else {
          labels = stockData.historical_data.dates;
          historicalPrices = stockData.historical_data.prices;
        }
        
        // Add future predictions for the next days
        labels = [...labels, ...stockData.future_predictions.dates.slice(0, 3)];
        historicalPrices = [...historicalPrices, null, null, null];
        futurePrices = [null, null, null, null, ...stockData.future_predictions.prices.slice(0, 3)];
        break;
        
      case '1m':
        // Use last 30 days of historical data
        labels = stockData.historical_data.dates;
        historicalPrices = stockData.historical_data.prices;
        
        // Add future predictions
        labels = [...labels, ...stockData.future_predictions.dates];
        historicalPrices = [...historicalPrices, ...Array(stockData.future_predictions.dates.length).fill(null)];
        futurePrices = [...Array(stockData.historical_data.dates.length).fill(null), ...stockData.future_predictions.prices];
        break;
        
      default:
        // Default view - all available data
        labels = stockData.historical_data.dates;
        historicalPrices = stockData.historical_data.prices;
        
        // Add future predictions
        labels = [...labels, ...stockData.future_predictions.dates];
        historicalPrices = [...historicalPrices, ...Array(stockData.future_predictions.dates.length).fill(null)];
        futurePrices = [...Array(stockData.historical_data.dates.length).fill(null), ...stockData.future_predictions.prices];
    }
    
    setChartData({
      labels,
      datasets: [
        {
          label: 'Historical Price',
          data: historicalPrices,
          borderColor: 'rgba(53, 162, 235, 1)',
          backgroundColor: 'rgba(53, 162, 235, 0.5)',
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: 'Predicted Price',
          data: futurePrices,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 2,
        }
      ]
    });
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            if (context.raw === null) return null;
            return `$${context.raw.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      y: {
        ticks: {
          callback: function(value) {
            return `$${value.toFixed(2)}`;
          }
        }
      }
    }
  };

  // Calculate price change and % change
  const getPriceChange = () => {
    if (!realtimePrice) return { change: 0, percent: 0 };
    
    return {
      change: realtimePrice.price_change,
      percent: realtimePrice.price_change_percent
    };
  };
  
  const handleGoBack = () => {
    navigate(-1); // Go back to previous page
  };

  return (
    <Layout>
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center">
          <Button 
            type="default" 
            icon={<HistoryOutlined />} 
            onClick={handleGoBack}
            className="mr-4"
          >
            Back
          </Button>
          <AntTitle level={2} className="m-0">{symbol} Stock Details</AntTitle>
        </div>
        
        <div className="flex items-center">
          {lastUpdate && (
            <Text className="text-gray-500 mr-4">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </Text>
          )}
          
          <Button 
            type={autoRefresh ? "danger" : "primary"} 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="mr-2"
          >
            {autoRefresh ? `Auto-refresh (${countdown}s)` : "Enable auto-refresh"}
          </Button>
          
          <Button 
            type="primary" 
            onClick={fetchRealTimePrice} 
            loading={refreshing}
            icon={<LineChartOutlined />}
          >
            Refresh Now
          </Button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert type="error" message={error} />
      ) : stockData ? (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card title="Current Price" className="shadow-md">
              <Statistic
                value={realtimePrice ? realtimePrice.current_price : stockData.current_price}
                precision={2}
                prefix="$"
                valueStyle={{ 
                  color: realtimePrice && realtimePrice.price_change >= 0 ? '#3f8600' : '#cf1322',
                  fontSize: '2rem'
                }}
                suffix={
                  realtimePrice && (
                    <Text 
                      style={{ 
                        color: realtimePrice.price_change >= 0 ? '#3f8600' : '#cf1322',
                        fontSize: '1rem'
                      }}
                    >
                      {realtimePrice.price_change >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      {` ${realtimePrice.price_change.toFixed(2)} (${realtimePrice.price_change_percent.toFixed(2)}%)`}
                    </Text>
                  )
                }
              />
            </Card>
            
            <Card title="Model Prediction" className="shadow-md">
              <Statistic
                value={stockData.future_predictions.prices[stockData.future_predictions.prices.length - 1]}
                precision={2}
                prefix="$"
                valueStyle={{ fontSize: '2rem' }}
                suffix={
                  <Text type="secondary">
                    7 days forecast
                  </Text>
                }
              />
            </Card>
            
            <Card title="Model Accuracy" className="shadow-md">
              <Statistic
                value={stockData.model_accuracy}
                precision={4}
                valueStyle={{ 
                  color: stockData.model_accuracy < 5 ? '#3f8600' : '#cf1322',
                  fontSize: '2rem'
                }}
                suffix="MAE"
              />
              <Text type="secondary">
                Lower is better - Mean Absolute Error of price predictions
              </Text>
            </Card>
          </div>
          
          <Card className="mb-6 shadow-md">
            <div className="flex justify-between items-center mb-4">
              <AntTitle level={4} className="m-0">Price Chart</AntTitle>
              <Select 
                value={timeRange} 
                onChange={setTimeRange}
                style={{ width: 120 }}
              >
                {TIME_RANGES.map(range => (
                  <Option key={range.value} value={range.value}>{range.label}</Option>
                ))}
              </Select>
            </div>
            
            <div style={{ height: '400px' }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </Card>
          
          <Tabs defaultActiveKey="predictions" className="shadow-md bg-white rounded-lg p-4">
            <TabPane tab="Future Predictions" key="predictions">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Predicted Price</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stockData.future_predictions.dates.map((date, index) => {
                      const price = stockData.future_predictions.prices[index];
                      const prevPrice = index === 0 
                        ? stockData.current_price 
                        : stockData.future_predictions.prices[index - 1];
                      const change = price - prevPrice;
                      const percentChange = (change / prevPrice) * 100;
                      const isPositive = change >= 0;
                      
                      return (
                        <tr key={date} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{date}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${price.toFixed(2)}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{percentChange.toFixed(2)}%)
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabPane>
            <TabPane tab="Historical Data" key="historical">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stockData.historical_data.dates.map((date, index) => {
                      if (index === 0) return null; // Skip first row since we don't have previous data
                      
                      const price = stockData.historical_data.prices[index];
                      const prevPrice = stockData.historical_data.prices[index - 1];
                      const change = price - prevPrice;
                      const percentChange = (change / prevPrice) * 100;
                      const isPositive = change >= 0;
                      
                      return (
                        <tr key={date} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{date}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${price.toFixed(2)}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{percentChange.toFixed(2)}%)
                          </td>
                        </tr>
                      );
                    }).reverse().filter(Boolean)}
                  </tbody>
                </table>
              </div>
            </TabPane>
          </Tabs>
        </div>
      ) : (
        <Alert type="warning" message="No data available for this stock symbol" />
      )}
    </Layout>
  );
};

export default StockDetailPage; 