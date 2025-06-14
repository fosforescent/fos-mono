import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  LayoutDashboard,
  Coins, 
  Zap, 
  Server, 
  MessageSquare,
  Target,
  Key,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
  DollarSign
} from 'lucide-react'

// Import all the components we've created
import { TokenManagement } from './tokens/TokenManagement'
import { ToolUsageHistory } from './tools/ToolUsageHistory'
import { ToolPricingManager } from './tools/ToolPricingManager'
import { UserPrompts } from './prompts/UserPrompts'
import { BidHistory } from './bids/BidHistory'
import { ApiTokenManager } from './tokens/ApiTokenManager'
import { ConsoleAgent } from './console/ConsoleAgent'
import { MCPServerManager } from './mcp/MCPServerManager'
import { NotificationArea } from './notifications/NotificationArea'
import { SubscriptionDashboard } from './subscription/SubscriptionDashboard'
import { CustomerRequestQueue } from './queue/CustomerRequestQueue'
import { ServiceManagement } from './provider/ServiceManagement'

interface DashboardStats {
  tokens: {
    balance: number
    used24h: number
    totalPurchased: number
  }
  tools: {
    used24h: number
    totalUsage: number
    successRate: number
  }
  servers: {
    connected: number
    total: number
    tools: number
  }
  prompts: {
    pending: number
    total: number
    responseRate: number
  }
  bids: {
    sessions24h: number
    avgCostSaved: number
    choiceRate: number
  }
}

interface DashboardProps {
  apiUrl?: string
  userRole?: 'user' | 'admin' | 'superadmin'
  className?: string
}

export const Dashboard: React.FC<DashboardProps> = ({
  apiUrl = '/api',
  userRole = 'user',
  className = ''
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadDashboardStats()
  }, [])

  const loadDashboardStats = async () => {
    setIsLoading(true)
    try {
      const [tokensRes, toolsRes, serversRes, promptsRes, bidsRes] = await Promise.all([
        fetch(`${apiUrl}/tokens/balance`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth')}` }
        }),
        fetch(`${apiUrl}/tool-usage/stats`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth')}` }
        }),
        fetch(`${apiUrl}/mcp/servers`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth')}` }
        }),
        fetch(`${apiUrl}/prompts/stats`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth')}` }
        }),
        fetch(`${apiUrl}/bid-analytics`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth')}` }
        })
      ])

      const [tokensData, toolsData, serversData, promptsData, bidsData] = await Promise.all([
        tokensRes.ok ? tokensRes.json() : { balance: null },
        toolsRes.ok ? toolsRes.json() : { stats: null },
        serversRes.ok ? serversRes.json() : { servers: [] },
        promptsRes.ok ? promptsRes.json() : { stats: null },
        bidsRes.ok ? bidsRes.json() : { analytics: null }
      ])

      setStats({
        tokens: {
          balance: tokensData.balance?.availableTokens || 0,
          used24h: 0, // Would need specific endpoint
          totalPurchased: tokensData.balance?.totalPurchased || 0
        },
        tools: {
          used24h: 0, // Would calculate from toolsData
          totalUsage: toolsData.stats?.totalCalls || 0,
          successRate: toolsData.stats ? (toolsData.stats.completedCalls / Math.max(toolsData.stats.totalCalls, 1)) * 100 : 0
        },
        servers: {
          connected: serversData.servers?.filter((s: any) => s.status === 'connected').length || 0,
          total: serversData.servers?.length || 0,
          tools: serversData.servers?.reduce((sum: number, s: any) => sum + (s.tools?.length || 0), 0) || 0
        },
        prompts: {
          pending: promptsData.stats?.pending || 0,
          total: promptsData.stats?.total || 0,
          responseRate: promptsData.stats ? (promptsData.stats.responded / Math.max(promptsData.stats.total, 1)) * 100 : 0
        },
        bids: {
          sessions24h: 0, // Would calculate from bidsData
          avgCostSaved: 0, // Would calculate savings
          choiceRate: bidsData.analytics?.choiceRate || 0
        }
      })
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to Fosforescent</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationArea 
            notifications={[]} 
            onMarkAsRead={() => {}} 
            onMarkAllAsRead={() => {}}
            onDismiss={() => {}}
            onClearAll={() => {}}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10">
          <TabsTrigger value="overview">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="console">
            <MessageSquare className="h-4 w-4 mr-2" />
            Console
          </TabsTrigger>
          <TabsTrigger value="customer-requests">
            <MessageSquare className="h-4 w-4 mr-2" />
            Requests
          </TabsTrigger>
          <TabsTrigger value="services">
            <DollarSign className="h-4 w-4 mr-2" />
            Services
          </TabsTrigger>
          <TabsTrigger value="tokens">
            <Coins className="h-4 w-4 mr-2" />
            Tokens
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Zap className="h-4 w-4 mr-2" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="servers">
            <Server className="h-4 w-4 mr-2" />
            Servers
          </TabsTrigger>
          <TabsTrigger value="prompts">
            <MessageSquare className="h-4 w-4 mr-2" />
            Prompts
          </TabsTrigger>
          <TabsTrigger value="bids">
            <Target className="h-4 w-4 mr-2" />
            Bids
          </TabsTrigger>
          <TabsTrigger value="api">
            <Key className="h-4 w-4 mr-2" />
            API
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Overview Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Token Balance</p>
                    <p className="text-2xl font-bold">{stats.tokens.balance}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tools Used</p>
                    <p className="text-2xl font-bold">{stats.tools.totalUsage}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Connected</p>
                    <p className="text-2xl font-bold">{stats.servers.connected}/{stats.servers.total}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold">{stats.prompts.pending}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold">{stats.tools.successRate.toFixed(1)}%</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Choice Rate</p>
                    <p className="text-2xl font-bold">{stats.bids.choiceRate.toFixed(1)}%</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Quick Access Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Console Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Execute tools and interact with MCP servers through natural language.
                </p>
                <Button onClick={() => setActiveTab('console')} className="w-full">
                  Open Console
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  Token Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span>Balance:</span>
                    <span className="font-medium">{stats?.tokens.balance || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Purchased:</span>
                    <span className="font-medium">{stats?.tokens.totalPurchased || 0}</span>
                  </div>
                </div>
                <Button onClick={() => setActiveTab('tokens')} variant="outline" className="w-full">
                  Manage Tokens
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  MCP Servers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span>Connected:</span>
                    <span className="font-medium">{stats?.servers.connected || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Available Tools:</span>
                    <span className="font-medium">{stats?.servers.tools || 0}</span>
                  </div>
                </div>
                <Button onClick={() => setActiveTab('servers')} variant="outline" className="w-full">
                  Manage Servers
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Tool Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Your recent tool executions and results.
                </p>
                <Button onClick={() => setActiveTab('tools')} variant="outline" size="sm" className="mt-4">
                  View All
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscription Status</CardTitle>
              </CardHeader>
              <CardContent>
                <SubscriptionDashboard
                  subscription={{
                    plan: 'pro',
                    status: 'active',
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(),
                    tokensIncluded: 10000,
                    tokensUsed: 2500,
                    tokensRemaining: 7500,
                    nextBillingDate: new Date(),
                    amount: 29.99,
                    currency: 'USD'
                  }}
                  usage={[]}
                  billingHistory={[]}
                  onUpgrade={() => {}}
                  onAddTokens={() => {}}
                  onCancelSubscription={() => {}}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="console">
          <ConsoleAgent apiUrl={apiUrl} />
        </TabsContent>

        <TabsContent value="customer-requests">
          <CustomerRequestQueue apiUrl={apiUrl} />
        </TabsContent>

        <TabsContent value="services">
          <ServiceManagement apiUrl={apiUrl} />
        </TabsContent>

        <TabsContent value="tokens">
          <TokenManagement apiUrl={apiUrl} />
        </TabsContent>

        <TabsContent value="tools">
          <Tabs defaultValue="usage" className="space-y-4">
            <TabsList>
              <TabsTrigger value="usage">Usage History</TabsTrigger>
              {userRole !== 'user' && <TabsTrigger value="pricing">Pricing Management</TabsTrigger>}
            </TabsList>
            <TabsContent value="usage">
              <ToolUsageHistory apiUrl={apiUrl} />
            </TabsContent>
            {userRole !== 'user' && (
              <TabsContent value="pricing">
                <ToolPricingManager 
                  serverId={1} 
                  serverName="Your Server"
                  apiUrl={apiUrl} 
                />
              </TabsContent>
            )}
          </Tabs>
        </TabsContent>

        <TabsContent value="servers">
          <MCPServerManager
            servers={[]}
            onServerAdd={() => {}}
            onServerUpdate={() => {}}
            onServerDelete={() => {}}
            onServerConnect={() => {}}
            onServerDisconnect={() => {}}
          />
        </TabsContent>

        <TabsContent value="prompts">
          <UserPrompts apiUrl={apiUrl} />
        </TabsContent>

        <TabsContent value="bids">
          <BidHistory apiUrl={apiUrl} />
        </TabsContent>

        <TabsContent value="api">
          <ApiTokenManager apiUrl={apiUrl} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Hook for dashboard data
export const useDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadStats = async (apiUrl = '/api') => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  return {
    stats,
    isLoading,
    loadStats
  }
}