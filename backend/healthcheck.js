const mongoose = require('mongoose');
require('dotenv').config();

async function healthCheck() {
  try {
    // Check database connection
    if (mongoose.connection.readyState === 1) {
      console.log('Health check: Database connected');
      process.exit(0);
    } else {
      console.log('Health check: Database not connected');
      process.exit(1);
    }
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

healthCheck();
