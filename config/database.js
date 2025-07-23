const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: process.env.DB_NAME
    });
    logger.info('MongoDB Connected...');
  } catch (err) {
    logger.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;