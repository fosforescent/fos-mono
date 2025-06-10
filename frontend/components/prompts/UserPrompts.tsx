import React, { useState, useEffect } from 'react'
import { Button } from '@/frontend/components/ui/button'
import { Input } from '@/frontend/components/ui/input'
import { Textarea } from '@/frontend/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Badge } from '@/frontend/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { ScrollArea } from '@/frontend/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/frontend/components/ui/dialog'
import { Label } from '@/frontend/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/frontend/components/ui/radio-group'
import { Checkbox } from '@/frontend/components/ui/checkbox'
import { 
  MessageSquare, 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Calendar,
  Server,
  Filter,
  BarChart3,
  Trash2,
  Eye,
  Reply
} from 'lucide-react'
import { useToast } from '@/frontend/components/ui/use-toast'

interface UserPrompt {
  id: number
  promptId: string
  title: string
  message: string
  promptType: 'input' | 'confirmation' | 'choice'
  options?: string[]
  inputSchema?: any
  defaultValue?: string
  response?: string
  status: 'pending' | 'responded' | 'expired' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  expiresAt?: Date
  respondedAt?: Date
  createdAt: Date
  server?: {
    id: number
    name: string
  }
  isExpired: boolean
}

interface PromptStats {
  total: number
  pending: number
  responded: number
  expired: number
  cancelled: number
}

interface UserPromptsProps {
  apiUrl?: string
  className?: string
}

export const UserPrompts: React.FC<UserPromptsProps> = ({
  apiUrl = '/api',
  className = ''
}) => {
  const [prompts, setPrompts] = useState<UserPrompt[]>([])
  const [stats, setStats] = useState<PromptStats | null>(null)
  const [selectedPrompt, setSelectedPrompt] = useState<UserPrompt | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [selectedChoice, setSelectedChoice] = useState('')
  const [confirmationValue, setConfirmationValue] = useState('')
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  
  const { toast } = useToast()
  const PAGE_SIZE = 20

  useEffect(() => {
    loadPrompts(true)
    loadStats()
  }, [statusFilter, priorityFilter])

  const loadPrompts = async (reset = false) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: (reset ? 0 : page * PAGE_SIZE).toString()
      })

      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (priorityFilter !== 'all') params.append('priority', priorityFilter)

      const response = await fetch(`${apiUrl}/prompts?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) throw new Error('Failed to load prompts')

      const data = await response.json()
      
      if (reset) {
        setPrompts(data.prompts)
        setPage(0)
      } else {
        setPrompts(prev => [...prev, ...data.prompts])
      }
      
      setHasMore(data.pagination.hasMore)
    } catch (error) {
      console.error('Error loading prompts:', error)
      toast({
        title: "Error",
        description: "Failed to load prompts",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch(`${apiUrl}/prompts/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading prompt stats:', error)
    }
  }

  const handleRespondToPrompt = async (prompt: UserPrompt, responseValue: string) => {
    if (!responseValue.trim()) {
      toast({
        title: "Validation Error",
        description: "Response cannot be empty",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/prompts/${prompt.promptId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify({
          response: responseValue
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to respond to prompt')
      }

      toast({
        title: "Success",
        description: "Response submitted successfully"
      })

      setSelectedPrompt(null)
      setResponse('')
      setSelectedChoice('')
      setConfirmationValue('')
      loadPrompts(true)
      loadStats()
    } catch (error) {
      console.error('Error responding to prompt:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to respond to prompt",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelPrompt = async (promptId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/prompts/${promptId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) throw new Error('Failed to cancel prompt')

      toast({
        title: "Success",
        description: "Prompt cancelled successfully"
      })

      loadPrompts(true)
      loadStats()
    } catch (error) {
      console.error('Error cancelling prompt:', error)
      toast({
        title: "Error",
        description: "Failed to cancel prompt",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadMore = () => {
    setPage(prev => prev + 1)
    loadPrompts(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'responded':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'responded':
        return 'bg-green-100 text-green-800'
      case 'expired':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'normal':
        return 'bg-blue-100 text-blue-800'
      case 'low':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString()
  }

  const getTimeUntilExpiry = (expiresAt?: Date) => {
    if (!expiresAt) return null
    
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diff = expiry.getTime() - now.getTime()
    
    if (diff < 0) return 'Expired'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) return `${hours}h ${minutes}m remaining`
    return `${minutes}m remaining`
  }

  const renderPromptResponse = (prompt: UserPrompt) => {
    if (prompt.promptType === 'choice' && prompt.options) {
      return (
        <div className="space-y-3">
          <Label>Select an option:</Label>
          <RadioGroup value={selectedChoice} onValueChange={setSelectedChoice}>
            {prompt.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )
    } else if (prompt.promptType === 'confirmation') {
      return (
        <div className="space-y-3">
          <Label>Choose your response:</Label>
          <RadioGroup value={confirmationValue} onValueChange={setConfirmationValue}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="yes" />
              <Label htmlFor="yes">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="no" />
              <Label htmlFor="no">No</Label>
            </div>
          </RadioGroup>
        </div>
      )
    } else {
      return (
        <div className="space-y-3">
          <Label htmlFor="response">Your response:</Label>
          <Textarea
            id="response"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder={prompt.defaultValue || "Enter your response..."}
            rows={4}
          />
        </div>
      )
    }
  }

  const getResponseValue = (prompt: UserPrompt) => {
    if (prompt.promptType === 'choice') return selectedChoice
    if (prompt.promptType === 'confirmation') return confirmationValue
    return response
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Prompts & Notifications</h2>
        <Button onClick={() => loadPrompts(true)} variant="outline" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="prompts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prompts">Active Prompts</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="responded">Responded</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Priority</Label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prompts List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Prompts ({prompts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {prompts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No prompts found</p>
                </div>
              ) : (
                <>
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {prompts.map((prompt) => (
                        <div key={prompt.id} className="p-4 border rounded">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {getStatusIcon(prompt.status)}
                                <h3 className="font-medium">{prompt.title}</h3>
                                <Badge className={getStatusColor(prompt.status)}>
                                  {prompt.status}
                                </Badge>
                                <Badge className={getPriorityColor(prompt.priority)}>
                                  {prompt.priority}
                                </Badge>
                              </div>

                              <p className="text-sm text-muted-foreground mb-2">
                                {prompt.message}
                              </p>

                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(prompt.createdAt)}
                                </span>
                                {prompt.server && (
                                  <span className="flex items-center gap-1">
                                    <Server className="h-3 w-3" />
                                    {prompt.server.name}
                                  </span>
                                )}
                                {prompt.expiresAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {getTimeUntilExpiry(prompt.expiresAt)}
                                  </span>
                                )}
                              </div>

                              {prompt.response && (
                                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                                  <strong>Response:</strong> {prompt.response}
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2 ml-4">
                              {prompt.status === 'pending' && !prompt.isExpired && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedPrompt(prompt)
                                        setResponse('')
                                        setSelectedChoice('')
                                        setConfirmationValue('')
                                      }}
                                    >
                                      <Reply className="h-3 w-3 mr-1" />
                                      Respond
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>{prompt.title}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div>
                                        <p className="text-sm text-muted-foreground mb-4">
                                          {prompt.message}
                                        </p>
                                        
                                        {renderPromptResponse(prompt)}
                                        
                                        <div className="flex gap-2 mt-4">
                                          <Button
                                            onClick={() => handleRespondToPrompt(prompt, getResponseValue(prompt))}
                                            disabled={isLoading || !getResponseValue(prompt)}
                                          >
                                            <Send className="h-4 w-4 mr-2" />
                                            Submit Response
                                          </Button>
                                          <Button
                                            variant="outline"
                                            onClick={() => setSelectedPrompt(null)}
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}

                              {prompt.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCancelPrompt(prompt.promptId)}
                                  disabled={isLoading}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {hasMore && (
                    <div className="mt-4 text-center">
                      <Button onClick={loadMore} variant="outline" disabled={isLoading}>
                        {isLoading ? 'Loading...' : 'Load More'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prompt History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                View all your prompt interactions and responses here.
              </p>
              {/* The same prompt list but filtered for completed/responded prompts */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          {stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold">{stats.pending}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Responded</p>
                      <p className="text-2xl font-bold">{stats.responded}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Expired</p>
                      <p className="text-2xl font-bold">{stats.expired}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Cancelled</p>
                      <p className="text-2xl font-bold">{stats.cancelled}</p>
                    </div>
                  </div>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Response Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">
                      {stats.total > 0 ? Math.round((stats.responded / stats.total) * 100) : 0}%
                    </p>
                    <p className="text-muted-foreground">of prompts responded to</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Hook for managing user prompts
export const useUserPrompts = () => {
  const [prompts, setPrompts] = useState<UserPrompt[]>([])
  const [stats, setStats] = useState<PromptStats | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const loadPrompts = async (apiUrl = '/api', status = 'pending') => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/prompts?status=${status}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setPrompts(data.prompts || [])
        setPendingCount(data.prompts?.filter((p: UserPrompt) => p.status === 'pending').length || 0)
      }
    } catch (error) {
      console.error('Error loading prompts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async (apiUrl = '/api') => {
    try {
      const response = await fetch(`${apiUrl}/prompts/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading prompt stats:', error)
    }
  }

  useEffect(() => {
    loadPrompts()
    loadStats()
  }, [])

  return {
    prompts,
    stats,
    pendingCount,
    isLoading,
    loadPrompts,
    loadStats
  }
}