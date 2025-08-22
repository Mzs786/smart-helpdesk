import React from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Ticket,
  BookOpen,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
} from 'lucide-react'

function Dashboard() {
  const { user } = useAuth()

  const { data: stats, isLoading: statsLoading } = useQuery('dashboard-stats', async () => {
    const response = await api.get('/tickets/stats')
    return response.data
  })

  const { data: recentTickets, isLoading: ticketsLoading } = useQuery('recent-tickets', async () => {
    const response = await api.get('/tickets?limit=5&sort=-createdAt')
    return response.data
  })

  const { data: recentArticles, isLoading: articlesLoading } = useQuery('recent-articles', async () => {
    const response = await api.get('/kb?limit=5&sort=-updatedAt')
    return response.data
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'text-warning-600 bg-warning-100'
      case 'triaged':
        return 'text-primary-600 bg-primary-100'
      case 'waiting_human':
        return 'text-warning-600 bg-warning-100'
      case 'resolved':
        return 'text-success-600 bg-success-100'
      case 'closed':
        return 'text-gray-600 bg-gray-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="h-4 w-4" />
      case 'triaged':
        return <Clock className="h-4 w-4" />
      case 'waiting_human':
        return <AlertCircle className="h-4 w-4" />
      case 'resolved':
        return <CheckCircle className="h-4 w-4" />
      case 'closed':
        return <CheckCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  if (statsLoading || ticketsLoading || articlesLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.name}!</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Ticket className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Tickets</p>
                <p className="text-2xl font-semibold text-gray-900">{stats?.totalTickets || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-8 w-8 text-warning-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Open Tickets</p>
                <p className="text-2xl font-semibold text-gray-900">{stats?.openTickets || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-success-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-2xl font-semibold text-gray-900">{stats?.resolvedTickets || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BookOpen className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">KB Articles</p>
                <p className="text-2xl font-semibold text-gray-900">{stats?.totalArticles || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tickets */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="card-title">Recent Tickets</h3>
              <Link
                to="/tickets"
                className="text-sm font-medium text-primary-600 hover:text-primary-500"
              >
                View all
              </Link>
            </div>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {recentTickets?.tickets?.map((ticket) => (
                <div key={ticket._id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/tickets/${ticket._id}`}
                      className="text-sm font-medium text-gray-900 hover:text-primary-600 truncate block"
                    >
                      {ticket.title}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center ml-4">
                    <span className={`badge ${getStatusColor(ticket.status)} flex items-center gap-1`}>
                      {getStatusIcon(ticket.status)}
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {(!recentTickets?.tickets || recentTickets.tickets.length === 0) && (
                <p className="text-gray-500 text-sm">No recent tickets</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent KB Articles */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="card-title">Recent KB Articles</h3>
              <Link
                to="/kb"
                className="text-sm font-medium text-primary-600 hover:text-primary-500"
              >
                View all
              </Link>
            </div>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {recentArticles?.articles?.map((article) => (
                <div key={article._id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/kb/${article._id}`}
                      className="text-sm font-medium text-gray-900 hover:text-primary-600 truncate block"
                    >
                      {article.title}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {new Date(article.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center ml-4">
                    <span className={`badge ${article.status === 'published' ? 'badge-success' : 'badge-secondary'}`}>
                      {article.status}
                    </span>
                  </div>
                </div>
              ))}
              {(!recentArticles?.articles || recentArticles.articles.length === 0) && (
                <p className="text-gray-500 text-sm">No recent articles</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {user?.role === 'admin' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div className="card-content">
            <div className="flex flex-wrap gap-4">
              <Link
                to="/tickets/new"
                className="btn btn-primary"
              >
                Create Ticket
              </Link>
              <Link
                to="/kb/new"
                className="btn btn-outline"
              >
                Add KB Article
              </Link>
              <Link
                to="/settings"
                className="btn btn-outline"
              >
                System Settings
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
