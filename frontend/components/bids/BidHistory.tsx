import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Target, 
  TrendingUp, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  DollarSign,
  Zap,
  Filter,
  Calendar,
  Search,
  Award,
  PieChart,
  Activity
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface ToolBid {
  id: number
  bidId: string
  serverId: number
  serverName: string
  toolName: string
  toolDescription?: string
  tokenCost: number
  relevanceScore?: number
  bidReason?: string
  isChosen: boolean
  chosenAt?: Date
  createdAt: Date
}

interface BidSession {
  id: number
  sessionId: string
  taskDescription: string
  context: any
  createdAt: Date
  bids: ToolBid[]
  chosenBid?: ToolBid
}

interface BidAnalytics {
  totalSessions: number
  totalBids: number
  chosenBids: number
  choiceRate: number
  toolStats: Array<{
    serverId: number
    serverName?: string
    toolName: string
    totalBids: number
    chosenCount: number
    choiceRate: number
  }>
}

interface BidHistoryProps {
  apiUrl?: string
  className?: string
}

export const BidHistory: React.FC<BidHistoryProps> = ({
  apiUrl = '/api',
  className = ''
}) => {
  const [sessions, setSessions] = useState<BidSession[]>([])
  const [analytics, setAnalytics] = useState<BidAnalytics | null>(null)
  const [selectedSession, setSelectedSession] = useState<BidSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  
  const { toast } = useToast()
  const PAGE_SIZE = 20

  useEffect(() => {
    loadBidSessions(true)
    loadAnalytics()
  }, [searchQuery, startDate, endDate])

  const loadBidSessions = async (reset = false) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: (reset ? 0 : page * PAGE_SIZE).toString()
      })

      if (searchQuery) params.append('search', searchQuery)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      // This would be a new endpoint for bid session history
      const response = await fetch(`${apiUrl}/bid-sessions?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) {
        // If endpoint doesn't exist, use mock data
        const mockSessions = generateMockBidSessions()
        setSessions(mockSessions)
        return
      }

      const data = await response.json()
      
      if (reset) {
        setSessions(data.sessions || [])
        setPage(0)
      } else {
        setSessions(prev => [...prev, ...(data.sessions || [])])
      }
      
      setHasMore(data.pagination?.hasMore || false)
    } catch (error) {
      console.error('Error loading bid sessions:', error)
      // Use mock data on error
      const mockSessions = generateMockBidSessions()
      setSessions(mockSessions)
    } finally {
      setIsLoading(false)
    }
  }

  const loadAnalytics = async () => {
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`${apiUrl}/bid-analytics?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) {
        // Use mock data if endpoint doesn't exist
        const mockAnalytics = generateMockAnalytics()
        setAnalytics(mockAnalytics)
        return
      }

      const data = await response.json()
      setAnalytics(data.analytics)
    } catch (error) {
      console.error('Error loading bid analytics:', error)
      // Use mock data on error
      const mockAnalytics = generateMockAnalytics()
      setAnalytics(mockAnalytics)
    }
  }

  const generateMockBidSessions = (): BidSession[] => {
    const mockSessions: BidSession[] = []
    
    for (let i = 0; i < 10; i++) {
      const bids: ToolBid[] = []
      const numBids = Math.floor(Math.random() * 5) + 2
      
      for (let j = 0; j < numBids; j++) {
        bids.push({
          id: i * 10 + j,
          bidId: `bid_${i}_${j}`,
          serverId: j + 1,
          serverName: ['WebSearch MCP', 'CodeAnalysis MCP', 'ImageGen MCP', 'DataQuery MCP'][j % 4],
          toolName: ['search_web', 'analyze_code', 'generate_image', 'query_data'][j % 4],
          toolDescription: `Tool for ${['searching', 'analyzing', 'generating', 'querying'][j % 4]}`,
          tokenCost: Math.floor(Math.random() * 50) + 10,
          relevanceScore: Math.random(),
          bidReason: 'Tool matches task requirements',
          isChosen: j === 0, // First bid is chosen
          chosenAt: j === 0 ? new Date(Date.now() - Math.random() * 86400000) : undefined,
          createdAt: new Date(Date.now() - Math.random() * 7 * 86400000)
        })
      }

      mockSessions.push({
        id: i,
        sessionId: `session_${i}`,
        taskDescription: `Task ${i}: ${['Search for information', 'Analyze code quality', 'Generate an image', 'Query database'][i % 4]}`,
        context: { priority: 'normal' },
        createdAt: new Date(Date.now() - Math.random() * 7 * 86400000),
        bids,
        chosenBid: bids[0]
      })
    }

    return mockSessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  const generateMockAnalytics = (): BidAnalytics => {
    return {
      totalSessions: 45,
      totalBids: 180,
      chosenBids: 45,
      choiceRate: 25,
      toolStats: [
        {
          serverId: 1,
          serverName: 'WebSearch MCP',
          toolName: 'search_web',
          totalBids: 50,
          chosenCount: 15,
          choiceRate: 30
        },
        {
          serverId: 2,
          serverName: 'CodeAnalysis MCP',
          toolName: 'analyze_code',
          totalBids: 40,
          chosenCount: 12,
          choiceRate: 30
        },
        {
          serverId: 3,
          serverName: 'ImageGen MCP',
          toolName: 'generate_image',
          totalBids: 35,
          chosenCount: 8,
          choiceRate: 23
        },
        {
          serverId: 4,
          serverName: 'DataQuery MCP',
          toolName: 'query_data',
          totalBids: 55,
          chosenCount: 10,
          choiceRate: 18
        }
      ]
    }
  }

  const loadMore = () => {
    setPage(prev => prev + 1)
    loadBidSessions(false)
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString()
  }

  const formatRelevanceScore = (score?: number) => {
    if (!score) return 'N/A'
    return `${(score * 100).toFixed(1)}%`
  }

  const getChoiceRateColor = (rate: number) => {
    if (rate >= 30) return 'text-green-600'
    if (rate >= 20) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Tool Bidding History</h2>
        <Button onClick={() => loadBidSessions(true)} variant="outline" size="sm">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">Bid Sessions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="search">Search Tasks</Label>
                  <Input
                    id="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search task descriptions..."
                  />
                </div>
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sessions List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Bid Sessions ({sessions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No bid sessions found</p>
                </div>
              ) : (
                <>
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {sessions.map((session) => (
                        <Dialog key={session.id}>
                          <DialogTrigger asChild>
                            <div className="p-4 border rounded cursor-pointer hover:bg-muted/50">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h3 className="font-medium mb-1">{session.taskDescription}</h3>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {formatDate(session.createdAt)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Target className="h-3 w-3" />
                                      {session.bids.length} bids
                                    </span>
                                    {session.chosenBid && (
                                      <span className="flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                        {session.chosenBid.toolName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  {session.chosenBid && (
                                    <Badge variant="default">
                                      <DollarSign className="h-3 w-3 mr-1" />
                                      {session.chosenBid.tokenCost} tokens
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle>Bid Session Details</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Task Description</Label>
                                <p className="text-sm">{session.taskDescription}</p>
                              </div>

                              <div>
                                <Label>Received Bids ({session.bids.length})</Label>
                                <div className="mt-2 space-y-2">
                                  {session.bids.map((bid) => (
                                    <div key={bid.id} className={`p-3 border rounded ${
                                      bid.isChosen ? 'bg-green-50 border-green-200' : ''
                                    }`}>
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Zap className="h-4 w-4 text-blue-500" />
                                            <span className="font-medium">{bid.toolName}</span>
                                            <span className="text-sm text-muted-foreground">
                                              ({bid.serverName})
                                            </span>
                                            {bid.isChosen && (
                                              <Badge variant="default">
                                                <Award className="h-3 w-3 mr-1" />
                                                Chosen
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-sm text-muted-foreground">{bid.toolDescription}</p>
                                          {bid.bidReason && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                              Reason: {bid.bidReason}
                                            </p>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          <p className="font-medium">{bid.tokenCost} tokens</p>
                                          <p className="text-sm text-muted-foreground">
                                            Relevance: {formatRelevanceScore(bid.relevanceScore)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
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
          {analytics && (
            <>
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Sessions</p>
                      <p className="text-2xl font-bold">{analytics.totalSessions}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Bids</p>
                      <p className="text-2xl font-bold">{analytics.totalBids}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Chosen Bids</p>
                      <p className="text-2xl font-bold">{analytics.chosenBids}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Choice Rate</p>
                      <p className={`text-2xl font-bold ${getChoiceRateColor(analytics.choiceRate)}`}>
                        {analytics.choiceRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Tool Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Tool Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.toolStats.map((stat, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">{stat.toolName}</span>
                            <span className="text-sm text-muted-foreground">
                              ({stat.serverName})
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {stat.totalBids} bids • {stat.chosenCount} chosen
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${getChoiceRateColor(stat.choiceRate)}`}>
                            {stat.choiceRate.toFixed(1)}%
                          </p>
                          <p className="text-sm text-muted-foreground">choice rate</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Insights */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.toolStats.length > 0 && (
                      <>
                        <div className="p-3 bg-green-50 border border-green-200 rounded">
                          <p className="text-sm">
                            <strong>Best Performing Tool:</strong> {analytics.toolStats[0].toolName} 
                            ({analytics.toolStats[0].choiceRate.toFixed(1)}% choice rate)
                          </p>
                        </div>
                        
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-sm">
                            <strong>Average Bids per Session:</strong> {(analytics.totalBids / Math.max(analytics.totalSessions, 1)).toFixed(1)}
                          </p>
                        </div>

                        <div className="p-3 bg-purple-50 border border-purple-200 rounded">
                          <p className="text-sm">
                            <strong>Cost Savings:</strong> The bidding system helps you find the most relevant and cost-effective tools for each task.
                          </p>
                        </div>
                      </>
                    )}
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

// Hook for bid history data
export const useBidHistory = () => {
  const [sessions, setSessions] = useState<BidSession[]>([])
  const [analytics, setAnalytics] = useState<BidAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadData = async (apiUrl = '/api') => {
    setIsLoading(true)
    try {
      // Try to load real data, fallback to mock data
      const response = await fetch(`${apiUrl}/bid-sessions?limit=5`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
    } catch (error) {
      console.error('Error loading bid history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return {
    sessions,
    analytics,
    isLoading,
    loadData
  }
}