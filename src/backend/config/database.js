const { Sequelize } = require('sequelize');
require('dotenv').config();

// Get database URL from environment variables or use default
const databaseUrl = process.env.DATABASE_URL || 'postgres://user:password@db:5432/investment_db';

// Create Sequelize instance
const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false, // Set to console.log to see SQL queries
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

module.exports = {
  sequelize,
  testConnection
}; 