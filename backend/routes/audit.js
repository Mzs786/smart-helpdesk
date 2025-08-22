const express = require('express');
const { query, validationResult } = require('express-validator');
const AuditLog = require('../models/AuditLog');
const { authenticateToken, requireAgent, logRequest } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Apply logging middleware to all audit routes
router.use(logRequest);

/**
 * @route   GET /api/audit
 * @desc    Get audit logs with filtering and pagination
 * @access  Private (agent+)
 */
router.get('/', [
  authenticateToken,
  requireAgent,
  query('ticketId')
    .optional()
    .isMongoId()
    .withMessage('Valid ticket ID is required'),
  query('actor')
    .optional()
    .isIn(['system', 'agent', 'user', 'admin'])
    .withMessage('Invalid actor filter'),
  query('action')
    .optional()
    .isString()
    .withMessage('Action must be a string'),
  query('resourceType')
    .optional()
    .isIn(['ticket', 'article', 'user', 'system', 'agent'])
    .withMessage('Invalid resource type filter'),
  query('severity')
    .optional()
    .isIn(['info', 'warning', 'error', 'critical'])
    .withMessage('Invalid severity filter'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Search term must be at least 2 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input',
        details: errors.array()
      });
    }

    const { 
      ticketId, 
      actor, 
      action, 
      resourceType, 
      severity,
      startDate, 
      endDate, 
      page = 1, 
      limit = 50,
      search 
    } = req.query;

    // Build query
    const query = {};

    // Filter by ticket ID
    if (ticketId) {
      query.ticketId = ticketId;
    }

    // Filter by actor
    if (actor) {
      query.actor = actor;
    }

    // Filter by action
    if (action) {
      query.action = action;
    }

    // Filter by resource type
    if (resourceType) {
      query.resourceType = resourceType;
    }

    // Filter by severity
    if (severity) {
      query.severity = severity;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Text search in meta fields
    if (search) {
      query.$or = [
        { 'meta.message': { $regex: search, $options: 'i' } },
        { 'meta.error': { $regex: search, $options: 'i' } },
        { 'meta.reason': { $regex: search, $options: 'i' } },
        { 'meta.comment': { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const auditLogs = await AuditLog.find(query)
      .populate('actorId', 'name email')
      .populate('resourceId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await AuditLog.countDocuments(query);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      auditLogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total,
        limit: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    logger.error('Audit log retrieval failed:', error);
    res.status(500).json({
      error: 'Retrieval failed',
      message: 'Failed to retrieve audit logs'
    });
  }
});

/**
 * @route   GET /api/audit/ticket/:ticketId
 * @desc    Get audit trail for a specific ticket
 * @access  Private (agent+)
 */
router.get('/ticket/:ticketId', [
  authenticateToken,
  requireAgent
], async (req, res) => {
  try {
    const { ticketId } = req.params;

    // Get audit trail for the ticket
    const auditTrail = await AuditLog.find({ ticketId })
      .populate('actorId', 'name email')
      .sort({ createdAt: 1 });

    if (auditTrail.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'No audit trail found for this ticket'
      });
    }

    // Group by action type for better organization
    const groupedTrail = auditTrail.reduce((acc, log) => {
      if (!acc[log.action]) {
        acc[log.action] = [];
      }
      acc[log.action].push(log);
      return acc;
    }, {});

    res.json({
      success: true,
      ticketId,
      auditTrail: groupedTrail,
      total: auditTrail.length,
      timeline: auditTrail
    });

  } catch (error) {
    logger.error('Ticket audit trail retrieval failed:', error);
    res.status(500).json({
      error: 'Retrieval failed',
      message: 'Failed to retrieve ticket audit trail'
    });
  }
});

/**
 * @route   GET /api/audit/user/:userId
 * @desc    Get audit trail for a specific user
 * @access  Private (agent+)
 */
router.get('/user/:userId', [
  authenticateToken,
  requireAgent
], async (req, res) => {
  try {
    const { userId } = req.params;

    // Get audit trail for the user
    const auditTrail = await AuditLog.find({ actorId: userId })
      .populate('actorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100); // Limit to recent 100 actions

    if (auditTrail.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'No audit trail found for this user'
      });
    }

    // Group by action type
    const groupedTrail = auditTrail.reduce((acc, log) => {
      if (!acc[log.action]) {
        acc[log.action] = [];
      }
      acc[log.action].push(log);
      return acc;
    }, {});

    res.json({
      success: true,
      userId,
      auditTrail: groupedTrail,
      total: auditTrail.length,
      recent: auditTrail.slice(0, 20)
    });

  } catch (error) {
    logger.error('User audit trail retrieval failed:', error);
    res.status(500).json({
      error: 'Retrieval failed',
      message: 'Failed to retrieve user audit trail'
    });
  }
});

/**
 * @route   GET /api/audit/summary
 * @desc    Get audit summary statistics
 * @access  Private (agent+)
 */
router.get('/summary', [
  authenticateToken,
  requireAgent
], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    }

    // Get action summary
    const actionSummary = await AuditLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          lastOccurrence: { $max: '$createdAt' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get actor summary
    const actorSummary = await AuditLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$actor',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get resource type summary
    const resourceSummary = await AuditLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$resourceType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get severity summary
    const severitySummary = await AuditLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get recent activity (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivity = await AuditLog.countDocuments({
      createdAt: { $gte: last24Hours }
    });

    // Get total count
    const totalLogs = await AuditLog.countDocuments(dateFilter);

    const summary = {
      totalLogs,
      recentActivity: {
        last24Hours: recentActivity
      },
      actionSummary,
      actorSummary,
      resourceSummary,
      severitySummary,
      dateRange: {
        start: startDate || 'all',
        end: endDate || 'all'
      }
    };

    res.json({
      success: true,
      summary
    });

  } catch (error) {
    logger.error('Audit summary retrieval failed:', error);
    res.status(500).json({
      error: 'Summary retrieval failed',
      message: 'Failed to retrieve audit summary'
    });
  }
});

/**
 * @route   GET /api/audit/errors
 * @desc    Get error and critical audit logs
 * @access  Private (agent+)
 */
router.get('/errors', [
  authenticateToken,
  requireAgent,
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    // Get error and critical logs
    const errorLogs = await AuditLog.find({
      severity: { $in: ['error', 'critical'] }
    })
      .populate('actorId', 'name email')
      .populate('resourceId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Get total count
    const total = await AuditLog.countDocuments({
      severity: { $in: ['error', 'critical'] }
    });

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      errorLogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total,
        limit: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    logger.error('Error audit logs retrieval failed:', error);
    res.status(500).json({
      error: 'Retrieval failed',
      message: 'Failed to retrieve error audit logs'
    });
  }
});

/**
 * @route   GET /api/audit/export
 * @desc    Export audit logs to JSON
 * @access  Private (agent+)
 */
router.get('/export', [
  authenticateToken,
  requireAgent,
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be json or csv')
], async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    }

    // Get audit logs
    const auditLogs = await AuditLog.find(dateFilter)
      .populate('actorId', 'name email')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'Timestamp',
        'Action',
        'Actor',
        'Resource Type',
        'Resource ID',
        'Severity',
        'IP Address',
        'User Agent',
        'Metadata'
      ];

      const csvRows = auditLogs.map(log => [
        log.createdAt.toISOString(),
        log.action,
        log.actor,
        log.resourceType,
        log.resourceId || '',
        log.severity,
        log.ipAddress || '',
        log.userAgent || '',
        JSON.stringify(log.meta || {})
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      // Set response headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);

      res.send(csvContent);
    } else {
      // JSON format
      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user.email,
        dateRange: {
          start: startDate || 'all',
          end: endDate || 'all'
        },
        totalLogs: auditLogs.length,
        logs: auditLogs.map(log => ({
          timestamp: log.createdAt,
          action: log.action,
          actor: log.actor,
          actorId: log.actorId,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          severity: log.severity,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          metadata: log.meta,
          traceId: log.traceId
        }))
      };

      // Set response headers for JSON download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`);

      res.json(exportData);
    }

  } catch (error) {
    logger.error('Audit export failed:', error);
    res.status(500).json({
      error: 'Export failed',
      message: 'Failed to export audit logs'
    });
  }
});

/**
 * @route   DELETE /api/audit/cleanup
 * @desc    Clean up old audit logs
 * @access  Private (admin+)
 */
router.delete('/cleanup', [
  authenticateToken,
  requireAgent
], async (req, res) => {
  try {
    const { daysToKeep = 90 } = req.query;

    // Clean up old logs
    const result = await AuditLog.cleanOldLogs(parseInt(daysToKeep));

    logger.info('Audit log cleanup completed', {
      adminId: req.user._id,
      daysToKeep: parseInt(daysToKeep),
      deletedCount: result.deletedCount
    });

    res.json({
      success: true,
      message: 'Audit log cleanup completed successfully',
      result: {
        deletedCount: result.deletedCount,
        daysKept: parseInt(daysToKeep)
      }
    });

  } catch (error) {
    logger.error('Audit log cleanup failed:', error);
    res.status(500).json({
      error: 'Cleanup failed',
      message: 'Failed to clean up audit logs'
    });
  }
});

module.exports = router;
