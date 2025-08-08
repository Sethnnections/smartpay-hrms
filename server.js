require('dotenv').config();
const http = require('http');
const logger = require('./utils/logger');
const { connectDB } = require('./config/database');
const app = require('./app');

const port = process.env.PORT || 3000;

// For Vercel serverless environment
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  // Initialize database connection for serverless
  connectDB().catch(error => {
    console.error('Database connection failed:', error);
  });
  
  // Export the app for Vercel
  module.exports = app;
} else {
  // Local development server
  const server = http.createServer(app);
  
  const startServer = async () => {
    try {
      await connectDB();
      server.listen(port, () => {
        logger.info(`🚀 Server running on port ${port}`);
        logger.info(`📁 Views: ${app.get('views')}`);
        logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  };

  // Graceful shutdown
  const shutdown = () => {
    logger.info('🛑 Server is shutting down...');
    server.close(() => {
      logger.info('⛔ Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  startServer();
}
