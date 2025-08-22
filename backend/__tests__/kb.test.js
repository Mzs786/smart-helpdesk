const request = require('supertest')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const app = require('../server')
const Article = require('../models/Article')
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
  await Article.deleteMany({})
  await User.deleteMany({})
})

describe('Knowledge Base Endpoints', () => {
  let testUser

  beforeEach(async () => {
    testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'admin'
    })
    await testUser.save()
  })

  describe('GET /api/kb', () => {
    it('should search articles by query', async () => {
      // Create test articles
      const article1 = new Article({
        title: 'How to get a refund',
        body: 'This article explains the refund process step by step.',
        tags: ['billing', 'refund'],
        status: 'published',
        author: testUser._id,
        category: 'billing'
      })
      await article1.save()

      const article2 = new Article({
        title: 'Payment methods',
        body: 'Learn about different payment options available.',
        tags: ['billing', 'payment'],
        status: 'published',
        author: testUser._id,
        category: 'billing'
      })
      await article2.save()

      const response = await request(app)
        .get('/api/kb?query=refund')
        .expect(200)

      expect(response.body.articles).toHaveLength(1)
      expect(response.body.articles[0].title).toBe('How to get a refund')
    })

    it('should filter articles by status', async () => {
      const article1 = new Article({
        title: 'Published Article',
        body: 'This is a published article.',
        tags: ['test'],
        status: 'published',
        author: testUser._id
      })
      await article1.save()

      const article2 = new Article({
        title: 'Draft Article',
        body: 'This is a draft article.',
        tags: ['test'],
        status: 'draft',
        author: testUser._id
      })
      await article2.save()

      const response = await request(app)
        .get('/api/kb?status=published')
        .expect(200)

      expect(response.body.articles).toHaveLength(1)
      expect(response.body.articles[0].title).toBe('Published Article')
    })

    it('should filter articles by category', async () => {
      const article1 = new Article({
        title: 'Billing Article',
        body: 'This is about billing.',
        tags: ['billing'],
        status: 'published',
        author: testUser._id,
        category: 'billing'
      })
      await article1.save()

      const article2 = new Article({
        title: 'Tech Article',
        body: 'This is about tech support.',
        tags: ['tech'],
        status: 'published',
        author: testUser._id,
        category: 'tech'
      })
      await article2.save()

      const response = await request(app)
        .get('/api/kb?category=billing')
        .expect(200)

      expect(response.body.articles).toHaveLength(1)
      expect(response.body.articles[0].title).toBe('Billing Article')
    })

    it('should return empty array when no articles match', async () => {
      const response = await request(app)
        .get('/api/kb?query=nonexistent')
        .expect(200)

      expect(response.body.articles).toHaveLength(0)
    })
  })

  describe('GET /api/kb/:id', () => {
    it('should return article by ID', async () => {
      const article = new Article({
        title: 'Test Article',
        body: 'This is a test article body.',
        tags: ['test'],
        status: 'published',
        author: testUser._id
      })
      await article.save()

      const response = await request(app)
        .get(`/api/kb/${article._id}`)
        .expect(200)

      expect(response.body.title).toBe('Test Article')
      expect(response.body.body).toBe('This is a test article body.')
    })

    it('should return 404 for non-existent article', async () => {
      const fakeId = new mongoose.Types.ObjectId()
      
      await request(app)
        .get(`/api/kb/${fakeId}`)
        .expect(404)
    })
  })

  describe('POST /api/kb', () => {
    it('should create new article with valid data', async () => {
      const articleData = {
        title: 'New Article',
        body: 'This is a new article.',
        tags: ['new', 'article'],
        category: 'tech',
        status: 'draft'
      }

      const response = await request(app)
        .post('/api/kb')
        .send(articleData)
        .expect(201)

      expect(response.body.title).toBe(articleData.title)
      expect(response.body.body).toBe(articleData.body)
      expect(response.body.tags).toEqual(articleData.tags)
      expect(response.body.category).toBe(articleData.category)
      expect(response.body.status).toBe(articleData.status)
    })

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/kb')
        .send({})
        .expect(400)

      expect(response.body).toHaveProperty('message')
    })
  })

  describe('PUT /api/kb/:id', () => {
    it('should update existing article', async () => {
      const article = new Article({
        title: 'Original Title',
        body: 'Original body.',
        tags: ['original'],
        status: 'draft',
        author: testUser._id
      })
      await article.save()

      const updateData = {
        title: 'Updated Title',
        body: 'Updated body.',
        tags: ['updated']
      }

      const response = await request(app)
        .put(`/api/kb/${article._id}`)
        .send(updateData)
        .expect(200)

      expect(response.body.title).toBe(updateData.title)
      expect(response.body.body).toBe(updateData.body)
      expect(response.body.tags).toEqual(updateData.tags)
    })
  })

  describe('DELETE /api/kb/:id', () => {
    it('should delete article', async () => {
      const article = new Article({
        title: 'Article to Delete',
        body: 'This article will be deleted.',
        tags: ['delete'],
        status: 'draft',
        author: testUser._id
      })
      await article.save()

      await request(app)
        .delete(`/api/kb/${article._id}`)
        .expect(200)

      // Verify article is deleted
      const deletedArticle = await Article.findById(article._id)
      expect(deletedArticle).toBeNull()
    })
  })
})
