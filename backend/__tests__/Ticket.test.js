const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters long'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    minlength: [10, 'Description must be at least 10 characters long'],
    maxlength: [5000, 'Description cannot exceed 5,000 characters']
  },
  category: {
    type: String,
    enum: ['billing', 'tech', 'shipping', 'other'],
    default: 'other'
  },
  status: {
    type: String,
    enum: ['open', 'triaged', 'waiting_human', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  agentSuggestion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentSuggestion'
  },
  attachments: [{
    url: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^https?:\/\/.+/.test(v);
        },
        message: 'Attachment must be a valid URL'
      }
    },
    filename: String,
    contentType: String,
    size: Number
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  sla: {
    responseTime: { type: Number, default: 24 }, // hours
    resolutionTime: { type: Number, default: 72 }, // hours
    responseDeadline: Date,
    resolutionDeadline: Date
  },
  metrics: {
    firstResponseTime: Date,
    resolutionTime: Date,
    reopenCount: { type: Number, default: 0 },
    customerSatisfaction: { type: Number, min: 1, max: 5 }
  },
  internalNotes: [{
    content: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: { type: Date, default: Date.now }
  }],
  lastActivity: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/* ------------------ Indexes ------------------ */
ticketSchema.index({ status: 1 });
ticketSchema.index({ category: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ createdBy: 1 });
ticketSchema.index({ assignee: 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ updatedAt: -1 });
ticketSchema.index({ lastActivity: -1 });
ticketSchema.index({ 'sla.responseDeadline': 1 });
ticketSchema.index({ 'sla.resolutionDeadline': 1 });

/* ------------------ Virtuals ------------------ */
ticketSchema.virtual('ageHours').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60));
});

ticketSchema.virtual('ageDays').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});

ticketSchema.virtual('slaStatus').get(function() {
  if (!this.sla.responseDeadline || !this.sla.resolutionDeadline) return 'not_set';
  const now = new Date();
  if (now > this.sla.resolutionDeadline) return 'resolution_breached';
  if (now > this.sla.responseDeadline) return 'response_breached';
  return 'within_sla';
});

/* ------------------ Middleware ------------------ */
ticketSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('sla.responseTime') || this.isModified('sla.resolutionTime')) {
    const now = new Date();
    this.sla.responseDeadline = new Date(now.getTime() + (this.sla.responseTime * 60 * 60 * 1000));
    this.sla.resolutionDeadline = new Date(now.getTime() + (this.sla.resolutionTime * 60 * 60 * 1000));
  }
  if (this.isModified('status') || this.isModified('assignee')) {
    this.lastActivity = new Date();
  }
  next();
});

/* ------------------ Instance Methods ------------------ */
ticketSchema.methods.assignToAgent = function(agentId) {
  this.assignee = agentId;
  this.status = 'waiting_human';
  this.lastActivity = new Date();
  return this.save();
};

ticketSchema.methods.updateStatus = function(newStatus, note) {
  this.status = newStatus;
  this.lastActivity = new Date();

  if (note) {
    this.internalNotes.push({
      content: note,
      author: null,
      createdAt: new Date()
    });
  }

  if (newStatus === 'resolved' && !this.metrics.firstResponseTime) {
    this.metrics.firstResponseTime = new Date();
  }
  if (newStatus === 'resolved') {
    this.metrics.resolutionTime = new Date();
  }

  return this.save();
};

ticketSchema.methods.addInternalNote = function(content, authorId) {
  this.internalNotes.push({
    content,
    author: authorId,
    createdAt: new Date()
  });
  this.lastActivity = new Date();
  return this.save();
};

ticketSchema.methods.reopen = function(reason) {
  this.status = 'open';
  this.metrics.reopenCount += 1;
  this.lastActivity = new Date();

  if (reason) {
    this.internalNotes.push({
      content: reason,
      author: null,
      createdAt: new Date()
    });
  }

  return this.save();
};

ticketSchema.methods.isSLABreached = function() {
  if (!this.sla.responseDeadline || !this.sla.resolutionDeadline) return false;
  const now = new Date();
  return now > this.sla.responseDeadline || now > this.sla.resolutionDeadline;
};

/* ------------------ Static Methods ------------------ */
ticketSchema.statics.findByStatus = function(status) {
  return this.find({ status }).populate('createdBy', 'name email');
};

ticketSchema.statics.findByAssignee = function(assigneeId) {
  return this.find({ assignee: assigneeId }).populate('createdBy', 'name email');
};

ticketSchema.statics.findByCreator = function(creatorId) {
  return this.find({ createdBy: creatorId });
};

ticketSchema.statics.findNeedingAttention = function() {
  const now = new Date();
  return this.find({
    $or: [
      { status: 'open' },
      { status: 'triaged' },
      { status: 'waiting_human', 'sla.responseDeadline': { $lt: now } }
    ]
  }).populate('createdBy', 'name email');
};

ticketSchema.statics.findSLABreached = function() {
  const now = new Date();
  return this.find({
    $or: [
      { 'sla.responseDeadline': { $lt: now } },
      { 'sla.resolutionDeadline': { $lt: now } }
    ],
    status: { $nin: ['resolved', 'closed'] }
  }).populate('createdBy', 'name email');
};

module.exports = mongoose.model('Ticket', ticketSchema);
