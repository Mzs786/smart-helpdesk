import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from 'react-query'
import Dashboard from '../Dashboard'

// Mock the useAuth hook
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Test User', role: 'admin' },
  }),
}))

// Mock the api service
vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
})

describe('Dashboard', () => {
  it('renders dashboard title and welcome message', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    )
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Welcome back, Test User!')).toBeInTheDocument()
  })

  it('renders stats grid with correct titles', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    )
    
    expect(screen.getByText('Total Tickets')).toBeInTheDocument()
    expect(screen.getByText('Open Tickets')).toBeInTheDocument()
    expect(screen.getByText('Resolved')).toBeInTheDocument()
    expect(screen.getByText('KB Articles')).toBeInTheDocument()
  })

  it('renders recent activity sections', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    )
    
    expect(screen.getByText('Recent Tickets')).toBeInTheDocument()
    expect(screen.getByText('Recent KB Articles')).toBeInTheDocument()
  })

  it('renders quick actions for admin users', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    )
    
    expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    expect(screen.getByText('Create Ticket')).toBeInTheDocument()
    expect(screen.getByText('Add KB Article')).toBeInTheDocument()
    expect(screen.getByText('System Settings')).toBeInTheDocument()
  })
})
