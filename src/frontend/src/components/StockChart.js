import React, { useState } from 'react';
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

const StockChart = ({ predictionData, timeRange = '1D' }) => {
  const [activePoint, setActivePoint] = useState(null);

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

  // Handle stock splits
  const detectAndAdjustForSplits = (dates, prices) => {
    if (!prices || prices.length < 2) return prices;
    
    const adjustedPrices = [...prices];
    const significantJumpThreshold = 0.6; // 60% change could indicate a split
    
    for (let i = 1; i < prices.length; i++) {
      const priceDiff = Math.abs(prices[i] - prices[i-1]);
      const priceRatio = prices[i] / prices[i-1];
      
      // If there's a huge price jump that looks like a split
      if (priceRatio < 0.4 || priceRatio > 2.5) {
        console.log(`Potential split detected at index ${i}, adjusting prices`);
        
        // Determine the split ratio (approximately)
        let splitRatio;
        if (priceRatio < 1) {
          // Reverse split (price increase)
          splitRatio = Math.round(1 / priceRatio);
        } else {
          // Forward split (price decrease)
          splitRatio = Math.round(priceRatio);
        }
        
        // Adjust historical prices before the split
        for (let j = 0; j < i; j++) {
          if (priceRatio < 1) {
            // For reverse splits, divide earlier prices
            adjustedPrices[j] = adjustedPrices[j] / splitRatio;
          } else {
            // For forward splits, multiply earlier prices
            adjustedPrices[j] = adjustedPrices[j] * splitRatio;
          }
        }
      }
    }
    
    return adjustedPrices;
  };
  
  // Adjust prices for splits
  const adjustedHistoricalPrices = detectAndAdjustForSplits(historicalDates, historicalPrices);
  
  // Generate hourly data if 1H is selected and we don't have enough granularity
  if (timeRange === '1H' && historicalDates.length < 12) {
    // Generate synthetic hourly data for today
    historicalDates = [];
    historicalPrices = [];
    
    const now = new Date();
    const startHour = 9; // Market opens at 9 AM
    const currentHour = now.getHours();
    const endHour = Math.min(currentHour, 16); // Market closes at 4 PM
    
    // Use current price as the last price
    const startPrice = current_price * 0.995; // Slightly lower than current
    const endPrice = current_price;
    
    for (let hour = startHour; hour <= endHour; hour++) {
      const date = new Date();
      date.setHours(hour, 0, 0, 0);
      
      historicalDates.push(date.toISOString());
      
      // Create a slight curve in the price data
      const progress = (hour - startHour) / (endHour - startHour);
      const randomFactor = 1 + (Math.random() * 0.01 - 0.005); // ±0.5% randomness
      const hourPrice = startPrice + (endPrice - startPrice) * Math.pow(progress, 1.2) * randomFactor;
      
      historicalPrices.push(hourPrice);
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
  const isPriceUp = historicalPrices.length > 0 && 
    historicalPrices[historicalPrices.length - 1] >= historicalPrices[0];
  
  // Actual price color - use Robinhood green/red
  const actualPriceColor = isPriceUp ? 'rgb(0, 200, 5)' : 'rgb(255, 80, 0)';
  const actualPriceAreaColor = isPriceUp ? 'rgba(0, 200, 5, 0.1)' : 'rgba(255, 80, 0, 0.1)';
  
  // Bot prediction color - blue
  const predictionColor = 'rgb(33, 150, 243)';

  // Get date formatter based on time range
  const getDateFormatter = () => {
    switch(timeRange) {
      case '1H':
        return (date) => {
          if (typeof date === 'string') {
            const dateObj = new Date(date);
            return dateObj.toLocaleTimeString('en-US', { 
              hour: 'numeric',
              minute: '2-digit',
              hour12: true 
            });
          }
          return date;
        };
      case '1D':
        return (date) => {
          if (typeof date === 'string') {
            const dateObj = new Date(date);
            return dateObj.toLocaleTimeString('en-US', { 
              hour: 'numeric',
              minute: '2-digit',
              hour12: true 
            });
          }
          return date;
        };
      case '1W':
        return (date) => {
          if (typeof date === 'string') {
            const dateObj = new Date(date);
            return dateObj.toLocaleDateString('en-US', { 
              weekday: 'short'
            });
          }
          return date;
        };
      case '1M':
        return (date) => {
          if (typeof date === 'string') {
            const dateObj = new Date(date);
            return dateObj.toLocaleDateString('en-US', { 
              month: 'short',
              day: 'numeric'
            });
          }
          return date;
        };
      case '3M':
      case '1Y': 
        return (date) => {
          if (typeof date === 'string') {
            const dateObj = new Date(date);
            return dateObj.toLocaleDateString('en-US', { 
              month: 'short'
            });
          }
          return date;
        };
      case '5Y':
      case 'ALL':
        return (date) => {
          if (typeof date === 'string') {
            const dateObj = new Date(date);
            return dateObj.toLocaleDateString('en-US', { 
              year: 'numeric'
            });
          }
          return date;
        };
      default:
        return (date) => date;
    }
  };
  
  const dateFormatter = getDateFormatter();
  
  // Format dates for display
  const formattedHistoricalDates = historicalDates.map(dateFormatter);
  const formattedFutureDates = futureDates.map(dateFormatter);
  
  // Create chart data
  const data = {
    labels: [...formattedHistoricalDates, ...formattedFutureDates],
    datasets: [
      {
        label: 'Actual Price',
        data: [...adjustedHistoricalPrices, ...Array(futureDates.length).fill(null)],
        borderColor: actualPriceColor,
        backgroundColor: actualPriceAreaColor,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: actualPriceColor,
      },
      {
        label: 'Bot Prediction',
        data: [...Array(historicalDates.length).fill(null), ...futurePrices],
        borderColor: predictionColor,
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: predictionColor,
        borderDash: [5, 5],
        fill: false,
      }
    ]
  };
  
  // Custom tooltip that looks like Robinhood
  const customTooltip = {
    enabled: false,
    external: function(context) {
      // Tooltip element
      let tooltipEl = document.getElementById('chartjs-tooltip');

      // Create element if it doesn't exist
      if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'chartjs-tooltip';
        tooltipEl.innerHTML = '<div class="tooltip-content"></div>';
        document.body.appendChild(tooltipEl);
      }

      // Hide if no tooltip
      const tooltipModel = context.tooltip;
      if (tooltipModel.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
      }

      // Set caret position
      tooltipEl.classList.remove('above', 'below', 'no-transform');
      if (tooltipModel.yAlign) {
        tooltipEl.classList.add(tooltipModel.yAlign);
      } else {
        tooltipEl.classList.add('no-transform');
      }

      // Get tooltip data
      if (tooltipModel.body) {
        const titleLines = tooltipModel.title || [];
        const bodyLines = tooltipModel.body.map(bodyItem => bodyItem.lines);
        
        // Create tooltip content
        const contentDiv = tooltipEl.querySelector('.tooltip-content');
        
        // Date
        let innerHtml = '<div class="tooltip-date">' + titleLines[0] + '</div>';
        
        // Values
        innerHtml += '<div class="tooltip-values">';
        bodyLines.forEach((body, i) => {
          // Extract dataset label and value
          const value = body[0].split(':')[1].trim();
          const datasetLabel = tooltipModel.dataPoints[i].dataset.label;
          
          // Different colors based on dataset
          const labelColor = datasetLabel.includes('Bot') ? 
            predictionColor : 
            actualPriceColor;
            
          innerHtml += `<div class="tooltip-item">
            <span class="tooltip-label" style="color:${labelColor}">${datasetLabel}:</span>
            <span class="tooltip-value" style="color:${labelColor}">${value}</span>
          </div>`;
        });
        innerHtml += '</div>';
        
        contentDiv.innerHTML = innerHtml;
      }

      // Position the tooltip
      const position = context.chart.canvas.getBoundingClientRect();
      
      tooltipEl.style.opacity = 1;
      tooltipEl.style.position = 'absolute';
      tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
      tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY - 60 + 'px';
      tooltipEl.style.pointerEvents = 'none';
      tooltipEl.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
      tooltipEl.style.padding = '10px';
      tooltipEl.style.borderRadius = '5px';
      tooltipEl.style.color = 'white';
      tooltipEl.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      tooltipEl.style.fontSize = '12px';
      tooltipEl.style.zIndex = 1000;
    }
  };
  
  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide legend - Robinhood style
      },
      tooltip: customTooltip,
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: ['1H', '1D'].includes(timeRange) ? 4 : 6,
          color: '#718096',
          font: {
            size: 11,
          },
        },
        display: true,
        border: {
          display: false,
        },
      },
      y: {
        position: 'right',
        ticks: {
          callback: (value) => `$${value.toFixed(2)}`,
          color: '#718096',
          font: {
            size: 11,
          },
          padding: 10,
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        display: true,
        border: {
          display: false,
        },
      }
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    elements: {
      line: {
        tension: 0.4,
      }
    },
    animation: {
      duration: 750,
    },
    hover: {
      mode: 'index',
      intersect: false,
    },
    onHover: (event, activeElements) => {
      if (activeElements && activeElements.length) {
        setActivePoint(activeElements[0].index);
      } else {
        setActivePoint(null);
      }
    },
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-2 relative">
      {/* Legend in Robinhood style */}
      <div className="flex justify-start gap-4 mb-3 mt-1 ml-2">
        <div className="flex items-center gap-1">
          <div style={{ backgroundColor: actualPriceColor }} className="w-3 h-3 rounded-full"></div>
          <span className="text-xs text-gray-600">Actual Price</span>
        </div>
        <div className="flex items-center gap-1">
          <div style={{ backgroundColor: predictionColor }} className="w-3 h-3 rounded-full"></div>
          <span className="text-xs text-gray-600">Bot Prediction</span>
        </div>
      </div>
      
      <div className="h-72">
        <Line data={data} options={options} />
      </div>
      
      {/* Add CSS for the tooltip */}
      <style jsx global>{`
        .tooltip-date {
          font-size: 11px;
          color: #aaa;
          margin-bottom: 4px;
        }
        .tooltip-values {
          font-size: 13px;
        }
        .tooltip-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 3px;
        }
        .tooltip-value {
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default StockChart; 