const mongoose = require('mongoose');

const agentSuggestionSchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
  predictedCategory: { type: String, enum: ['billing', 'tech', 'shipping', 'other'], required: true },
  articleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article' }],
  draftReply: { type: String, required: true },
  confidence: { type: Number, min: 0, max: 1, required: true },
  autoClosed: { type: Boolean, default: false },
  citations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article' }],
  modelInfo: {
    provider: String,
    model: String,
    promptVersion: String,
    latencyMs: Number,
    stub: { type: Boolean, default: true }
  }
}, { timestamps: true });

module.exports = mongoose.model('AgentSuggestion', agentSuggestionSchema);
