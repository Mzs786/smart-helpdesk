const express = require('express')
const { body, validationResult } = require('express-validator')
const mongoose = require('mongoose')
const { authenticateToken, requireAgent } = require('../middleware/auth')
const Ticket = require('../models/Ticket')
const AuditLog = require('../models/AuditLog')
const { triageTicket } = require('../services/triageService')

const router = express.Router()

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

/**
 * Create a ticket
 */
router.post(
  '/',
  [
    authenticateToken,
    body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 chars'),
    body('description').trim().isLength({ min: 5 }).withMessage('Description must be at least 5 chars'),
    body('category').optional().isIn(['billing', 'tech', 'shipping', 'other']).withMessage('Invalid category'),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() })
    }

    const ticket = await Ticket.create({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category || 'other',
      status: 'open',
      createdBy: req.user._id,
      attachments: req.body.attachments || [],
    })

    await AuditLog.create({
      ticketId: ticket._id,
      traceId: req.requestId,
      actor: 'user',
      action: 'TICKET_CREATED',
      meta: { title: ticket.title },
      timestamp: new Date(),
    })

    triageTicket(ticket._id, { traceId: req.requestId }).catch((err) =>
      console.error('Triage failed', { ticketId: ticket._id.toString(), err: err.message })
    )

    res.status(201).json({ success: true, ticket })
  }
)

/**
 * List tickets
 */
router.get('/', authenticateToken, async (req, res) => {
  const q = {}
  if (req.user.role === 'user') q.createdBy = req.user._id
  if (req.query.status) q.status = req.query.status

  const tickets = await Ticket.find(q).sort({ createdAt: -1 })
  res.json({ success: true, tickets })
})

/**
 * Get ticket by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid ticket ID' })
  }

  const ticket = await Ticket.findById(id)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  if (req.user.role === 'user' && ticket.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  res.json({ success: true, ticket })
})

/**
 * Reply (agent)
 */
router.post(
  '/:id/reply',
  [authenticateToken, requireAgent, body('message').isLength({ min: 2 }).withMessage('Message too short')],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() })
    }

    const { id } = req.params
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ticket ID' })
    }

    const ticket = await Ticket.findById(id)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const close = !!req.body.close
    ticket.status = close ? 'resolved' : 'triaged'
    await ticket.save()

    await AuditLog.create({
      ticketId: ticket._id,
      traceId: req.requestId,
      actor: 'agent',
      action: 'REPLY_SENT',
      meta: { message: req.body.message, close },
      timestamp: new Date(),
    })

    res.json({ success: true, ticket })
  }
)

module.exports = router
