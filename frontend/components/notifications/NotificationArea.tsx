import React, { useState, useEffect } from 'react'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Badge } from '@/frontend/components/ui/badge'
import { ScrollArea } from '@/frontend/components/ui/scroll-area'
import { Separator } from '@/frontend/components/ui/separator'
import { 
  Bell, 
  X, 
  Check, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  Clock,
  Settings,
  Zap,
  DollarSign
} from 'lucide-react'

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error' | 'tool' | 'billing'
  title: string
  message: string
  timestamp: Date
  read: boolean
  persistent?: boolean
  actionUrl?: string
  cost?: number
}

interface NotificationAreaProps {
  notifications: Notification[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onDismiss: (id: string) => void
  onClearAll: () => void
  className?: string
}

export const NotificationArea: React.FC<NotificationAreaProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead, 
  onDismiss,
  onClearAll,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'tool' | 'billing'>('all')

  const unreadCount = notifications.filter(n => !n.read).length

  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case 'unread':
        return !notification.read
      case 'tool':
        return notification.type === 'tool'
      case 'billing':
        return notification.type === 'billing'
      default:
        return true
    }
  })

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'tool':
        return <Zap className="h-4 w-4 text-purple-500" />
      case 'billing':
        return <DollarSign className="h-4 w-4 text-blue-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getNotificationBadgeColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800'
      case 'tool':
        return 'bg-purple-100 text-purple-800'
      case 'billing':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsExpanded(!isExpanded)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0 bg-red-500"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Panel */}
      {isExpanded && (
        <Card className="absolute right-0 top-12 w-96 max-h-[500px] shadow-lg border z-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Filter Tabs */}
            <div className="flex gap-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'unread', label: 'Unread', count: unreadCount },
                { key: 'tool', label: 'Tools' },
                { key: 'billing', label: 'Billing' }
              ].map(tab => (
                <Button
                  key={tab.key}
                  variant={filter === tab.key ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter(tab.key as typeof filter)}
                  className="text-xs"
                >
                  {tab.label}
                  {tab.count && tab.count > 0 && (
                    <Badge className="ml-1 h-4 text-xs">{tab.count}</Badge>
                  )}
                </Button>
              ))}
            </div>

            {/* Action Buttons */}
            {notifications.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onMarkAllAsRead}
                  disabled={unreadCount === 0}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Mark All Read
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearAll}
                >
                  Clear All
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {filteredNotifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No notifications</p>
              </div>
            ) : (
              <ScrollArea className="max-h-80">
                <div className="space-y-1">
                  {filteredNotifications.map((notification, index) => (
                    <div key={notification.id}>
                      <div
                        className={`p-3 hover:bg-muted/50 cursor-pointer ${
                          !notification.read ? 'bg-blue-50/50' : ''
                        }`}
                        onClick={() => !notification.read && onMarkAsRead(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {getNotificationIcon(notification.type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm truncate">
                                {notification.title}
                              </h4>
                              <Badge
                                className={`text-xs ${getNotificationBadgeColor(notification.type)}`}
                              >
                                {notification.type}
                              </Badge>
                              {notification.cost && (
                                <Badge variant="outline" className="text-xs">
                                  {notification.cost} tokens
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {formatTimestamp(notification.timestamp)}
                              </span>
                              
                              <div className="flex gap-1">
                                {!notification.read && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onMarkAsRead(notification.id)
                                    }}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                )}
                                
                                {!notification.persistent && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onDismiss(notification.id)
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {index < filteredNotifications.length - 1 && (
                        <Separator />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Hook for managing notifications
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      read: false
    }
    
    setNotifications(prev => [newNotification, ...prev])
  }

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    )
  }

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  // Add some sample notifications for development
  useEffect(() => {
    const sampleNotifications: Omit<Notification, 'id' | 'timestamp' | 'read'>[] = [
      {
        type: 'tool',
        title: 'Tool Execution Completed',
        message: 'Web search for "React best practices" completed successfully',
        cost: 10
      },
      {
        type: 'billing',
        title: 'Token Balance Low',
        message: 'You have 50 tokens remaining. Consider purchasing more.'
      },
      {
        type: 'success',
        title: 'MCP Server Connected',
        message: 'Successfully connected to CodeAnalysis MCP server'
      }
    ]

    // Add sample notifications after a delay
    const timer = setTimeout(() => {
      sampleNotifications.forEach((notification, index) => {
        setTimeout(() => addNotification(notification), index * 1000)
      })
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  return {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    dismiss,
    clearAll
  }
}