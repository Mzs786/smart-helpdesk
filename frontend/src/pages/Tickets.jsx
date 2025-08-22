import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Plus,
  Search,
  Filter,
  Eye,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

function Tickets() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const { data: tickets, isLoading } = useQuery(
    ['tickets', searchTerm, statusFilter, priorityFilter],
    async () => {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (statusFilter) params.append('status', statusFilter)
      if (priorityFilter) params.append('priority', priorityFilter)

      const response = await api.get(`/tickets?${params.toString()}`)
      return response.data // { success, tickets }
    }
  )

  const closeTicketMutation = useMutation(
    async (ticketId) => {
      await api.post(`/tickets/${ticketId}/close`)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('tickets')
        toast.success('Ticket closed successfully')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to close ticket')
      },
    }
  )

  const reopenTicketMutation = useMutation(
    async (ticketId) => {
      await api.post(`/tickets/${ticketId}/reopen`)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('tickets')
        toast.success('Ticket reopened successfully')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to reopen ticket')
      },
    }
  )

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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low':
        return 'text-success-600 bg-success-100'
      case 'medium':
        return 'text-warning-600 bg-warning-100'
      case 'high':
        return 'text-danger-600 bg-danger-100'
      case 'urgent':
        return 'text-danger-600 bg-danger-100'
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
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const handleCloseTicket = (ticketId) => {
    if (window.confirm('Are you sure you want to close this ticket?')) {
      closeTicketMutation.mutate(ticketId)
    }
  }

  const handleReopenTicket = (ticketId) => {
    if (window.confirm('Are you sure you want to reopen this ticket?')) {
      reopenTicketMutation.mutate(ticketId)
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('')
    setPriorityFilter('')
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-gray-600">Manage support tickets and track their progress</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link to="/tickets/new" className="btn btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Link>
        </div>
      </div>

      {/* Tickets List */}
      <div className="card">
        <div className="card-content">
          {tickets?.tickets && tickets.tickets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium">Ticket</th>
                    <th className="px-6 py-3 text-left text-xs font-medium">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.tickets.map((ticket) => (
                    <tr key={ticket._id}>
                      <td className="px-6 py-4">
                        <Link to={`/tickets/${ticket._id}`} className="text-sm font-medium text-gray-900">
                          {ticket.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${getStatusColor(ticket.status)} flex items-center gap-1`}>
                          {getStatusIcon(ticket.status)}
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                      </td>
                      <td className="px-6 py-4">{ticket.category || 'other'}</td>
                      <td className="px-6 py-4">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 flex gap-2">
                        <Link to={`/tickets/${ticket._id}`} className="text-primary-600">
                          <Eye className="h-4 w-4" />
                        </Link>
                        {(user?.role === 'agent' || user?.role === 'admin') && (
                          ticket.status === 'closed' ? (
                            <button onClick={() => handleReopenTicket(ticket._id)} className="text-warning-600">
                              <Clock className="h-4 w-4" />
                            </button>
                          ) : (
                            <button onClick={() => handleCloseTicket(ticket._id)} className="text-success-600">
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No tickets found</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Tickets
