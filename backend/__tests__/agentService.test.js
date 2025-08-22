const AgentService = require('../services/agentService')

describe('AgentService', () => {
  let agentService

  beforeEach(() => {
    agentService = new AgentService(true) // Enable stub mode
  })

  describe('stubClassify', () => {
    it('should classify billing tickets correctly', () => {
      const result = agentService.stubClassify('I need a refund for my order')
      expect(result.predictedCategory).toBe('billing')
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('should classify tech tickets correctly', () => {
      const result = agentService.stubClassify('I got an error when trying to login')
      expect(result.predictedCategory).toBe('tech')
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('should classify shipping tickets correctly', () => {
      const result = agentService.stubClassify('Where is my package? It was supposed to be delivered')
      expect(result.predictedCategory).toBe('shipping')
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('should classify other tickets correctly', () => {
      const result = agentService.stubClassify('I have a general question about your services')
      expect(result.predictedCategory).toBe('other')
      expect(result.confidence).toBeGreaterThan(0.1)
    })
  })

  describe('stubDraftReply', () => {
    it('should generate a draft reply with KB articles', () => {
      const articles = [
        { _id: '1', title: 'How to get a refund' },
        { _id: '2', title: 'Payment methods' }
      ]
      
      const result = agentService.stubDraftReply('I need a refund', articles)
      
      expect(result.draftReply).toContain('refund')
      expect(result.draftReply).toContain('How to get a refund')
      expect(result.draftReply).toContain('Payment methods')
      expect(result.citations).toHaveLength(2)
    })

    it('should handle empty articles list', () => {
      const result = agentService.stubDraftReply('I need help', [])
      
      expect(result.draftReply).toContain('I understand you need help')
      expect(result.citations).toHaveLength(0)
    })
  })

  describe('makeDecision', () => {
    it('should auto-close when confidence is above threshold', () => {
      const config = {
        autoCloseEnabled: true,
        confidenceThreshold: 0.7
      }
      
      const result = agentService.makeDecision(0.8, config)
      expect(result.autoClose).toBe(true)
      expect(result.assignToHuman).toBe(false)
    })

    it('should assign to human when confidence is below threshold', () => {
      const config = {
        autoCloseEnabled: true,
        confidenceThreshold: 0.7
      }
      
      const result = agentService.makeDecision(0.5, config)
      expect(result.autoClose).toBe(false)
      expect(result.assignToHuman).toBe(true)
    })

    it('should not auto-close when feature is disabled', () => {
      const config = {
        autoCloseEnabled: false,
        confidenceThreshold: 0.7
      }
      
      const result = agentService.makeDecision(0.9, config)
      expect(result.autoClose).toBe(false)
      expect(result.assignToHuman).toBe(true)
    })
  })
})
