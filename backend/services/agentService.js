const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const Article = require('../models/Article');
const AgentSuggestion = require('../models/AgentSuggestion');
const AuditLog = require('../models/AuditLog');
const Config = require('../models/Config');

class AgentService {
  constructor() {
    this.stubMode = process.env.STUB_MODE === 'true';
    this.provider = this.stubMode ? 'stub' : 'openai';
    this.promptVersion = '1.0.0';
  }

  /**
   * Main triage workflow for a ticket
   */
  async triageTicket(ticketId, ticketData) {
    const traceId = uuidv4();
    const startTime = Date.now();
    
    logger.agent('TRIAGE_STARTED', ticketId, traceId, { 
      provider: this.provider,
      promptVersion: this.promptVersion 
    });

    try {
      // Create agent suggestion record
      const agentSuggestion = new AgentSuggestion({
        ticketId,
        traceId,
        workflow: {
          steps: [],
          overallStatus: 'pending',
          totalDuration: 0
        }
      });

      // Step 1: Classification
      const classificationResult = await this.classifyTicket(ticketData, traceId);
      agentSuggestion.predictedCategory = classificationResult.predictedCategory;
      agentSuggestion.confidence = classificationResult.confidence;
      
      await agentSuggestion.completeWorkflowStep('classification', {
        result: classificationResult,
        duration: Date.now() - startTime
      });

      logger.agent('CLASSIFICATION_COMPLETED', ticketId, traceId, classificationResult);

      // Step 2: KB Retrieval
      const kbResult = await this.retrieveKBArticles(ticketData, classificationResult.predictedCategory, traceId);
      agentSuggestion.articleIds = kbResult.articleIds;
      agentSuggestion.citations = kbResult.citations;
      
      await agentSuggestion.completeWorkflowStep('kb_retrieval', {
        result: kbResult,
        duration: Date.now() - startTime
      });

      logger.agent('KB_RETRIEVAL_COMPLETED', ticketId, traceId, kbResult);

      // Step 3: Draft Generation
      const draftResult = await this.draftReply(ticketData, kbResult, traceId);
      agentSuggestion.draftReply = draftResult.draftReply;
      
      await agentSuggestion.completeWorkflowStep('draft_generation', {
        result: draftResult,
        duration: Date.now() - startTime
      });

      logger.agent('DRAFT_GENERATION_COMPLETED', ticketId, traceId, draftResult);

      // Step 4: Decision Making
      const decisionResult = await this.makeDecision(agentSuggestion, traceId);
      agentSuggestion.autoClosed = decisionResult.autoClosed;
      
      await agentSuggestion.completeWorkflowStep('decision', {
        result: decisionResult,
        duration: Date.now() - startTime
      });

      // Update model info
      agentSuggestion.modelInfo = {
        provider: this.provider,
        model: this.stubMode ? 'stub-v1' : 'gpt-4',
        promptVersion: this.promptVersion,
        latencyMs: Date.now() - startTime
      };

      // Save the suggestion
      await agentSuggestion.save();

      logger.agent('TRIAGE_COMPLETED', ticketId, traceId, {
        autoClosed: decisionResult.autoClosed,
        confidence: agentSuggestion.confidence,
        totalDuration: Date.now() - startTime
      });

      return {
        success: true,
        agentSuggestion: agentSuggestion._id,
        autoClosed: decisionResult.autoClosed,
        traceId,
        duration: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Agent triage failed:', { ticketId, traceId, error: error.message });
      
      // Log the failure
      await AuditLog.create({
        ticketId,
        traceId,
        actor: 'agent',
        action: 'AGENT_WORKFLOW_FAILED',
        resourceType: 'agent',
        resourceId: ticketId,
        meta: { error: error.message },
        severity: 'error'
      });

      throw error;
    }
  }

  /**
   * Classify ticket into category with confidence score
   */
  async classifyTicket(ticketData, traceId) {
    const startTime = Date.now();
    
    try {
      if (this.stubMode) {
        return this.stubClassify(ticketData);
      } else {
        return await this.openaiClassify(ticketData);
      }
    } finally {
      const duration = Date.now() - startTime;
      logger.performance('CLASSIFICATION', duration, traceId, { 
        provider: this.provider,
        textLength: ticketData.description.length 
      });
    }
  }

  /**
   * Stub classification using keyword matching
   */
  stubClassify(ticketData) {
    const text = `${ticketData.title} ${ticketData.description}`.toLowerCase();
    
    // Define keyword patterns for each category
    const patterns = {
      billing: ['refund', 'invoice', 'charge', 'payment', 'billing', 'cost', 'price', 'fee', 'subscription', 'plan'],
      tech: ['error', 'bug', 'crash', 'stack', 'exception', 'code', 'programming', 'software', 'app', 'website', 'login', 'api'],
      shipping: ['delivery', 'shipment', 'package', 'tracking', 'shipping', 'order', 'arrival', 'postal', 'courier', 'logistics']
    };

    let bestCategory = 'other';
    let bestScore = 0;

    // Calculate confidence based on keyword matches
    for (const [category, keywords] of Object.entries(patterns)) {
      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score += 1;
        }
      }
      
      // Normalize score by category length
      const normalizedScore = score / keywords.length;
      if (normalizedScore > bestScore) {
        bestScore = normalizedScore;
        bestCategory = category;
      }
    }

    // Generate pseudo-confidence (0.6 to 0.95)
    const confidence = Math.max(0.6, Math.min(0.95, bestScore + 0.6));

    return {
      predictedCategory: bestCategory,
      confidence: confidence
    };
  }

  /**
   * OpenAI classification (placeholder for real implementation)
   */
  async openaiClassify(ticketData) {
    // This would be implemented with actual OpenAI API calls
    // For now, fall back to stub
    return this.stubClassify(ticketData);
  }

  /**
   * Retrieve relevant KB articles
   */
  async retrieveKBArticles(ticketData, category, traceId) {
    const startTime = Date.now();
    
    try {
      const searchText = `${ticketData.title} ${ticketData.description}`;
      
      // Search for articles by category and relevance
      let articles = await Article.find({
        status: 'published',
        category: category
      }).limit(10);

      // If not enough articles in category, search more broadly
      if (articles.length < 3) {
        const additionalArticles = await Article.find({
          status: 'published',
          category: { $ne: category }
        }).limit(5);
        articles = [...articles, ...additionalArticles];
      }

      // Simple relevance scoring based on text similarity
      const scoredArticles = articles.map(article => {
        const relevance = this.calculateRelevance(searchText, article);
        return { article, relevance };
      });

      // Sort by relevance and take top 3
      const topArticles = scoredArticles
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 3);

      const result = {
        articleIds: topArticles.map(item => item.article._id),
        citations: topArticles.map(item => ({
          articleId: item.article._id,
          relevance: item.relevance,
          snippet: this.generateSnippet(item.article.body, searchText)
        }))
      };

      return result;

    } finally {
      const duration = Date.now() - startTime;
      logger.performance('KB_RETRIEVAL', duration, traceId, { 
        category,
        articlesFound: result?.articleIds?.length || 0 
      });
    }
  }

  /**
   * Calculate relevance score between search text and article
   */
  calculateRelevance(searchText, article) {
    const searchWords = searchText.toLowerCase().split(/\s+/);
    const articleText = `${article.title} ${article.body} ${article.tags.join(' ')}`.toLowerCase();
    
    let score = 0;
    let totalWords = searchWords.length;
    
    for (const word of searchWords) {
      if (word.length < 3) continue; // Skip very short words
      
      if (articleText.includes(word)) {
        score += 1;
      }
      
      // Bonus for title matches
      if (article.title.toLowerCase().includes(word)) {
        score += 0.5;
      }
      
      // Bonus for tag matches
      if (article.tags.some(tag => tag.toLowerCase().includes(word))) {
        score += 0.3;
      }
    }
    
    return Math.min(1.0, score / totalWords);
  }

  /**
   * Generate snippet from article body
   */
  generateSnippet(body, searchText) {
    const maxLength = 150;
    if (body.length <= maxLength) {
      return body;
    }
    
    // Try to find a good starting point
    const searchWords = searchText.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    let bestStart = 0;
    let bestScore = 0;
    
    for (let i = 0; i < body.length - maxLength; i += 10) {
      const snippet = body.substring(i, i + maxLength).toLowerCase();
      let score = 0;
      
      for (const word of searchWords) {
        if (snippet.includes(word)) {
          score += 1;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
      }
    }
    
    return body.substring(bestStart, bestStart + maxLength) + '...';
  }

  /**
   * Draft reply based on KB articles
   */
  async draftReply(ticketData, kbResult, traceId) {
    const startTime = Date.now();
    
    try {
      if (this.stubMode) {
        return this.stubDraftReply(ticketData, kbResult);
      } else {
        return await this.openaiDraftReply(ticketData, kbResult);
      }
    } finally {
      const duration = Date.now() - startTime;
      logger.performance('DRAFT_GENERATION', duration, traceId, { 
        provider: this.provider,
        articlesUsed: kbResult.articleIds.length 
      });
    }
  }

  /**
   * Stub draft reply generation
   */
  async stubDraftReply(ticketData, kbResult) {
    // Fetch article details for better context
    const articles = await Article.find({
      _id: { $in: kbResult.articleIds }
    });

    let draftReply = `Thank you for contacting us regarding "${ticketData.title}". `;
    
    if (articles.length > 0) {
      draftReply += `Based on our knowledge base, here are some solutions that may help:\n\n`;
      
      articles.forEach((article, index) => {
        draftReply += `${index + 1}. **${article.title}**: ${article.excerpt}\n\n`;
      });
      
      draftReply += `If these solutions don't address your issue, please let us know and our support team will be happy to assist you further.`;
    } else {
      draftReply += `We're looking into your request and will get back to you shortly. `;
      draftReply += `In the meantime, you can check our knowledge base for similar issues.`;
    }

    return {
      draftReply: draftReply,
      citations: kbResult.articleIds
    };
  }

  /**
   * OpenAI draft reply generation (placeholder)
   */
  async openaiDraftReply(ticketData, kbResult) {
    // This would be implemented with actual OpenAI API calls
    // For now, fall back to stub
    return this.stubDraftReply(ticketData, kbResult);
  }

  /**
   * Make decision on auto-close vs human assignment
   */
  async makeDecision(agentSuggestion, traceId) {
    const startTime = Date.now();
    
    try {
      // Get configuration
      const config = await Config.getAllAsObject();
      const autoCloseEnabled = config.autoCloseEnabled || false;
      const confidenceThreshold = config.confidenceThreshold || 0.78;

      const shouldAutoClose = autoCloseEnabled && 
                            agentSuggestion.confidence >= confidenceThreshold;

      logger.agent('DECISION_MADE', agentSuggestion.ticketId, traceId, {
        autoCloseEnabled,
        confidenceThreshold,
        confidence: agentSuggestion.confidence,
        decision: shouldAutoClose ? 'auto_close' : 'human_assignment'
      });

      return {
        autoClosed: shouldAutoClose,
        reason: shouldAutoClose 
          ? `High confidence (${(agentSuggestion.confidence * 100).toFixed(1)}%) above threshold (${(confidenceThreshold * 100).toFixed(1)}%)`
          : `Low confidence (${(agentSuggestion.confidence * 100).toFixed(1)}%) below threshold (${(confidenceThreshold * 100).toFixed(1)}%)`
      };

    } finally {
      const duration = Date.now() - startTime;
      logger.performance('DECISION_MAKING', duration, traceId);
    }
  }

  /**
   * Get agent suggestion for a ticket
   */
  async getSuggestion(ticketId) {
    return await AgentSuggestion.findOne({ ticketId })
      .populate('articleIds', 'title body tags category')
      .populate('citations.articleId', 'title body tags category');
  }

  /**
   * Get audit trail for a ticket
   */
  async getAuditTrail(ticketId) {
    return await AuditLog.find({ ticketId })
      .sort({ createdAt: 1 })
      .populate('actorId', 'name email');
  }

  /**
   * Add feedback to agent suggestion
   */
  async addFeedback(suggestionId, feedback, userId) {
    const suggestion = await AgentSuggestion.findById(suggestionId);
    if (!suggestion) {
      throw new Error('Agent suggestion not found');
    }

    await suggestion.addFeedback(feedback, userId);
    
    // Log the feedback
    await AuditLog.create({
      ticketId: suggestion.ticketId,
      traceId: suggestion.traceId,
      actor: 'user',
      actorId: userId,
      action: 'AGENT_FEEDBACK_SUBMITTED',
      resourceType: 'agent',
      resourceId: suggestionId,
      meta: feedback
    });

    return suggestion;
  }
}

module.exports = new AgentService();
