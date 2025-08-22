const winston = require('winston');

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'smart-helpdesk-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File transport for production
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ] : [])
  ]
});

// Helper function to create child logger with trace context
logger.withTrace = (traceId, additionalMeta = {}) => {
  return logger.child({
    traceId,
    ...additionalMeta
  });
};

// Helper function for audit logging
logger.audit = (action, ticketId, traceId, actor, meta = {}) => {
  logger.info('AUDIT_LOG', {
    action,
    ticketId,
    traceId,
    actor,
    ...meta,
    timestamp: new Date().toISOString()
  });
};

// Helper function for agent workflow logging
logger.agent = (step, ticketId, traceId, meta = {}) => {
  logger.info('AGENT_WORKFLOW', {
    step,
    ticketId,
    traceId,
    ...meta,
    timestamp: new Date().toISOString()
  });
};

// Helper function for performance logging
logger.performance = (operation, duration, traceId, meta = {}) => {
  logger.info('PERFORMANCE', {
    operation,
    durationMs: duration,
    traceId,
    ...meta,
    timestamp: new Date().toISOString()
  });
};

module.exports = logger;
