const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Article = require('../models/Article');
const Ticket = require('../models/Ticket');
const Config = require('../models/Config');

// Sample data
const sampleUsers = [
  {
    name: 'Admin User',
    email: 'admin@helpdesk.com',
    password: 'Admin123!',
    role: 'admin'
  },
  {
    name: 'Support Agent',
    email: 'agent@helpdesk.com',
    password: 'Agent123!',
    role: 'agent'
  },
  {
    name: 'John Customer',
    email: 'john@example.com',
    password: 'Customer123!',
    role: 'user'
  },
  {
    name: 'Jane Customer',
    email: 'jane@example.com',
    password: 'Customer123!',
    role: 'user'
  },
  {
    name: 'Bob Customer',
    email: 'bob@example.com',
    password: 'Customer123!',
    role: 'user'
  }
];

const sampleArticles = [
  {
    title: 'How to update payment method',
    body: `To update your payment method:

1. Log into your account
2. Go to Account Settings > Billing
3. Click on "Payment Methods"
4. Click "Add New" or "Edit" existing method
5. Enter your new card details
6. Save the changes`,
    tags: ['billing', 'payments', 'account'],
    status: 'published',
    category: 'billing'
  },
  {
    title: 'Troubleshooting 500 errors',
    body: `If you're experiencing 500 errors:

1. Clear your browser cache and cookies
2. Try accessing the site in an incognito/private window
3. Check if the issue persists across different browsers
4. Contact support if the problem continues`,
    tags: ['tech', 'errors', 'troubleshooting'],
    status: 'published',
    category: 'tech'
  },
  {
    title: 'Tracking your shipment',
    body: `To track your shipment:

1. Use the tracking number provided in your order confirmation email
2. Visit our tracking page or use the carrier's website
3. Enter your tracking number
4. View real-time updates on your package location`,
    tags: ['shipping', 'delivery', 'tracking'],
    status: 'published',
    category: 'shipping'
  },
  {
    title: 'Refund policy and process',
    body: `Our refund policy:

- 30-day money-back guarantee
- Refunds processed within 5-7 business days
- Return shipping costs covered by customer
- Items must be in original condition`,
    tags: ['billing', 'refunds', 'policy'],
    status: 'published',
    category: 'billing'
  },
  {
    title: 'Common login issues and solutions',
    body: `Common login problems and solutions:

1. Forgot password: Use the "Forgot Password" link
2. Account locked: Wait 15 minutes or contact support
3. Invalid credentials: Check caps lock and spelling
4. Browser issues: Try clearing cache or different browser
5. Two-factor authentication: Ensure you have access to your phone/email`,
    tags: ['tech', 'login', 'authentication', 'troubleshooting'],
    status: 'published',
    category: 'tech'
  },
  {
    title: 'Shipping delays and solutions',
    body: `Shipping delays can occur due to:

- Weather conditions
- High package volume
- Customs processing (international)
- Address verification issues`,
    tags: ['shipping', 'delays', 'solutions'],
    status: 'published',
    category: 'shipping'
  }
];

const sampleTickets = [
  {
    title: 'Refund for double charge',
    description: 'I was charged twice for order #1234 on my credit card. I need a refund for the duplicate charge.',
    category: 'billing',
    priority: 'high'
  },
  {
    title: 'App shows 500 on login',
    description: 'Every time I try to log in to the mobile app, I get a 500 error. This happens on both WiFi and mobile data.',
    category: 'tech',
    priority: 'medium'
  },
  {
    title: 'Where is my package?',
    description: 'My shipment was supposed to arrive 5 days ago but the tracking shows no updates. Order #5678.',
    category: 'shipping',
    priority: 'medium'
  },
  {
    title: 'Cannot update payment method',
    description: 'I\'m trying to update my credit card but the system keeps giving me an error message.',
    category: 'billing',
    priority: 'low'
  },
  {
    title: 'Website loading very slowly',
    description: 'The website is taking over 30 seconds to load any page. This has been happening for the past week.',
    category: 'tech',
    priority: 'high'
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await Article.deleteMany({});
    await Ticket.deleteMany({});
    await Config.deleteMany({});
    console.log('✅ Existing data cleared');

    // Initialize default configurations
    console.log('⚙️ Initializing default configurations...');
    await Config.initializeDefaults();
    console.log('✅ Default configurations initialized');

    // Create users with hashed passwords
    console.log('👥 Creating sample users...');
    const createdUsers = [];
    
    for (const userData of sampleUsers) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      const user = new User({
        ...userData,
        password: hashedPassword
      });

      await user.save();
      createdUsers.push(user);
      console.log(`✅ Created user: ${user.email} (${user.role})`);
    }

    // Create articles
    console.log('📚 Creating sample articles...');
    const createdArticles = [];
    
    for (const articleData of sampleArticles) {
      const article = new Article({
        ...articleData,
        author: createdUsers.find(u => u.role === 'admin')._id
      });
      await article.save();
      createdArticles.push(article);
      console.log(`✅ Created article: ${article.title}`);
    }

    // Create tickets
    console.log('🎫 Creating sample tickets...');
    const customerUsers = createdUsers.filter(u => u.role === 'user');
    
    for (let i = 0; i < sampleTickets.length; i++) {
      const ticketData = sampleTickets[i];
      const customer = customerUsers[i % customerUsers.length];
      
      const ticket = new Ticket({
        ...ticketData,
        createdBy: customer._id,
        tags: [ticketData.category, 'sample'],
        attachments: []
      });
      
      await ticket.save();
      console.log(`✅ Created ticket: ${ticket.title} by ${customer.email}`);
    }

    // Extra draft articles
    const draftArticles = [
      {
        title: 'Advanced troubleshooting guide',
        body: 'This is a comprehensive guide for advanced users...',
        tags: ['tech', 'advanced', 'guide'],
        status: 'draft',
        category: 'tech',
        author: createdUsers.find(u => u.role === 'agent')._id
      },
      {
        title: 'International shipping guide',
        body: 'Complete guide for international shipping...',
        tags: ['shipping', 'international', 'guide'],
        status: 'draft',
        category: 'shipping',
        author: createdUsers.find(u => u.role === 'agent')._id
      }
    ];

    for (const draftData of draftArticles) {
      const article = new Article(draftData);
      await article.save();
      console.log(`✅ Created draft article: ${article.title}`);
    }

    // Extra tickets
    const additionalTickets = [
      {
        title: 'Feature request: Dark mode',
        description: 'I would love to see a dark mode option in the mobile app.',
        category: 'other',
        priority: 'low',
        status: 'open'
      },
      {
        title: 'Account verification issue',
        description: 'I\'m unable to verify my email address. The verification link keeps saying it\'s expired.',
        category: 'tech',
        priority: 'medium',
        status: 'waiting_human'
      }
    ];

    for (const ticketData of additionalTickets) {
      const customer = customerUsers[Math.floor(Math.random() * customerUsers.length)];
      const ticket = new Ticket({
        ...ticketData,
        createdBy: customer._id,
        tags: [ticketData.category, 'sample'],
        attachments: []
      });
      await ticket.save();
      console.log(`✅ Created additional ticket: ${ticket.title}`);
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Users: ${createdUsers.length}`);
    console.log(`   Articles: ${createdArticles.length + draftArticles.length}`);
    console.log(`   Tickets: ${sampleTickets.length + additionalTickets.length}`);
    console.log(`   Configurations: ${await Config.countDocuments()}`);
    
    console.log('\n🔑 Sample login credentials:');
    console.log('   Admin: admin@helpdesk.com / Admin123!');
    console.log('   Agent: agent@helpdesk.com / Agent123!');
    console.log('   Customer: john@example.com / Customer123!');

    console.log('\n🚀 You can now start the application and test the features!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
