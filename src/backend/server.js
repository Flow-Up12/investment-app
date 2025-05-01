const express = require('express');
const cors = require('cors');
const { sequelize, testConnection } = require('./config/database');
const userRoutes = require('./routes/userRoutes');
const stockRoutes = require('./routes/stockRoutes');
const botRoutes = require('./routes/botRoutes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3100', 'http://frontend:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/bot', botRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Test database connection
testConnection();

// Sync database models
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully');
    
    // Create default user if not exists
    const { User } = require('./models');
    const defaultUser = await User.findOne({ where: { username: 'investor' } });
    
    if (!defaultUser) {
      await User.create({
        username: 'investor',
        email: 'investor@example.com',
        balance: 10000.00,
        investment_limit: 1000.00,
        daily_limit: 3000.00
      });
      console.log('Default user created');
    }
  } catch (error) {
    console.error('Error syncing database:', error);
  }
};

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  syncDatabase();
}); 