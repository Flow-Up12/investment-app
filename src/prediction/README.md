# Stock Prediction Service

This service provides stock price predictions based on historical data from Finnhub API.

## API Integration

The prediction service uses Finnhub as the primary data source for:
- Real-time price data
- Historical price data
- Company information
- Symbol search

### Setting up Finnhub API Key

1. Sign up for a free Finnhub account at https://finnhub.io/
2. Get your API key from the dashboard
3. Set the API key in your environment:
   ```
   export FINNHUB_API_KEY=your_key_here
   ```

## Prediction Models

The service uses machine learning models to predict future stock prices:
- Linear Regression for simple trend analysis
- Additional models can be implemented as needed

## Error Handling and Fallbacks

If the Finnhub API is unavailable or returns errors, the service will:
1. Retry the request (configurable number of times)
2. Fall back to synthetic data generation for demos and testing

## Development

### Local Setup
1. Install dependencies: `pip install -r requirements.txt`
2. Set your Finnhub API key
3. Run the service: `python app.py`

### Docker Setup
1. Build the image: `docker build -t stock-prediction-service .`
2. Run the container: `docker run -p 5001:5001 -e FINNHUB_API_KEY=your_key_here stock-prediction-service`

## Requirements

- Python 3.9+
- Flask 2.3.3
- pandas 2.1.0
- numpy 1.25.2
- scikit-learn 1.3.0
- yfinance 0.2.57 (upgraded from 0.2.28)
- flask-cors 4.0.0

## API Endpoints

- `/predict?symbol=AAPL&days=7`: Get stock price predictions
- `/symbols`: Get a list of popular stock symbols

## Running the Service

The service is dockerized and can be run with:

```bash
docker-compose up prediction
```

It will be available at http://localhost:5200. 