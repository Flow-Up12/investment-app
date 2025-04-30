# Investment App

A stock prediction and investment application that allows you to invest money and track your portfolio based on ML predictions.

## Features

- Stock price prediction using machine learning
- Portfolio management for tracking investments
- Transaction history
- Customizable investment limits
- Beautiful visualizations of stock data and predictions

## Tech Stack

- **Frontend**: React, Redux, Chart.js, Tailwind CSS
- **Backend**: Node.js, Express, PostgreSQL, Sequelize
- **ML Prediction**: Python, Flask, scikit-learn, yfinance
- **Deployment**: Docker, Docker Compose

## Prerequisites

- Docker and Docker Compose
- Git

## Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd investment-app
   ```

2. Start the application with Docker Compose:
   ```bash
   docker-compose up
   ```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Prediction Service: http://localhost:5001

## Default User

The application creates a default user with the following details:
- Username: investor
- Email: investor@example.com
- Starting Balance: $50.00

## Investment Workflow

1. Navigate to the Stocks page and select a stock from the dropdown
2. View the stock prediction data and analysis
3. Click "Buy Stock" to purchase shares
4. Track your investments in the Portfolio page
5. View your transaction history in the Transactions page
6. Adjust your investment limits in the Settings page

## API Endpoints

### User Routes
- `GET /api/users/profile` - Get user profile
- `POST /api/users/register` - Create a new user
- `PUT /api/users/settings` - Update user settings
- `POST /api/users/funds` - Add funds to user balance
- `GET /api/users/transactions` - Get transaction history
- `GET /api/users/portfolio-summary` - Get portfolio summary

### Stock Routes
- `GET /api/stocks/symbols` - Get stock symbols
- `GET /api/stocks/predict/:symbol` - Get stock prediction
- `POST /api/stocks/buy` - Buy stock
- `POST /api/stocks/sell` - Sell stock
- `GET /api/stocks/portfolio` - Get user portfolio

## Development

### Running Individual Services

1. Backend:
   ```bash
   cd src/backend
   npm install
   npm run dev
   ```

2. Frontend:
   ```bash
   cd src/frontend
   npm install
   npm start
   ```

3. Prediction Service:
   ```bash
   cd src/prediction
   pip install -r requirements.txt
   python app.py
   ```

## Docker Configuration

The application consists of four Docker containers:
- Frontend (React)
- Backend (Node.js/Express)
- Prediction Service (Python/Flask)
- Database (PostgreSQL)

## License

This project is licensed under the MIT License - see the LICENSE file for details. # investment-app
