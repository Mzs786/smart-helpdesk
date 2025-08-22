# Smart Helpdesk with Agentic Triage

A modern, AI-powered helpdesk system that automatically triages support tickets using intelligent workflows, knowledge base integration, and automated responses.

## 🚀 Features

### Core Functionality
- **User Authentication & Role Management**: JWT-based auth with Admin, Agent, and User roles
- **Ticket Management**: Create, track, and manage support tickets with full lifecycle
- **Knowledge Base**: CRUD operations for help articles with tagging and categorization
- **Agentic Triage**: AI-powered workflow for automatic ticket classification and response
- **Audit Logging**: Comprehensive tracking of all system actions and decisions

### AI Agentic Workflow
1. **Automatic Classification**: Categorizes tickets (billing, tech, shipping, other)
2. **KB Retrieval**: Finds relevant knowledge base articles using semantic search
3. **Draft Generation**: Creates intelligent response drafts with citations
4. **Smart Decision Making**: Auto-resolves tickets or assigns to humans based on confidence
5. **Full Traceability**: Every step logged with unique trace IDs

### User Experience
- **Responsive Design**: Modern UI built with React and Tailwind CSS
- **Real-time Updates**: Live status changes and notifications
- **Role-based Access**: Different interfaces for different user types
- **Search & Filtering**: Advanced ticket and article discovery

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │    MongoDB      │
│   (React)       │◄──►│   (Node.js)     │◄──►│   Database      │
│                 │    │                 │    │                 │
│ • User Interface│    │ • REST API      │    │ • User Data     │
│ • State Mgmt    │    │ • Agentic Logic │    │ • Tickets       │
│ • Routing       │    │ • Auth          │    │ • KB Articles   │
│ • Components    │    │ • Validation    │    │ • Audit Logs    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js 20+ + Express + Mongoose
- **Database**: MongoDB with comprehensive schemas
- **Authentication**: JWT with role-based access control
- **AI Integration**: Deterministic stub + OpenAI API support
- **Containerization**: Docker Compose for easy deployment

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- MongoDB (provided via Docker)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd smart-helpdesk
```

### 2. Environment Configuration
Create `.env` file in the root directory:
```env
# Backend Configuration
MONGO_URI=mongodb://mongo:27017/helpdesk
JWT_SECRET=your-super-secret-jwt-key-change-this
AUTO_CLOSE_ENABLED=true
CONFIDENCE_THRESHOLD=0.78
STUB_MODE=true

# Optional: OpenAI Integration
OPENAI_API_KEY=your-openai-api-key
```

### 3. Start the Application
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### 4. Seed the Database
```bash
# Seed with sample data
docker compose exec backend npm run seed
```

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **MongoDB**: localhost:27017

## 🔧 Development

### Local Development Setup
```bash
# Install dependencies
npm run install:all

# Start backend (dev mode)
cd backend && npm run dev

# Start frontend (dev mode)
cd frontend && npm run dev
```

### Available Scripts
```bash
# Root level
npm run dev          # Start both frontend and backend
npm run build        # Build both applications
npm run test         # Run all tests
npm run docker:up    # Start Docker services
npm run docker:down  # Stop Docker services

# Backend
cd backend
npm run dev          # Start with nodemon
npm run test         # Run backend tests
npm run seed         # Seed database
npm run lint         # Lint code

# Frontend
cd frontend
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run test         # Run frontend tests
npm run lint         # Lint code
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

**Test Coverage**:
- Authentication & Authorization
- Ticket CRUD operations
- Agentic workflow logic
- Knowledge base management
- Audit logging system

### Frontend Tests
```bash
cd frontend
npm test
```

**Test Coverage**:
- Component rendering
- Form validation
- User interactions
- State management

## 📊 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile

### Ticket Endpoints
- `POST /api/tickets` - Create ticket
- `GET /api/tickets` - List tickets with filters
- `GET /api/tickets/:id` - Get ticket details
- `PUT /api/tickets/:id` - Update ticket
- `POST /api/tickets/:id/reply` - Add reply

### Knowledge Base Endpoints
- `GET /api/kb` - Search articles
- `POST /api/kb` - Create article (Admin/Agent)
- `PUT /api/kb/:id` - Update article (Admin/Agent)
- `DELETE /api/kb/:id` - Delete article (Admin)

### Agent Endpoints
- `POST /api/agent/triage` - Trigger AI triage
- `GET /api/agent/suggestion/:ticketId` - Get AI suggestion
- `GET /api/agent/audit/:ticketId` - View audit trail

## 🤖 AI Agentic Workflow

### How It Works
1. **Ticket Creation**: User submits support ticket
2. **Automatic Trigger**: System automatically starts AI triage workflow
3. **Classification**: AI analyzes ticket content and categorizes it
4. **Knowledge Retrieval**: System searches KB for relevant articles
5. **Response Drafting**: AI generates contextual response with citations
6. **Decision Making**: System decides to auto-resolve or assign to human
7. **Audit Logging**: Every step recorded with trace ID

### Configuration
- **Confidence Threshold**: Minimum confidence for auto-resolution
- **Auto-close Toggle**: Enable/disable automatic ticket closure
- **Stub Mode**: Deterministic fallback when no AI API available

### Deterministic Stub
When `STUB_MODE=true`, the system uses rule-based heuristics:
- **Classification**: Keyword-based category detection
- **Confidence**: Calculated from keyword matches
- **Response Drafting**: Template-based with KB integration

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Role-based Access Control**: Granular permissions
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: Protection against abuse
- **CORS Configuration**: Secure cross-origin requests
- **Security Headers**: Helmet.js security middleware

## 📈 Monitoring & Observability

- **Structured Logging**: Winston-based logging with trace IDs
- **Audit Trail**: Complete action history for compliance
- **Health Checks**: `/healthz` and `/readyz` endpoints
- **Performance Metrics**: Request timing and response tracking
- **Error Tracking**: Comprehensive error logging and handling

## 🐳 Docker Deployment

### Production Build
```bash
# Build production images
docker compose -f docker-compose.yml build

# Start production stack
docker compose -f docker-compose.yml up -d
```

### Environment Variables
All configuration is handled through environment variables:
- Database connections
- JWT secrets
- AI provider settings
- Feature flags
- Security settings

## 🚀 Deployment Options

### Local Development
- Docker Compose for full stack
- Individual service development
- Hot reloading for both frontend and backend

### Production Deployment
- **Cloud Platforms**: AWS, GCP, Azure
- **Container Orchestration**: Kubernetes, Docker Swarm
- **Database**: MongoDB Atlas, self-hosted MongoDB
- **Load Balancing**: Nginx, HAProxy
- **Monitoring**: Prometheus, Grafana, ELK Stack

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the code examples

## 🔮 Roadmap

- [ ] Real-time WebSocket updates
- [ ] Advanced AI model integration
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Mobile application
- [ ] Integration with external tools
- [ ] Advanced SLA management
- [ ] Customer satisfaction surveys

---

**Built with ❤️ using modern web technologies and AI-powered workflows**
