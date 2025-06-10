import React, { useState, useEffect } from 'react'
import { Button } from '@/frontend/components/ui/button'
import { Input } from '@/frontend/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Badge } from '@/frontend/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { ScrollArea } from '@/frontend/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/frontend/components/ui/dialog'
import { 
  Zap, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  BarChart3,
  Search,
  Filter,
  Calendar,
  Server,
  User,
  TrendingUp,
  Activity,
  Timer,
  DollarSign
} from 'lucide-react'
import { useToast } from '@/frontend/components/ui/use-toast'

interface ToolUsage {
  id: number
  toolUseId: string
  toolName: string
  toolDescription?: string
  inputParameters: any
  outputResult?: any
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  duration?: number
  errorMessage?: string
  tokenCost: number
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  server?: {
    id: number
    name: string
  }
  targetUser?: {
    id: number
    user_name: string
  }
}

interface ToolUsageStats {
  totalCalls: number
  completedCalls: number
  failedCalls: number
  averageDuration: number
  mostUsedTools: Array<{
    toolName: string
    count: number
    averageDuration: number
  }>
  callsByStatus: Record<string, number>
  callsByDate: Array<{
    date: string
    count: number
  }>
}

interface ToolUsageHistoryProps {
  apiUrl?: string
  serverId?: number // If provided, shows server-specific usage
  className?: string
}

export const ToolUsageHistory: React.FC<ToolUsageHistoryProps> = ({
  apiUrl = '/api',
  serverId,
  className = ''
}) => {
  const [toolUsages, setToolUsages] = useState<ToolUsage[]>([])
  const [stats, setStats] = useState<ToolUsageStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedUsage, setSelectedUsage] = useState<ToolUsage | null>(null)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [toolNameFilter, setToolNameFilter] = useState('')
  const [serverFilter, setServerFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // Pagination
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 20

  const { toast } = useToast()

  useEffect(() => {
    loadToolUsages(true)
    loadStats()
  }, [statusFilter, toolNameFilter, serverFilter, startDate, endDate, serverId])

  const loadToolUsages = async (reset = false) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: (reset ? 0 : page * PAGE_SIZE).toString()
      })

      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (toolNameFilter) params.append('toolName', toolNameFilter)
      if (serverFilter !== 'all') params.append('serverId', serverFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const endpoint = serverId 
        ? `${apiUrl}/mcp/servers/${serverId}/tool-usage`
        : `${apiUrl}/tool-usage`

      const response = await fetch(`${endpoint}?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) throw new Error('Failed to load tool usage')

      const data = await response.json()
      
      if (reset) {
        setToolUsages(data.toolUsages)
        setPage(0)
      } else {
        setToolUsages(prev => [...prev, ...data.toolUsages])
      }
      
      setHasMore(data.pagination.hasMore)
    } catch (error) {
      console.error('Error loading tool usage:', error)
      toast({
        title: "Error",
        description: "Failed to load tool usage history",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const params = new URLSearchParams()
      if (serverFilter !== 'all') params.append('serverId', serverFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`${apiUrl}/tool-usage/stats?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) throw new Error('Failed to load stats')

      const data = await response.json()
      setStats(data.stats)
    } catch (error) {
      console.error('Error loading tool usage stats:', error)
    }
  }

  const loadMore = () => {
    setPage(prev => prev + 1)
    loadToolUsages(false)
  }

  const resetFilters = () => {
    setStatusFilter('all')
    setToolNameFilter('')
    setServerFilter('all')
    setStartDate('')
    setEndDate('')
    setPage(0)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString()
  }

  const successRate = stats ? (stats.completedCalls / Math.max(stats.totalCalls, 1)) * 100 : 0

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Tool Usage History</h2>
        <Button onClick={() => loadToolUsages(true)} variant="outline" size="sm">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">Usage History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Tool Name</label>
                  <Input
                    value={toolNameFilter}
                    onChange={(e) => setToolNameFilter(e.target.value)}
                    placeholder="Search tools..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => loadToolUsages(true)} size="sm">
                  <Search className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
                <Button onClick={resetFilters} variant="outline" size="sm">
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Usage List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Tool Executions ({toolUsages.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {toolUsages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No tool usage found</p>
                </div>
              ) : (
                <>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {toolUsages.map((usage) => (
                        <Dialog key={usage.id}>
                          <DialogTrigger asChild>
                            <div className="p-3 border rounded cursor-pointer hover:bg-muted/50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {getStatusIcon(usage.status)}
                                  <div>
                                    <p className="font-medium">{usage.toolName}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {usage.server?.name || 'Unknown Server'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDate(usage.createdAt)}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <Badge className={getStatusColor(usage.status)}>
                                    {usage.status}
                                  </Badge>
                                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                    <Timer className="h-3 w-3" />
                                    {formatDuration(usage.duration)}
                                    <DollarSign className="h-3 w-3" />
                                    {usage.tokenCost}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Tool Usage Details</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Tool Name</label>
                                  <p className="text-sm">{usage.toolName}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Status</label>
                                  <Badge className={getStatusColor(usage.status)}>
                                    {usage.status}
                                  </Badge>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Server</label>
                                  <p className="text-sm">{usage.server?.name || 'Unknown'}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Duration</label>
                                  <p className="text-sm">{formatDuration(usage.duration)}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Token Cost</label>
                                  <p className="text-sm">{usage.tokenCost}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Created</label>
                                  <p className="text-sm">{formatDate(usage.createdAt)}</p>
                                </div>
                              </div>

                              {usage.toolDescription && (
                                <div>
                                  <label className="text-sm font-medium">Description</label>
                                  <p className="text-sm text-muted-foreground">{usage.toolDescription}</p>
                                </div>
                              )}

                              <div>
                                <label className="text-sm font-medium">Input Parameters</label>
                                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                  {JSON.stringify(usage.inputParameters, null, 2)}
                                </pre>
                              </div>

                              {usage.outputResult && (
                                <div>
                                  <label className="text-sm font-medium">Output Result</label>
                                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                    {JSON.stringify(usage.outputResult, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {usage.errorMessage && (
                                <div>
                                  <label className="text-sm font-medium">Error Message</label>
                                  <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{usage.errorMessage}</p>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
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

        <TabsContent value="analytics" className="space-y-4">
          {stats && (
            <>
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Calls</p>
                      <p className="text-2xl font-bold">{stats.totalCalls}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                      <p className="text-2xl font-bold">{successRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Duration</p>
                      <p className="text-2xl font-bold">{formatDuration(stats.averageDuration)}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Failed Calls</p>
                      <p className="text-2xl font-bold">{stats.failedCalls}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Most Used Tools */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Most Used Tools
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.mostUsedTools.slice(0, 10).map((tool, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium">{tool.toolName}</p>
                          <p className="text-sm text-muted-foreground">
                            Avg: {formatDuration(tool.averageDuration)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{tool.count} calls</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(stats.callsByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(status)}
                          <span className="capitalize">{status}</span>
                        </div>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
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

// Hook for tool usage data
export const useToolUsage = (serverId?: number) => {
  const [usages, setUsages] = useState<ToolUsage[]>([])
  const [stats, setStats] = useState<ToolUsageStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refresh = async (apiUrl = '/api') => {
    setIsLoading(true)
    try {
      const endpoint = serverId 
        ? `${apiUrl}/mcp/servers/${serverId}/tool-usage`
        : `${apiUrl}/tool-usage`

      const [usageResponse, statsResponse] = await Promise.all([
        fetch(`${endpoint}?limit=10`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth')}` }
        }),
        fetch(`${apiUrl}/tool-usage/stats`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth')}` }
        })
      ])

      if (usageResponse.ok) {
        const usageData = await usageResponse.json()
        setUsages(usageData.toolUsages)
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats)
      }
    } catch (error) {
      console.error('Error loading tool usage:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [serverId])

  return { usages, stats, isLoading, refresh }
}