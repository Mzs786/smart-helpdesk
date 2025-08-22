const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters long'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  body: {
    type: String,
    required: [true, 'Article body is required'],
    minlength: [20, 'Article body must be at least 20 characters long'],
    maxlength: [10000, 'Article body cannot exceed 10,000 characters']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    minlength: [2, 'Tags must be at least 2 characters long'],
    maxlength: [50, 'Tags cannot exceed 50 characters']
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  category: {
    type: String,
    enum: ['billing', 'tech', 'shipping', 'other'],
    required: [true, 'Category is required']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required']
  },
  seoTitle: {
    type: String,
    trim: true,
    maxlength: [60, 'SEO title cannot exceed 60 characters']
  },
  seoDescription: {
    type: String,
    trim: true,
    maxlength: [160, 'SEO description cannot exceed 160 characters']
  },
  viewCount: {
    type: Number,
    default: 0
  },
  helpfulCount: {
    type: Number,
    default: 0
  },
  notHelpfulCount: {
    type: Number,
    default: 0
  },
  lastReviewed: {
    type: Date
  },
  reviewCycle: {
    type: Number,
    default: 90, // days
    min: [30, 'Review cycle must be at least 30 days'],
    max: [365, 'Review cycle cannot exceed 365 days']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries
articleSchema.index({ title: 'text', body: 'text', tags: 'text' });
articleSchema.index({ status: 1 });
articleSchema.index({ category: 1 });
articleSchema.index({ tags: 1 });
articleSchema.index({ author: 1 });
articleSchema.index({ createdAt: -1 });
articleSchema.index({ updatedAt: -1 });
articleSchema.index({ viewCount: -1 });

// Virtual for article excerpt
articleSchema.virtual('excerpt').get(function() {
  if (this.body.length <= 150) {
    return this.body;
  }
  return this.body.substring(0, 150) + '...';
});

// Virtual for article URL slug
articleSchema.virtual('slug').get(function() {
  return this.title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
});

// Virtual for article status badge
articleSchema.virtual('statusBadge').get(function() {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    published: 'bg-green-100 text-green-800',
    archived: 'bg-red-100 text-red-800'
  };
  return statusColors[this.status] || 'bg-gray-100 text-gray-800';
});

// Virtual for article category badge
articleSchema.virtual('categoryBadge').get(function() {
  const categoryColors = {
    billing: 'bg-blue-100 text-blue-800',
    tech: 'bg-purple-100 text-purple-800',
    shipping: 'bg-orange-100 text-orange-800',
    other: 'bg-gray-100 text-gray-800'
  };
  return categoryColors[this.category] || 'bg-gray-100 text-gray-800';
});

// Virtual for helpful score
articleSchema.virtual('helpfulScore').get(function() {
  const total = this.helpfulCount + this.notHelpfulCount;
  if (total === 0) return 0;
  return Math.round((this.helpfulCount / total) * 100);
});

// Pre-save middleware to update lastReviewed
articleSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'published') {
    this.lastReviewed = new Date();
  }
  next();
});

// Pre-save middleware to generate SEO fields if not provided
articleSchema.pre('save', function(next) {
  if (!this.seoTitle && this.title) {
    this.seoTitle = this.title;
  }
  if (!this.seoDescription && this.body) {
    this.seoDescription = this.excerpt;
  }
  next();
});

// Instance method to increment view count
articleSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Instance method to mark as helpful
articleSchema.methods.markHelpful = function() {
  this.helpfulCount += 1;
  return this.save();
};

// Instance method to mark as not helpful
articleSchema.methods.markNotHelpful = function() {
  this.notHelpfulCount += 1;
  return this.save();
};

// Instance method to check if review is due
articleSchema.methods.isReviewDue = function() {
  if (!this.lastReviewed) return true;
  const daysSinceReview = (Date.now() - this.lastReviewed.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceReview >= this.reviewCycle;
};

// Static method to find published articles
articleSchema.statics.findPublished = function() {
  return this.find({ status: 'published' });
};

// Static method to find articles by category
articleSchema.statics.findByCategory = function(category) {
  return this.find({ category, status: 'published' });
};

// Static method to find articles by tag
articleSchema.statics.findByTag = function(tag) {
  return this.find({ tags: tag.toLowerCase(), status: 'published' });
};

// Static method to search articles
articleSchema.statics.search = function(query, options = {}) {
  const searchQuery = {
    $text: { $search: query },
    status: 'published'
  };
  
  if (options.category) {
    searchQuery.category = options.category;
  }
  
  if (options.tags && options.tags.length > 0) {
    searchQuery.tags = { $in: options.tags.map(tag => tag.toLowerCase()) };
  }
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 10);
};

// Static method to find articles needing review
articleSchema.statics.findNeedingReview = function() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90); // Default 90 days
  
  return this.find({
    $or: [
      { lastReviewed: { $exists: false } },
      { lastReviewed: { $lt: cutoffDate } }
    ],
    status: 'published'
  });
};

module.exports = mongoose.model('Article', articleSchema);
