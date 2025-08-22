const express = require('express');
const { authenticateToken, requireAgent } = require('../middleware/auth');
const AgentSuggestion = require('../models/AgentSuggestion');
const { triageTicket } = require('../services/triageService');

const router = express.Router();

router.post('/triage', [authenticateToken, requireAgent], async (req,res)=>{
  try {
    const { ticketId } = req.body;
    if (!ticketId) return res.status(400).json({ error: 'ticketId required' });
    const result = await triageTicket(ticketId);
    res.json({ success:true, ...result });
  } catch (e) {
    res.status(500).json({ error: 'Triage failed', message: e.message });
  }
});

router.get('/suggestion/:ticketId', [authenticateToken], async (req,res)=>{
  const s = await AgentSuggestion.findOne({ ticketId: req.params.ticketId }).sort({ createdAt: -1 });
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json({ success:true, suggestion: s });
});

module.exports = router;
