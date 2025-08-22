const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'Config key is required'],
    unique: true,
    trim: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Config value is required']
  },
  type: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    required: [true, 'Config type is required']
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    default: 'system'   // ✅ dynamic categories allowed (not enum-locked)
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isRequired: {
    type: Boolean,
    default: false
  },
  validation: {
    min: Number,
    max: Number,
    pattern: String,
    enum: [mongoose.Schema.Types.Mixed], // ✅ simplified to avoid seeding error
    custom: String
  },
  metadata: {
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changeReason: String,
    version: {
      type: String,
      default: '1.0.0'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
configSchema.index({ category: 1 });
configSchema.index({ isPublic: 1 });

// Virtuals
configSchema.virtual('displayValue').get(function () {
  if (this.type === 'boolean') return this.value ? 'Enabled' : 'Disabled';
  if (['object', 'array'].includes(this.type)) return JSON.stringify(this.value);
  return this.value;
});

configSchema.virtual('formattedValue').get(function () {
  switch (this.type) {
    case 'boolean': return this.value ? 'Yes' : 'No';
    case 'number': return this.value.toLocaleString();
    case 'array': return Array.isArray(this.value) ? this.value.join(', ') : this.value;
    default: return this.value;
  }
});

// Pre-save validation
configSchema.pre('save', function (next) {
  const actualType = Array.isArray(this.value) ? 'array' : typeof this.value;

  if (actualType !== this.type) {
    return next(new Error(`Value type mismatch. Expected ${this.type}, got ${actualType}`));
  }

  if (this.validation) {
    if (this.validation.min !== undefined && this.value < this.validation.min) {
      return next(new Error(`Value ${this.value} is below minimum ${this.validation.min}`));
    }
    if (this.validation.max !== undefined && this.value > this.validation.max) {
      return next(new Error(`Value ${this.value} is above maximum ${this.validation.max}`));
    }
    if (this.validation.pattern) {
      try {
        if (!new RegExp(this.validation.pattern).test(this.value)) {
          return next(new Error(`Value ${this.value} does not match pattern ${this.validation.pattern}`));
        }
      } catch (err) {
        return next(new Error(`Invalid regex pattern: ${this.validation.pattern}`));
      }
    }
    if (this.validation.enum && this.validation.enum.length && !this.validation.enum.includes(this.value)) {
      return next(new Error(`Value ${this.value} is not in allowed values: ${this.validation.enum.join(', ')}`));
    }
  }

  next();
});

// Instance method
configSchema.methods.validateValue = function (newValue) {
  const actualType = Array.isArray(newValue) ? 'array' : typeof newValue;

  if (actualType !== this.type) {
    return { valid: false, error: `Type mismatch. Expected ${this.type}, got ${actualType}` };
  }

  if (this.validation) {
    if (this.validation.min !== undefined && newValue < this.validation.min) {
      return { valid: false, error: `Value ${newValue} is below minimum ${this.validation.min}` };
    }
    if (this.validation.max !== undefined && newValue > this.validation.max) {
      return { valid: false, error: `Value ${newValue} is above maximum ${this.validation.max}` };
    }
    if (this.validation.pattern) {
      try {
        if (!new RegExp(this.validation.pattern).test(newValue)) {
          return { valid: false, error: `Value ${newValue} does not match pattern ${this.validation.pattern}` };
        }
      } catch {
        return { valid: false, error: `Invalid regex pattern: ${this.validation.pattern}` };
      }
    }
    if (this.validation.enum && this.validation.enum.length && !this.validation.enum.includes(newValue)) {
      return { valid: false, error: `Value ${newValue} is not in allowed values: ${this.validation.enum.join(', ')}` };
    }
  }

  return { valid: true };
};

// Static methods
configSchema.statics.getByKey = function (key) {
  return this.findOne({ key });
};

configSchema.statics.getByCategory = function (category) {
  return this.find({ category });
};

configSchema.statics.getPublic = function () {
  return this.find({ isPublic: true });
};

configSchema.statics.setValue = async function (key, value, userId, reason) {
  const config = await this.findOne({ key });
  if (!config) throw new Error(`Config key '${key}' not found`);

  const validation = config.validateValue(value);
  if (!validation.valid) throw new Error(validation.error);

  const oldValue = config.value; // ✅ preserve oldValue
  config.value = value;
  config.metadata.lastModifiedBy = userId;
  config.metadata.changeReason = reason;
  config.metadata.version = this.incrementVersion(config.metadata.version);

  await config.save();
  return { config, oldValue }; // ✅ return both
};

configSchema.statics.getAllAsObject = async function () {
  const configs = await this.find();
  return configs.reduce((acc, cfg) => {
    acc[cfg.key] = cfg.value;
    return acc;
  }, {});
};

configSchema.statics.initializeDefaults = async function () {
  const defaultConfigs = [
    {
      key: 'autoCloseEnabled',
      value: true,
      type: 'boolean',
      description: 'Enable automatic ticket closure for high-confidence AI responses',
      category: 'agent',
      isPublic: true,
      isRequired: true
    },
    {
      key: 'confidenceThreshold',
      value: 0.78,
      type: 'number',
      description: 'Minimum confidence score required for auto-close (0.0 - 1.0)',
      category: 'agent',
      isPublic: true,
      isRequired: true,
      validation: { min: 0, max: 1 }
    },
    {
      key: 'slaHours',
      value: 24,
      type: 'number',
      description: 'Default SLA response time in hours',
      category: 'sla',
      isPublic: true,
      isRequired: true,
      validation: { min: 1, max: 168 }
    },
    {
      key: 'maxAttachments',
      value: 5,
      type: 'number',
      description: 'Maximum number of attachments per ticket',
      category: 'system',
      isPublic: true,
      isRequired: true,
      validation: { min: 1, max: 20 }
    },
    {
      key: 'maxTicketLength',
      value: 5000,
      type: 'number',
      description: 'Maximum ticket description length in characters',
      category: 'system',
      isPublic: true,
      isRequired: true,
      validation: { min: 100, max: 10000 }
    },
    {
      key: 'notificationEmail',
      value: 'support@company.com',
      type: 'string',
      description: 'Default support email address',
      category: 'notification',
      isPublic: true,
      isRequired: true
    },
    {
      key: 'maintenanceMode',
      value: false,
      type: 'boolean',
      description: 'Enable maintenance mode',
      category: 'system',
      isPublic: true,
      isRequired: true
    },
    {
      key: 'sessionTimeout',
      value: 3600,
      type: 'number',
      description: 'Session timeout in seconds',
      category: 'security',
      isPublic: false,
      isRequired: true,
      validation: { min: 300, max: 86400 }
    }
  ];

  for (const config of defaultConfigs) {
    const exists = await this.findOne({ key: config.key });
    if (!exists) await this.create(config);
  }
};

configSchema.statics.incrementVersion = function (version) {
  if (!version) return '1.0.0';
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
};

module.exports = mongoose.model('Config', configSchema);
