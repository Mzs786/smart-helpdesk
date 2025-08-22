import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  User,
  Tag,
  AlertCircle,
  CheckCircle,
  XCircle,
  Edit,
  Send,
  Bot,
  Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [replyText, setReplyText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // fetch ticket
  const { data: ticket, isLoading } = useQuery(['ticket', id], async () => {
    const response = await api.get(`/tickets/${id}`)
    return response.data.ticket
  })

  // AI Suggestion
  const { data: agentSuggestion } = useQuery(
    ['agent-suggestion', id],
    async () => {
      try {
        const response = await api.get(`/agent/suggestion/${id}`)
        return response.data
      } catch {
        return null
      }
    },
    { enabled: !!ticket }
  )

  // Audit log
  const { data: auditLog } = useQuery(
    ['audit-log', id],
    async () => {
      try {
        const response = await api.get(`/audit/ticket/${id}`)
        return response.data
      } catch {
        return []
      }
    },
    { enabled: !!ticket }
  )

  // Reply mutation
  const replyMutation = useMutation(
    async (replyData) => {
      await api.post(`/tickets/${id}/reply`, replyData)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ticket', id])
        queryClient.invalidateQueries(['audit-log', id])
        setReplyText('')
        toast.success('Reply sent successfully')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to send reply')
      },
    }
  )

  const handleReply = async (e) => {
    e.preventDefault()
    if (!replyText.trim()) return

    setIsSubmitting(true)
    try {
      // ✅ send { message } instead of { content }
      await replyMutation.mutateAsync({ message: replyText })
    } finally {
      setIsSubmitting(false)
    }
  }

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

  const getActionIcon = (action) => {
    switch (action) {
      case 'TICKET_CREATED':
        return <MessageSquare className="h-4 w-4" />
      case 'AGENT_CLASSIFIED':
        return <Bot className="h-4 w-4" />
      case 'KB_RETRIEVED':
        return <Eye className="h-4 w-4" />
      case 'DRAFT_GENERATED':
        return <Edit className="h-4 w-4" />
      case 'AUTO_CLOSED':
        return <CheckCircle className="h-4 w-4" />
      case 'ASSIGNED_TO_HUMAN':
        return <User className="h-4 w-4" />
      case 'REPLY_SENT':
        return <Send className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Ticket not found</h3>
        <button onClick={() => navigate('/tickets')} className="btn btn-primary">
          Back to Tickets
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/tickets')} className="btn btn-outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
            <p className="text-gray-600">Ticket #{ticket._id.slice(-8)}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`badge ${getStatusColor(ticket.status)} flex items-center gap-1`}>
            {getStatusIcon(ticket.status)}
            {ticket.status.replace('_', ' ')}
          </span>
          <span className={`badge ${getPriorityColor(ticket.priority)}`}>
            {ticket.priority}
          </span>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Ticket Details</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <div className="prose max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {ticket.description}
                    </ReactMarkdown>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <p className="text-sm text-gray-900 capitalize">{ticket.category || 'other'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                    <p className="text-sm text-gray-900">
                      {new Date(ticket.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reply form (agents/admins only) */}
          {(user?.role === 'agent' || user?.role === 'admin') && ticket.status !== 'closed' && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Send Reply</h3>
              </div>
              <div className="card-content">
                <form onSubmit={handleReply} className="space-y-4">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="textarea w-full"
                    rows={4}
                    placeholder="Type your reply here..."
                    required
                  />
                  <div className="flex justify-end">
                    <button type="submit" disabled={isSubmitting || !replyText.trim()} className="btn btn-primary">
                      {isSubmitting ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Audit Trail */}
          {auditLog && auditLog.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Audit Trail</h3>
              </div>
              <div className="card-content">
                <div className="space-y-3">
                  {auditLog.map((log) => (
                    <div key={log._id} className="flex items-start gap-3">
                      {getActionIcon(log.action)}
                      <div>
                        <span className="text-sm font-medium">{log.action.replace(/_/g, ' ')}</span>
                        <p className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TicketDetail
