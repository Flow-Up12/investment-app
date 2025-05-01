const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');

// Bot configuration routes
router.get('/config', botController.getBotConfig);
router.put('/config', botController.updateBotConfig);

// Bot watchlist routes
router.get('/watchlist', botController.getBotWatchlist);
router.post('/watchlist', botController.addToWatchlist);
router.delete('/watchlist/:symbol', botController.removeFromWatchlist);
router.put('/watchlist/:symbol/last-trade', botController.updateLastTradeTime);

// Add a new route for toggling watchlist item active status
router.put('/watchlist/:symbol/status', botController.toggleWatchlistItemStatus);

// Bot actions history
router.get('/actions', botController.getBotActions);
router.post('/actions', botController.recordBotAction);

// Bot funds management
router.post('/funds/allocate', botController.allocateFunds);
router.post('/funds/withdraw', botController.withdrawFunds);

// Bot statistics
router.get('/stats', botController.getBotStats);

// Transactions and performance for a specific stock
router.get('/transactions/:symbol', botController.getStockDetails);

// Manually trigger a bot run
router.post('/run', botController.runBot);

module.exports = router; 