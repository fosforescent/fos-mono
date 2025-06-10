import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { 
  Users, 
  Server, 
  Shield, 
  Activity, 
  DollarSign,
  Zap,
  Clock,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  UserCheck,
  Crown
} from 'lucide-react'
import { AdminUserManagement } from './AdminUserManagement'
import { AdminMCPServerManagement } from './AdminMCPServerManagement'

interface AdminStats {
  users: {
    total: number
    pending: number
    approved: number
    admins: number
    activeToday: number
  }
  servers: {
    total: number
    global: number
    connected: number
    tools: number
  }
  tokens: {
    totalInCirculation: number
    totalPurchased: number
    totalUsed: number
    recentPurchases: number
    recentRevenue: number
  }
  activity: {
    toolCalls24h: number
    newUsers24h: number
    activeUsers24h: number
    errorRate: number
  }
}

interface AdminDashboardProps {
  apiUrl?: string
  className?: string
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  apiUrl = '/api',
  className = ''
}) => {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadAdminStats()
  }, [])

  const loadAdminStats = async () => {
    setIsLoading(true)
    try {
      const [usersResponse, serversResponse, tokensResponse] = await Promise.all([
        fetch(`${apiUrl}/admin/users/stats`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth')}` }
        }),
        fetch(`${apiUrl}/admin/mcp-servers/stats`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth')}` }
        }),
        fetch(`${apiUrl}/admin/tokens/stats`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth')}` }
        })
      ])

      const [usersData, serversData, tokensData] = await Promise.all([
        usersResponse.ok ? usersResponse.json() : { stats: null },
        serversResponse.ok ? serversResponse.json() : { stats: null },
        tokensResponse.ok ? tokensResponse.json() : { stats: null }
      ])

      setStats({
        users: usersData.stats || {
          total: 0,
          pending: 0,
          approved: 0,
          admins: 0,
          activeToday: 0
        },
        servers: serversData.stats || {
          total: 0,
          global: 0,
          connected: 0,
          tools: 0
        },
        tokens: tokensData.stats || {
          totalInCirculation: 0,
          totalPurchased: 0,
          totalUsed: 0,
          recentPurchases: 0,
          recentRevenue: 0
        },
        activity: {
          toolCalls24h: 0,
          newUsers24h: 0,
          activeUsers24h: 0,
          errorRate: 0
        }
      })
    } catch (error) {
      console.error('Error loading admin stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100)
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">System overview and management</p>
        </div>
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-500" />
          <Badge variant="outline">Administrator</Badge>
        </div>
      </div>

      {/* Overview Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{stats.users.total}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.users.pending}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">MCP Servers</p>
                <p className="text-2xl font-bold">{stats.servers.total}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Tools</p>
                <p className="text-2xl font-bold">{stats.servers.tools}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Tokens</p>
                <p className="text-2xl font-bold">{stats.tokens.totalInCirculation.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Today</p>
                <p className="text-2xl font-bold">{stats.users.activeToday}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats?.users.pending || 0}</p>
                <p className="text-sm text-muted-foreground">Users awaiting approval</p>
              </div>
              <Button size="sm">
                <UserCheck className="h-4 w-4 mr-2" />
                Review
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Servers offline</p>
              </div>
              <Button size="sm" variant="outline">
                View
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Revenue (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats?.tokens.recentRevenue || 0)}</p>
                <p className="text-sm text-muted-foreground">From token sales</p>
              </div>
              <Button size="sm" variant="outline">
                Details
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Token Economics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total in Circulation</span>
                <span className="font-medium">{stats.tokens.totalInCirculation.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Purchased</span>
                <span className="font-medium">{stats.tokens.totalPurchased.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Used</span>
                <span className="font-medium">{stats.tokens.totalUsed.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Recent Purchases (30d)</span>
                <span className="font-medium">{stats.tokens.recentPurchases}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Revenue (30d)</span>
                <span className="font-medium">{formatCurrency(stats.tokens.recentRevenue)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Connected Servers</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.servers.connected}/{stats.servers.total}</span>
                  <Badge variant={stats.servers.connected === stats.servers.total ? 'default' : 'destructive'}>
                    {Math.round((stats.servers.connected / Math.max(stats.servers.total, 1)) * 100)}%
                  </Badge>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Global Servers</span>
                <span className="font-medium">{stats.servers.global}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Available Tools</span>
                <span className="font-medium">{stats.servers.tools}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Admin Users</span>
                <span className="font-medium">{stats.users.admins}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Approval Rate</span>
                <span className="font-medium">
                  {Math.round((stats.users.approved / Math.max(stats.users.total, 1)) * 100)}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Management Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="servers">MCP Servers</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUserManagement apiUrl={apiUrl} />
        </TabsContent>

        <TabsContent value="servers">
          <AdminMCPServerManagement apiUrl={apiUrl} />
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>System Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Comprehensive analytics and reporting will be displayed here.
              </p>
              {/* TODO: Add detailed analytics charts and reports */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Global system configuration and settings.
              </p>
              {/* TODO: Add system configuration options */}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Hook for admin dashboard data
export const useAdminDashboard = () => {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadStats = async (apiUrl = '/api') => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/admin/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading admin dashboard stats:', error)
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