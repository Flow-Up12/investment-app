import React from 'react';
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
  Filler
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const StockChart = ({ predictionData }) => {
  if (!predictionData) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm text-center">
        <p className="text-gray-500">No chart data available</p>
      </div>
    );
  }

  // Extract symbol and current price
  const { symbol, current_price } = predictionData;
  
  // Get historical data
  let historicalDates = [];
  let historicalPrices = [];
  
  if (predictionData.historicalData) {
    if (Array.isArray(predictionData.historicalData)) {
      historicalDates = predictionData.historicalData.map(item => item.date || '');
      historicalPrices = predictionData.historicalData.map(item => item.price || 0);
    } else if (predictionData.historicalData.dates && predictionData.historicalData.prices) {
      historicalDates = predictionData.historicalData.dates;
      historicalPrices = predictionData.historicalData.prices;
    }
  } else if (predictionData.historical_data) {
    if (Array.isArray(predictionData.historical_data)) {
      historicalDates = predictionData.historical_data.map(item => item.date || '');
      historicalPrices = predictionData.historical_data.map(item => item.price || 0);
    } else if (predictionData.historical_data.dates && predictionData.historical_data.prices) {
      historicalDates = predictionData.historical_data.dates;
      historicalPrices = predictionData.historical_data.prices;
    }
  }
  
  // Get future prediction data
  let futureDates = [];
  let futurePrices = [];
  
  if (predictionData.future_predictions) {
    if (Array.isArray(predictionData.future_predictions)) {
      futureDates = predictionData.future_predictions.map(item => item.date || '');
      futurePrices = predictionData.future_predictions.map(item => item.price || 0);
    } else if (predictionData.future_predictions.dates && predictionData.future_predictions.prices) {
      futureDates = predictionData.future_predictions.dates;
      futurePrices = predictionData.future_predictions.prices;
    }
  } else if (predictionData.predictions) {
    if (Array.isArray(predictionData.predictions)) {
      futureDates = predictionData.predictions.map(item => item.date || '');
      futurePrices = predictionData.predictions.map(item => item.price || 0);
    } else if (predictionData.predictions.dates && predictionData.predictions.prices) {
      futureDates = predictionData.predictions.dates;
      futurePrices = predictionData.predictions.prices;
    }
  }
  
  // Make predictions more realistic
  if (current_price && futurePrices.length > 0) {
    futurePrices = futurePrices.map((price, index) => {
      // Calculate raw percentage change
      const rawChange = ((price - current_price) / current_price) * 100;
      
      // Determine max realistic change based on price and days
      let maxChange = 3;
      if (current_price < 10) {
        maxChange = 15;  // More volatile for penny stocks
      } else if (current_price < 50) {
        maxChange = 10;
      } else if (current_price < 200) {
        maxChange = 7;
      } else {
        maxChange = 5;
      }
      
      // Scale by sqrt of days (for more realistic progression)
      const daysFromNow = index + 1;
      const maxForPeriod = maxChange * Math.sqrt(daysFromNow) / Math.sqrt(7);
      
      // Cap the change
      const cappedChange = Math.max(-maxForPeriod, Math.min(maxForPeriod, rawChange));
      
      // Calculate new price
      return current_price * (1 + cappedChange / 100);
    });
  }
  
  // If we don't have data, show a message
  if (historicalDates.length === 0 && futureDates.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm text-center">
        <p className="text-yellow-600">Chart data is not available at the moment.</p>
      </div>
    );
  }
  
  // Determine color based on trend
  const isPriceUp = futurePrices.length > 0 && futurePrices[futurePrices.length - 1] >= current_price;
  const mainColor = isPriceUp ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)';
  const areaColor = isPriceUp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
  
  // Create chart data
  const data = {
    labels: [...historicalDates, ...futureDates],
    datasets: [
      {
        label: 'Price',
        data: [...historicalPrices, ...futurePrices],
        borderColor: mainColor,
        backgroundColor: areaColor,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: 'Prediction',
        data: [...Array(historicalDates.length).fill(null), ...futurePrices],
        borderColor: mainColor,
        borderDash: [5, 5],
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        fill: false,
      }
    ]
  };
  
  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `$${context.parsed.y.toFixed(2)}`;
          },
        },
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
        }
      },
      y: {
        position: 'right',
        ticks: {
          callback: (value) => `$${value.toFixed(2)}`,
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false,
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-base font-medium text-gray-700 mb-3">{symbol} Price History & Prediction</h3>
      <div className="h-64">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

export default StockChart; 