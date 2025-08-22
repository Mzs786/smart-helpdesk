const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
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
  await User.deleteMany({})
})

describe('User Model', () => {
  it('should create a user with valid data', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'user'
    }

    const user = new User(userData)
    await user.save()

    expect(user._id).toBeDefined()
    expect(user.name).toBe(userData.name)
    expect(user.email).toBe(userData.email)
    expect(user.role).toBe(userData.role)
    expect(user.password).not.toBe(userData.password) // Should be hashed
  })

  it('should hash password before saving', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'user'
    }

    const user = new User(userData)
    await user.save()

    expect(user.password).not.toBe(userData.password)
    expect(user.password).toMatch(/^\$2[aby]\$\d{1,2}\$[./A-Za-z0-9]{53}$/)
  })

  it('should validate email uniqueness', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'user'
    }

    const user1 = new User(userData)
    await user1.save()

    const user2 = new User(userData)
    await expect(user2.save()).rejects.toThrow()
  })

  it('should validate required fields', async () => {
    const user = new User({})
    
    let error
    try {
      await user.save()
    } catch (e) {
      error = e
    }
    
    expect(error).toBeDefined()
    expect(error.errors.name).toBeDefined()
    expect(error.errors.email).toBeDefined()
    expect(error.errors.password).toBeDefined()
  })

  it('should compare passwords correctly', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'user'
    }

    const user = new User(userData)
    await user.save()

    const isMatch = await user.comparePassword('password123')
    expect(isMatch).toBe(true)

    const isNotMatch = await user.comparePassword('wrongpassword')
    expect(isNotMatch).toBe(false)
  })

  it('should check permissions correctly', () => {
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin'
    })

    const agentUser = new User({
      name: 'Agent User',
      email: 'agent@example.com',
      password: 'password123',
      role: 'agent'
    })

    const regularUser = new User({
      name: 'Regular User',
      email: 'user@example.com',
      password: 'password123',
      role: 'user'
    })

    expect(adminUser.hasPermission('admin')).toBe(true)
    expect(adminUser.hasPermission('agent')).toBe(true)
    expect(adminUser.hasPermission('user')).toBe(true)

    expect(agentUser.hasPermission('admin')).toBe(false)
    expect(agentUser.hasPermission('agent')).toBe(true)
    expect(agentUser.hasPermission('user')).toBe(true)

    expect(regularUser.hasPermission('admin')).toBe(false)
    expect(regularUser.hasPermission('agent')).toBe(false)
    expect(regularUser.hasPermission('user')).toBe(true)
  })

  it('should get public profile without sensitive data', () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'user'
    }

    const user = new User(userData)
    const publicProfile = user.getPublicProfile()

    expect(publicProfile).toHaveProperty('_id')
    expect(publicProfile).toHaveProperty('name')
    expect(publicProfile).toHaveProperty('email')
    expect(publicProfile).toHaveProperty('role')
    expect(publicProfile).not.toHaveProperty('password')
    expect(publicProfile).not.toHaveProperty('__v')
  })
})
