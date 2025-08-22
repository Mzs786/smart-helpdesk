const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const AuditLog = require('../models/AuditLog')
const User = require('../models/User')

let mongoServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  const mongoUri = mongoServer.getUri()
  await mongoose.connect(mongoUri)
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  await AuditLog.deleteMany({})
  await User.deleteMany({})
})

describe('AuditLog Model', () => {
  let testUser

  beforeEach(async () => {
    testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'user'
    })
    await testUser.save()
  })

  it('should create audit log with valid data', async () => {
    const auditData = {
      ticketId: new mongoose.Types.ObjectId(),
      traceId: 'test-trace-123',
      actor: 'user',
      action: 'TICKET_CREATED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId(),
      meta: { description: 'Test ticket created' },
      severity: 'info'
    }

    const auditLog = new AuditLog(auditData)
    await auditLog.save()

    expect(auditLog._id).toBeDefined()
    expect(auditLog.ticketId.toString()).toBe(auditData.ticketId.toString())
    expect(auditLog.traceId).toBe(auditData.traceId)
    expect(auditLog.actor).toBe(auditData.actor)
    expect(auditLog.action).toBe(auditData.action)
    expect(auditLog.resourceType).toBe(auditData.resourceType)
    expect(auditLog.resourceId.toString()).toBe(auditData.resourceId.toString())
    expect(auditLog.meta).toEqual(auditData.meta)
    expect(auditLog.severity).toBe(auditData.severity)
    expect(auditLog.timestamp).toBeDefined()
  })

  it('should set default values correctly', async () => {
    const auditData = {
      ticketId: new mongoose.Types.ObjectId(),
      traceId: 'test-trace-123',
      actor: 'user',
      action: 'TICKET_CREATED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId()
    }

    const auditLog = new AuditLog(auditData)
    await auditLog.save()

    expect(auditLog.meta).toEqual({})
    expect(auditLog.severity).toBe('info')
    expect(auditLog.timestamp).toBeDefined()
  })

  it('should validate required fields', async () => {
    const auditLog = new AuditLog({})
    
    let error
    try {
      await auditLog.save()
    } catch (e) {
      error = e
    }
    
    expect(error).toBeDefined()
    expect(error.errors.ticketId).toBeDefined()
    expect(error.errors.traceId).toBeDefined()
    expect(error.errors.actor).toBeDefined()
    expect(error.errors.action).toBeDefined()
    expect(error.errors.resourceType).toBeDefined()
    expect(error.errors.resourceId).toBeDefined()
  })

  it('should find logs by trace ID', async () => {
    const traceId = 'test-trace-123'
    const auditLog1 = new AuditLog({
      ticketId: new mongoose.Types.ObjectId(),
      traceId,
      actor: 'user',
      action: 'TICKET_CREATED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId()
    })
    await auditLog1.save()

    const auditLog2 = new AuditLog({
      ticketId: new mongoose.Types.ObjectId(),
      traceId,
      actor: 'system',
      action: 'AGENT_CLASSIFIED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId()
    })
    await auditLog2.save()

    const logs = await AuditLog.findByTraceId(traceId)
    expect(logs).toHaveLength(2)
    expect(logs[0].traceId).toBe(traceId)
    expect(logs[1].traceId).toBe(traceId)
  })

  it('should find logs by ticket ID', async () => {
    const ticketId = new mongoose.Types.ObjectId()
    const auditLog = new AuditLog({
      ticketId,
      traceId: 'test-trace-123',
      actor: 'user',
      action: 'TICKET_CREATED',
      resourceType: 'ticket',
      resourceId: ticketId
    })
    await auditLog.save()

    const logs = await AuditLog.findByTicketId(ticketId)
    expect(logs).toHaveLength(1)
    expect(logs[0].ticketId.toString()).toBe(ticketId.toString())
  })

  it('should find logs by actor', async () => {
    const auditLog1 = new AuditLog({
      ticketId: new mongoose.Types.ObjectId(),
      traceId: 'test-trace-123',
      actor: 'user',
      action: 'TICKET_CREATED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId()
    })
    await auditLog1.save()

    const auditLog2 = new AuditLog({
      ticketId: new mongoose.Types.ObjectId(),
      traceId: 'test-trace-456',
      actor: 'system',
      action: 'AGENT_CLASSIFIED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId()
    })
    await auditLog2.save()

    const userLogs = await AuditLog.findByActor('user')
    const systemLogs = await AuditLog.findByActor('system')

    expect(userLogs).toHaveLength(1)
    expect(userLogs[0].actor).toBe('user')
    expect(systemLogs).toHaveLength(1)
    expect(systemLogs[0].actor).toBe('system')
  })

  it('should find logs by action', async () => {
    const auditLog1 = new AuditLog({
      ticketId: new mongoose.Types.ObjectId(),
      traceId: 'test-trace-123',
      actor: 'user',
      action: 'TICKET_CREATED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId()
    })
    await auditLog1.save()

    const auditLog2 = new AuditLog({
      ticketId: new mongoose.Types.ObjectId(),
      traceId: 'test-trace-456',
      actor: 'system',
      action: 'AGENT_CLASSIFIED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId()
    })
    await auditLog2.save()

    const createdLogs = await AuditLog.findByAction('TICKET_CREATED')
    const classifiedLogs = await AuditLog.findByAction('AGENT_CLASSIFIED')

    expect(createdLogs).toHaveLength(1)
    expect(createdLogs[0].action).toBe('TICKET_CREATED')
    expect(classifiedLogs).toHaveLength(1)
    expect(classifiedLogs[0].action).toBe('AGENT_CLASSIFIED')
  })

  it('should find logs by severity', async () => {
    const auditLog1 = new AuditLog({
      ticketId: new mongoose.Types.ObjectId(),
      traceId: 'test-trace-123',
      actor: 'user',
      action: 'TICKET_CREATED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId(),
      severity: 'info'
    })
    await auditLog1.save()

    const auditLog2 = new AuditLog({
      ticketId: new mongoose.Types.ObjectId(),
      traceId: 'test-trace-456',
      actor: 'system',
      action: 'ERROR_OCCURRED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId(),
      severity: 'error'
    })
    await auditLog2.save()

    const infoLogs = await AuditLog.findBySeverity('info')
    const errorLogs = await AuditLog.findBySeverity('error')

    expect(infoLogs).toHaveLength(1)
    expect(infoLogs[0].severity).toBe('info')
    expect(errorLogs).toHaveLength(1)
    expect(errorLogs[0].severity).toBe('error')
  })

  it('should get summary statistics', async () => {
    const auditLog1 = new AuditLog({
      ticketId: new mongoose.Types.ObjectId(),
      traceId: 'test-trace-123',
      actor: 'user',
      action: 'TICKET_CREATED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId(),
      severity: 'info'
    })
    await auditLog1.save()

    const auditLog2 = new AuditLog({
      ticketId: new mongoose.Types.ObjectId(),
      traceId: 'test-trace-456',
      actor: 'system',
      action: 'ERROR_OCCURRED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId(),
      severity: 'error'
    })
    await auditLog2.save()

    const summary = await AuditLog.getSummary()
    
    expect(summary.totalLogs).toBe(2)
    expect(summary.bySeverity.info).toBe(1)
    expect(summary.bySeverity.error).toBe(1)
    expect(summary.byActor.user).toBe(1)
    expect(summary.byActor.system).toBe(1)
  })

  it('should clean old logs', async () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) // 100 days ago
    
    const oldLog = new AuditLog({
      ticketId: new mongoose.Types.ObjectId(),
      traceId: 'old-trace-123',
      actor: 'user',
      action: 'TICKET_CREATED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId(),
      timestamp: oldDate
    })
    await oldLog.save()

    const recentLog = new AuditLog({
      ticketId: new mongoose.Types.ObjectId(),
      traceId: 'recent-trace-123',
      actor: 'user',
      action: 'TICKET_CREATED',
      resourceType: 'ticket',
      resourceId: new mongoose.Types.ObjectId(),
      timestamp: new Date()
    })
    await recentLog.save()

    const deletedCount = await AuditLog.cleanOldLogs(30) // Keep logs from last 30 days
    
    expect(deletedCount).toBe(1)
    
    const remainingLogs = await AuditLog.find()
    expect(remainingLogs).toHaveLength(1)
    expect(remainingLogs[0].traceId).toBe('recent-trace-123')
  })
})
