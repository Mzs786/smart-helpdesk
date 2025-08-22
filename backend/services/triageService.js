const { v4: uuid } = require('uuid');
const Ticket = require('../models/Ticket');
const AgentSuggestion = require('../models/AgentSuggestion');
const AuditLog = require('../models/AuditLog');
const Config = require('../models/Config');
const kbSearch = require('./kbSearch');
const llm = require('../agent/llmProvider');

async function log(ticketId, traceId, action, meta = {}, actor = 'system') {
  await AuditLog.create({ ticketId, traceId, actor, action, meta, timestamp: new Date() });
}

async function getFlag(key, fallback) {
  const cfg = await Config.getByKey(key).catch(()=>null);
  return cfg ? cfg.value : fallback;
}

exports.triageTicket = async (ticketId, options = {}) => {
  const traceId = options.traceId || uuid();

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new Error('Ticket not found');

  await log(ticket._id, traceId, 'AGENT_PLAN', { steps: ['classify','retrieve','draft','decision'] });

  const cls = await llm.classify(`${ticket.title}\n\n${ticket.description}`);
  await log(ticket._id, traceId, 'AGENT_CLASSIFIED', cls);

  const query = ticket.description || ticket.title;
  const articles = await kbSearch.searchTop(query, 3);
  await log(ticket._id, traceId, 'KB_RETRIEVED', { articleIds: articles.map(a=>a._id) });

  const t1 = Date.now();
  const drafted = await llm.draft(query, articles);
  const latencyMs = Date.now() - t1;
  await log(ticket._id, traceId, 'DRAFT_GENERATED', { citations: drafted.citations, latencyMs });

  const autoClose = await getFlag('autoCloseEnabled', true);
  const threshold  = await getFlag('confidenceThreshold', 0.78);
  const decision = (autoClose && cls.confidence >= threshold) ? 'auto_close' : 'human';

  await log(ticket._id, traceId, 'DECISION_MADE', { autoClose, threshold, confidence: cls.confidence, decision });

  const suggestion = await AgentSuggestion.create({
    ticketId: ticket._id,
    predictedCategory: cls.predictedCategory,
    articleIds: articles.map(a=>a._id),
    draftReply: drafted.draftReply,
    citations: drafted.citations,
    confidence: cls.confidence,
    autoClosed: decision === 'auto_close',
    modelInfo: { provider: 'stub', model: 'heuristic-1', promptVersion: 'v1', latencyMs, stub: llm.isStub }
  });

  ticket.category = cls.predictedCategory;
  ticket.agentSuggestionId = suggestion._id;
  ticket.status = decision === 'auto_close' ? 'resolved' : 'waiting_human';
  await ticket.save();

  await log(ticket._id, traceId, decision === 'auto_close' ? 'AUTO_CLOSED' : 'ASSIGNED_TO_HUMAN', { suggestionId: suggestion._id });

  return { traceId, suggestionId: suggestion._id, decision };
};
