import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Bot,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react'
import toast from 'react-hot-toast'

function Settings() {
  const { user, updateProfile, changePassword } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('profile')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  })

  // Password change form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // System config state
  const [configForm, setConfigForm] = useState({
    autoCloseEnabled: false,
    confidenceThreshold: 0.78,
  })

  const { data: systemConfig, isLoading: configLoading } = useQuery(
    'system-config',
    async () => {
      const response = await api.get('/config')
      return response.data
    },
    { enabled: user?.role === 'admin' }
  )

  const updateConfigMutation = useMutation(
    async (configData) => {
      await api.put(`/config/${configData.key}`, { value: configData.value })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('system-config')
        toast.success('Configuration updated successfully')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update configuration')
      },
    }
  )

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    const result = await updateProfile(profileForm)
    if (result.success) {
      setProfileForm({
        name: user?.name || '',
        email: user?.email || '',
      })
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }

    const result = await changePassword(passwordForm.currentPassword, passwordForm.newPassword)
    if (result.success) {
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    }
  }

  const handleConfigChange = (key, value) => {
    setConfigForm(prev => ({ ...prev, [key]: value }))
    updateConfigMutation.mutate({ key, value })
  }

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'password', name: 'Password', icon: Shield },
    ...(user?.role === 'admin' ? [{ id: 'system', name: 'System', icon: SettingsIcon }] : []),
  ]

  if (configLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account and system preferences</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Profile Information</h3>
              <p className="card-description">Update your personal information</p>
            </div>
            <div className="card-content">
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                    className="input w-full"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                    className="input w-full"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Change Password</h3>
              <p className="card-description">Update your account password</p>
            </div>
            <div className="card-content">
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="currentPassword"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="input w-full pr-10"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      id="newPassword"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="input w-full pr-10"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="input w-full"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary">
                    <Save className="h-4 w-4 mr-2" />
                    Change Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && user?.role === 'admin' && (
          <div className="space-y-6">
            {/* AI Agent Configuration */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary-600" />
                  AI Agent Configuration
                </h3>
                <p className="card-description">Configure the AI agent behavior and thresholds</p>
              </div>
              <div className="card-content">
                <div className="space-y-6">
                  {/* Auto-close Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Auto-close Tickets</h4>
                      <p className="text-sm text-gray-500">
                        Automatically close tickets when AI confidence is above threshold
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={systemConfig?.autoCloseEnabled || false}
                        onChange={(e) => handleConfigChange('autoCloseEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  {/* Confidence Threshold */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confidence Threshold: {Math.round((systemConfig?.confidenceThreshold || 0.78) * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={systemConfig?.confidenceThreshold || 0.78}
                      onChange={(e) => handleConfigChange('confidenceThreshold', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Tickets with confidence above this threshold will be auto-resolved
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* System Information */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">System Information</h3>
                <p className="card-description">Current system status and configuration</p>
              </div>
              <div className="card-content">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Environment
                    </label>
                    <p className="text-sm text-gray-900">
                      {process.env.NODE_ENV || 'development'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      AI Mode
                    </label>
                    <p className="text-sm text-gray-900">
                      {process.env.STUB_MODE === 'true' ? 'Stub Mode' : 'AI API Mode'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Database
                    </label>
                    <p className="text-sm text-gray-900">
                      MongoDB
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Version
                    </label>
                    <p className="text-sm text-gray-900">
                      1.0.0
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Settings
