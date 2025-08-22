const express = require('express');
const { body, validationResult } = require('express-validator');
const Config = require('../models/Config');
const AuditLog = require('../models/AuditLog');
const { authenticateToken, requireAdmin, logRequest } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
router.use(logRequest);

/**
 * GET /api/config
 * Get all configurations grouped by category
 */
router.get('/', [authenticateToken, requireAdmin], async (req, res) => {
  try {
    const configs = await Config.find().sort({ category: 1, key: 1 });
    const grouped = configs.reduce((acc, c) => {
      if (!acc[c.category]) acc[c.category] = [];
      acc[c.category].push(c);
      return acc;
    }, {});
    res.json({ success: true, configs: grouped, total: configs.length });
  } catch (err) {
    logger.error('Configuration retrieval failed:', err);
    res.status(500).json({ error: 'Retrieval failed' });
  }
});

/**
 * GET /api/config/public
 * Public configs only
 */
router.get('/public', async (req, res) => {
  try {
    const publicConfigs = await Config.getPublic();
    const obj = {};
    publicConfigs.forEach(c => { obj[c.key] = c.value; });
    res.json({ success: true, config: obj });
  } catch (err) {
    logger.error('Public configuration retrieval failed:', err);
    res.status(500).json({ error: 'Retrieval failed' });
  }
});

/**
 * GET /api/config/:key
 */
router.get('/:key', [authenticateToken, requireAdmin], async (req, res) => {
  try {
    const config = await Config.getByKey(req.params.key);
    if (!config) return res.status(404).json({ error: 'Config not found' });
    res.json({ success: true, config });
  } catch (err) {
    logger.error('Configuration retrieval failed:', err);
    res.status(500).json({ error: 'Retrieval failed' });
  }
});

/**
 * PUT /api/config/:key
 * Update config
 */
router.put('/:key', [
  authenticateToken, requireAdmin,
  body('value').notEmpty().withMessage('Value is required'),
  body('reason').optional().isLength({ min: 5, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { value, reason } = req.body;
    const { config, oldValue } = await Config.setValue(req.params.key, value, req.user._id, reason);

    await AuditLog.create({
      traceId: req.requestId,
      actor: 'admin',
      actorId: req.user._id,
      action: 'SYSTEM_CONFIG_UPDATED',
      resourceType: 'system',
      resourceId: config._id,
      meta: { key: config.key, oldValue, newValue: config.value, reason, category: config.category }
    });

    res.json({ success: true, message: 'Config updated', config });
  } catch (err) {
    logger.error('Config update failed:', err);
    res.status(500).json({ error: 'Update failed', message: err.message });
  }
});

/**
 * POST /api/config/initialize
 */
router.post('/initialize', [authenticateToken, requireAdmin], async (req, res) => {
  try {
    await Config.initializeDefaults();
    res.json({ success: true, message: 'Defaults initialized' });
  } catch (err) {
    logger.error('Initialization failed:', err);
    res.status(500).json({ error: 'Initialization failed' });
  }
});

/**
 * GET /api/config/category/:category
 */
router.get('/category/:category', [authenticateToken, requireAdmin], async (req, res) => {
  try {
    const configs = await Config.getByCategory(req.params.category);
    res.json({ success: true, category: req.params.category, configs, count: configs.length });
  } catch (err) {
    logger.error('Category retrieval failed:', err);
    res.status(500).json({ error: 'Retrieval failed' });
  }
});

/**
 * POST /api/config/bulk-update
 */
router.post('/bulk-update', [
  authenticateToken, requireAdmin,
  body('updates').isArray({ min: 1 }),
  body('updates.*.key').notEmpty(),
  body('updates.*.value').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { updates, reason } = req.body;
    const results = [], failed = [];

    for (const u of updates) {
      try {
        const { config, oldValue } = await Config.setValue(u.key, u.value, req.user._id, reason || 'Bulk update');
        results.push({ key: u.key, oldValue, newValue: config.value });
      } catch (e) {
        failed.push({ key: u.key, error: e.message });
      }
    }

    res.json({ success: true, results, failed, summary: { total: updates.length, successful: results.length, failed: failed.length } });
  } catch (err) {
    logger.error('Bulk update failed:', err);
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

/**
 * GET /api/config/export
 */
router.get('/export', [authenticateToken, requireAdmin], async (req, res) => {
  try {
    const configs = await Config.find().sort({ category: 1, key: 1 });
    res.setHeader('Content-Disposition', `attachment; filename=config-export.json`);
    res.json({ exportedAt: new Date(), by: req.user.email, total: configs.length, configs });
  } catch (err) {
    logger.error('Export failed:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

/**
 * POST /api/config/import
 */
router.post('/import', [
  authenticateToken, requireAdmin,
  body('configs').isArray({ min: 1 })
], async (req, res) => {
  try {
    const { configs, overwrite = false } = req.body;
    const results = [], failed = [];

    for (const cfg of configs) {
      try {
        const existing = await Config.getByKey(cfg.key);
        if (existing && !overwrite) {
          failed.push({ key: cfg.key, error: 'Already exists, overwrite=false' });
          continue;
        }
        if (existing && overwrite) {
          const { config } = await Config.setValue(cfg.key, cfg.value, req.user._id, 'Import overwrite');
          results.push({ key: cfg.key, action: 'updated', config });
        } else {
          const newConfig = new Config(cfg);
          await newConfig.save();
          results.push({ key: cfg.key, action: 'created', config: newConfig });
        }
      } catch (e) {
        failed.push({ key: cfg.key, error: e.message });
      }
    }

    res.json({ success: true, results, failed, summary: { total: configs.length, successful: results.length, failed: failed.length } });
  } catch (err) {
    logger.error('Import failed:', err);
    res.status(500).json({ error: 'Import failed' });
  }
});

module.exports = router;
