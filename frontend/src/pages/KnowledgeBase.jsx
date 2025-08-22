import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Plus,
  Search,
  Filter,
  BookOpen,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Tag,
  Calendar,
  User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function KnowledgeBase() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [showPreview, setShowPreview] = useState(false)

  const { data: articles, isLoading } = useQuery(
    ['kb-articles', searchTerm, statusFilter, categoryFilter],
    async () => {
      const params = new URLSearchParams()
      if (searchTerm) params.append('query', searchTerm)
      if (statusFilter) params.append('status', statusFilter)
      if (categoryFilter) params.append('category', categoryFilter)
      
      const response = await api.get(`/kb?${params.toString()}`)
      return response.data
    }
  )

  const publishMutation = useMutation(
    async (articleId) => {
      await api.post(`/kb/${articleId}/publish`)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('kb-articles')
        toast.success('Article published successfully')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to publish article')
      },
    }
  )

  const archiveMutation = useMutation(
    async (articleId) => {
      await api.post(`/kb/${articleId}/archive`)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('kb-articles')
        toast.success('Article archived successfully')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to archive article')
      },
    }
  )

  const deleteMutation = useMutation(
    async (articleId) => {
      await api.delete(`/kb/${articleId}`)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('kb-articles')
        toast.success('Article deleted successfully')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete article')
      },
    }
  )

  const handlePublish = (articleId) => {
    if (window.confirm('Are you sure you want to publish this article?')) {
      publishMutation.mutate(articleId)
    }
  }

  const handleArchive = (articleId) => {
    if (window.confirm('Are you sure you want to archive this article?')) {
      archiveMutation.mutate(articleId)
    }
  }

  const handleDelete = (articleId) => {
    if (window.confirm('Are you sure you want to delete this article? This action cannot be undone.')) {
      deleteMutation.mutate(articleId)
    }
  }

  const handlePreview = (article) => {
    setSelectedArticle(article)
    setShowPreview(true)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('')
    setCategoryFilter('')
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'published':
        return 'text-success-600 bg-success-100'
      case 'draft':
        return 'text-warning-600 bg-warning-100'
      case 'archived':
        return 'text-gray-600 bg-gray-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'published':
        return <CheckCircle className="h-4 w-4" />
      case 'draft':
        return <Edit className="h-4 w-4" />
      case 'archived':
        return <XCircle className="h-4 w-4" />
      default:
        return <Edit className="h-4 w-4" />
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-600">Manage help articles and documentation</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'agent') && (
          <div className="mt-4 sm:mt-0">
            <Link
              to="/kb/new"
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </Link>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-content">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 w-full"
                />
              </div>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-outline flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="select w-full"
                  >
                    <option value="">All Statuses</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="select w-full"
                  >
                    <option value="">All Categories</option>
                    <option value="billing">Billing</option>
                    <option value="tech">Technical</option>
                    <option value="shipping">Shipping</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="btn btn-secondary w-full"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Articles List */}
      <div className="card">
        <div className="card-content">
          {articles?.articles && articles.articles.length > 0 ? (
            <div className="space-y-4">
              {articles.articles.map((article) => (
                <div key={article._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {article.title}
                        </h3>
                        <span className={`badge ${getStatusColor(article.status)} flex items-center gap-1`}>
                          {getStatusIcon(article.status)}
                          {article.status}
                        </span>
                        {article.category && (
                          <span className="badge badge-secondary capitalize">
                            {article.category}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {article.excerpt || article.body.substring(0, 150)}...
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {article.author?.name || 'Unknown'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(article.updatedAt).toLocaleDateString()}
                        </div>
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Tag className="h-4 w-4" />
                            {article.tags.slice(0, 3).join(', ')}
                            {article.tags.length > 3 && ` +${article.tags.length - 3} more`}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handlePreview(article)}
                        className="text-primary-600 hover:text-primary-900"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      
                      {(user?.role === 'admin' || user?.role === 'agent') && (
                        <>
                          <Link
                            to={`/kb/${article._id}/edit`}
                            className="text-warning-600 hover:text-warning-900"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                          
                          {article.status === 'draft' ? (
                            <button
                              onClick={() => handlePublish(article._id)}
                              className="text-success-600 hover:text-success-900"
                              title="Publish"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          ) : article.status === 'published' ? (
                            <button
                              onClick={() => handleArchive(article._id)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Archive"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          ) : null}
                          
                          {user?.role === 'admin' && (
                            <button
                              onClick={() => handleDelete(article._id)}
                              className="text-danger-600 hover:text-danger-900"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <BookOpen className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No articles found</h3>
              <p className="text-gray-500 mb-6">
                {searchTerm || statusFilter || categoryFilter
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first knowledge base article'}
              </p>
              {!searchTerm && !statusFilter && !categoryFilter && (user?.role === 'admin' || user?.role === 'agent') && (
                <Link
                  to="/kb/new"
                  className="btn btn-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Article
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && selectedArticle && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowPreview(false)}></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedArticle.title}
                  </h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="prose max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedArticle.body}
                  </ReactMarkdown>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {selectedArticle.author?.name || 'Unknown'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(selectedArticle.updatedAt).toLocaleDateString()}
                    </div>
                    {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Tag className="h-4 w-4" />
                        {selectedArticle.tags.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgeBase
