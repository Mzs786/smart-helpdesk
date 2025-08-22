const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate JWT token
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Invalid token - user not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Account is deactivated'
      });
    }

    // Add user to request object
    req.user = user;
    req.userId = user._id;
    
    // Log successful authentication
    logger.info('User authenticated', {
      userId: user._id,
      email: user.email,
      role: user.role,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Token expired'
      });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error'
    });
  }
};

/**
 * Middleware to check if user has required role
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Authentication required'
      });
    }

    if (!req.user.hasPermission(requiredRole)) {
      logger.warn('Role access denied', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRole,
        endpoint: req.originalUrl,
        method: req.method
      });

      return res.status(403).json({
        error: 'Access denied',
        message: `Insufficient permissions. Required role: ${requiredRole}`
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is admin
 */
const requireAdmin = requireRole('admin');

/**
 * Middleware to check if user is agent or admin
 */
const requireAgent = requireRole('agent');

/**
 * Middleware to check if user owns the resource or has higher role
 */
const requireOwnershipOrRole = (resourceModel, resourceIdField = '_id', requiredRole = 'agent') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Access denied',
          message: 'Authentication required'
        });
      }

      // Admin and agents can access all resources
      if (req.user.hasPermission(requiredRole)) {
        return next();
      }

      // Get resource ID from request
      const resourceId = req.params[resourceIdField] || req.body[resourceIdField];
      if (!resourceId) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Resource ID is required'
        });
      }

      // Find resource and check ownership
      const resource = await resourceModel.findById(resourceId);
      if (!resource) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Resource not found'
        });
      }

      // Check if user owns the resource
      const ownerField = resourceModel === require('../models/Ticket') ? 'createdBy' : 'author';
      if (resource[ownerField].toString() === req.user._id.toString()) {
        return next();
      }

      // User doesn't own the resource and doesn't have required role
      logger.warn('Resource access denied', {
        userId: req.user._id,
        userRole: req.user.role,
        resourceId,
        resourceType: resourceModel.modelName,
        endpoint: req.originalUrl
      });

      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources'
      });

    } catch (error) {
      logger.error('Ownership check error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to verify resource ownership'
      });
    }
  };
};

/**
 * Middleware to check if user can access ticket
 */
const requireTicketAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Authentication required'
      });
    }

    const ticketId = req.params.id || req.params.ticketId;
    if (!ticketId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Ticket ID is required'
      });
    }

    // Import Ticket model here to avoid circular dependency
    const Ticket = require('../models/Ticket');
    const ticket = await Ticket.findById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ticket not found'
      });
    }

    // Admin and agents can access all tickets
    if (req.user.hasPermission('agent')) {
      req.ticket = ticket;
      return next();
    }

    // Users can only access their own tickets
    if (ticket.createdBy.toString() === req.user._id.toString()) {
      req.ticket = ticket;
      return next();
    }

    // User doesn't have access
    logger.warn('Ticket access denied', {
      userId: req.user._id,
      userRole: req.user.role,
      ticketId,
      endpoint: req.originalUrl
    });

    return res.status(403).json({
      error: 'Access denied',
      message: 'You can only access your own tickets'
    });

  } catch (error) {
    logger.error('Ticket access check error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify ticket access'
    });
  }
};

/**
 * Middleware to log request details for audit
 */
const logRequest = (req, res, next) => {
  req.requestId = require('uuid').v4();
  req.requestStartTime = Date.now();
  
  // Log request start
  logger.info('Request started', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?._id,
    userRole: req.user?.role
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - req.requestStartTime;
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      userId: req.user?._id,
      userRole: req.user?.role
    });
  });

  next();
};

/**
 * Middleware to check if system is in maintenance mode
 */
const checkMaintenanceMode = async (req, res, next) => {
  try {
    // Skip maintenance check for health endpoints
    if (req.path === '/healthz' || req.path === '/readyz') {
      return next();
    }

    // Import Config model here to avoid circular dependency
    const Config = require('../models/Config');
    const maintenanceConfig = await Config.getByKey('maintenanceMode');
    
    if (maintenanceConfig && maintenanceConfig.value === true) {
      // Allow admin users to bypass maintenance mode
      if (req.user && req.user.hasPermission('admin')) {
        return next();
      }

      return res.status(503).json({
        error: 'Service unavailable',
        message: 'System is currently under maintenance. Please try again later.',
        estimatedDuration: '2 hours'
      });
    }

    next();
  } catch (error) {
    logger.error('Maintenance mode check error:', error);
    // Continue if we can't check maintenance mode
    next();
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireAgent,
  requireOwnershipOrRole,
  requireTicketAccess,
  logRequest,
  checkMaintenanceMode
};
