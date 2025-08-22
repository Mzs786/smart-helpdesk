const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket'
  },
  traceId: {
    type: String,
    required: [true, 'Trace ID is required'],
    index: true
  },
  actor: {
    type: String,
    enum: ['system', 'agent', 'user', 'admin'],
    required: [true, 'Actor is required']
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    enum: [
      // Ticket actions
      'TICKET_CREATED',
      'TICKET_UPDATED',
      'TICKET_STATUS_CHANGED',
      'TICKET_ASSIGNED',
      'TICKET_REPLIED',
      'TICKET_CLOSED',
      'TICKET_REOPENED',
      
      // Agent workflow actions
      'AGENT_TRIAGE_STARTED',
      'AGENT_CLASSIFIED',
      'KB_RETRIEVED',
      'DRAFT_GENERATED',
      'AUTO_CLOSED',
      'ASSIGNED_TO_HUMAN',
      'AGENT_WORKFLOW_COMPLETED',
      'AGENT_WORKFLOW_FAILED',
      
      // KB actions
      'KB_ARTICLE_CREATED',
      'KB_ARTICLE_UPDATED',
      'KB_ARTICLE_DELETED',
      'KB_ARTICLE_PUBLISHED',
      'KB_ARTICLE_ARCHIVED',
      
      // User actions
      'USER_REGISTERED',
      'USER_LOGGED_IN',
      'USER_LOGGED_OUT',
      'USER_PROFILE_UPDATED',
      'USER_ROLE_CHANGED',
      
      // System actions
      'SYSTEM_CONFIG_UPDATED',
      'SYSTEM_BACKUP_CREATED',
      'SYSTEM_MAINTENANCE',
      'SLA_BREACHED',
      'SLA_WARNING'
    ]
  },
  resourceType: {
    type: String,
    enum: ['ticket', 'article', 'user', 'system', 'agent'],
    required: [true, 'Resource type is required']
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: String,
  userAgent: String,
  sessionId: String,
  requestId: String,
  performance: {
    duration: Number, // milliseconds
    memoryUsage: Number, // bytes
    cpuUsage: Number // percentage
  },
  error: {
    message: String,
    stack: String,
    code: String
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries (traceId index is already created by index: true in schema)
auditLogSchema.index({ ticketId: 1 });
auditLogSchema.index({ actor: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ resourceType: 1 });
auditLogSchema.index({ resourceId: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ severity: 1 });
auditLogSchema.index({ 'meta.category': 1 });
auditLogSchema.index({ 'meta.status': 1 });

// Compound indexes for common query patterns
auditLogSchema.index({ ticketId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// Virtual for human-readable action
auditLogSchema.virtual('actionLabel').get(function() {
  const actionLabels = {
    // Ticket actions
    TICKET_CREATED: 'Ticket Created',
    TICKET_UPDATED: 'Ticket Updated',
    TICKET_STATUS_CHANGED: 'Ticket Status Changed',
    TICKET_ASSIGNED: 'Ticket Assigned',
    TICKET_REPLIED: 'Ticket Replied',
    TICKET_CLOSED: 'Ticket Closed',
    TICKET_REOPENED: 'Ticket Reopened',
    
    // Agent workflow actions
    AGENT_TRIAGE_STARTED: 'Agent Triage Started',
    AGENT_CLASSIFIED: 'Agent Classified',
    KB_RETRIEVED: 'KB Articles Retrieved',
    DRAFT_GENERATED: 'Draft Reply Generated',
    AUTO_CLOSED: 'Ticket Auto-Closed',
    ASSIGNED_TO_HUMAN: 'Assigned to Human Agent',
    AGENT_WORKFLOW_COMPLETED: 'Agent Workflow Completed',
    AGENT_WORKFLOW_FAILED: 'Agent Workflow Failed',
    
    // KB actions
    KB_ARTICLE_CREATED: 'KB Article Created',
    KB_ARTICLE_UPDATED: 'KB Article Updated',
    KB_ARTICLE_DELETED: 'KB Article Deleted',
    KB_ARTICLE_PUBLISHED: 'KB Article Published',
    KB_ARTICLE_ARCHIVED: 'KB Article Archived',
    
    // User actions
    USER_REGISTERED: 'User Registered',
    USER_LOGGED_IN: 'User Logged In',
    USER_LOGGED_OUT: 'User Logged Out',
    USER_PROFILE_UPDATED: 'User Profile Updated',
    USER_ROLE_CHANGED: 'User Role Changed',
    
    // System actions
    SYSTEM_CONFIG_UPDATED: 'System Configuration Updated',
    SYSTEM_BACKUP_CREATED: 'System Backup Created',
    SYSTEM_MAINTENANCE: 'System Maintenance',
    SLA_BREACHED: 'SLA Breached',
    SLA_WARNING: 'SLA Warning'
  };
  
  return actionLabels[this.action] || this.action;
});

// Virtual for severity badge
auditLogSchema.virtual('severityBadge').get(function() {
  const severityColors = {
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800'
  };
  return severityColors[this.severity] || 'bg-gray-100 text-gray-800';
});

// Virtual for time ago
auditLogSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return this.createdAt.toLocaleDateString();
});

// Pre-save middleware to add default metadata
auditLogSchema.pre('save', function(next) {
  if (!this.meta.timestamp) {
    this.meta.timestamp = new Date().toISOString();
  }
  
  if (!this.meta.environment) {
    this.meta.environment = process.env.NODE_ENV || 'development';
  }
  
  next();
});

// Static method to find logs by trace ID
auditLogSchema.statics.findByTraceId = function(traceId) {
  return this.find({ traceId }).sort({ createdAt: 1 });
};

// Static method to find logs by ticket ID
auditLogSchema.statics.findByTicketId = function(ticketId) {
  return this.find({ ticketId }).sort({ createdAt: -1 });
};

// Static method to find logs by actor
auditLogSchema.statics.findByActor = function(actor) {
  return this.find({ actor }).sort({ createdAt: -1 });
};

// Static method to find logs by action
auditLogSchema.statics.findByAction = function(action) {
  return this.find({ action }).sort({ createdAt: -1 });
};

// Static method to find logs by severity
auditLogSchema.statics.findBySeverity = function(severity) {
  return this.find({ severity }).sort({ createdAt: -1 });
};

// Static method to find logs in date range
auditLogSchema.statics.findInDateRange = function(startDate, endDate) {
  return this.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ createdAt: -1 });
};

// Static method to find recent logs
auditLogSchema.statics.findRecent = function(hours = 24) {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hours);
  
  return this.find({
    createdAt: { $gte: cutoffDate }
  }).sort({ createdAt: -1 });
};

// Static method to find error logs
auditLogSchema.statics.findErrors = function() {
  return this.find({
    severity: { $in: ['error', 'critical'] }
  }).sort({ createdAt: -1 });
};

// Static method to get audit summary
auditLogSchema.statics.getSummary = async function(ticketId) {
  const summary = await this.aggregate([
    { $match: { ticketId: new mongoose.Types.ObjectId(ticketId) } },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        lastOccurrence: { $max: '$createdAt' },
        actors: { $addToSet: '$actor' }
      }
    },
    { $sort: { lastOccurrence: -1 } }
  ]);
  
  return summary;
};

// Static method to clean old logs
auditLogSchema.statics.cleanOldLogs = async function(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
    severity: { $in: ['info', 'warning'] } // Keep errors and critical logs longer
  });
  
  return result;
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
