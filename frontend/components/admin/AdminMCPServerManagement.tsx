import React, { useState, useEffect } from 'react'
import { Button } from '@/frontend/components/ui/button'
import { Input } from '@/frontend/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Badge } from '@/frontend/components/ui/badge'
import { Switch } from '@/frontend/components/ui/switch'
import { Textarea } from '@/frontend/components/ui/textarea'
import { ScrollArea } from '@/frontend/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/frontend/components/ui/dialog'
import { Label } from '@/frontend/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { 
  Server, 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Square,
  Globe,
  Shield,
  CheckCircle,
  AlertCircle,
  Clock,
  Activity,
  Users,
  Zap,
  Settings
} from 'lucide-react'
import { useToast } from '@/frontend/components/ui/use-toast'

interface MCPServer {
  id: number
  name: string
  description?: string
  endpoint: string
  status: 'connected' | 'disconnected' | 'error'
  capabilities: string[]
  isGlobal: boolean
  public: boolean
  isEnabled: boolean
  credentials: any
  lastPing?: Date
  createdAt: Date
  updatedAt: Date
  userCount: number
  toolCount: number
  usageStats?: {
    totalCalls: number
    last24h: number
    successRate: number
  }
}

interface ServerStats {
  totalServers: number
  globalServers: number
  connectedServers: number
  totalUsers: number
  totalTools: number
}

interface AdminMCPServerManagementProps {
  apiUrl?: string
  className?: string
}

export const AdminMCPServerManagement: React.FC<AdminMCPServerManagementProps> = ({
  apiUrl = '/api',
  className = ''
}) => {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null)
  const [newServer, setNewServer] = useState({
    name: '',
    description: '',
    endpoint: '',
    isGlobal: true,
    public: false,
    isEnabled: true,
    credentials: '{}'
  })
  
  const { toast } = useToast()

  useEffect(() => {
    loadServers()
    loadStats()
  }, [])

  const loadServers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/admin/mcp-servers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) throw new Error('Failed to load MCP servers')

      const data = await response.json()
      setServers(data.servers || [])
    } catch (error) {
      console.error('Error loading MCP servers:', error)
      toast({
        title: "Error",
        description: "Failed to load MCP servers",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch(`${apiUrl}/admin/mcp-servers/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading server stats:', error)
    }
  }

  const handleCreateServer = async () => {
    if (!newServer.name.trim() || !newServer.endpoint.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and endpoint are required",
        variant: "destructive"
      })
      return
    }

    // Validate credentials JSON
    try {
      JSON.parse(newServer.credentials)
    } catch {
      toast({
        title: "Validation Error",
        description: "Invalid JSON in credentials field",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/admin/mcp-servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify({
          ...newServer,
          credentials: JSON.parse(newServer.credentials),
          capabilities: []
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create MCP server')
      }

      toast({
        title: "Success",
        description: `MCP server "${newServer.name}" created successfully`
      })

      setNewServer({
        name: '',
        description: '',
        endpoint: '',
        isGlobal: true,
        public: false,
        isEnabled: true,
        credentials: '{}'
      })
      setIsAddDialogOpen(false)
      loadServers()
      loadStats()
    } catch (error) {
      console.error('Error creating MCP server:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create MCP server",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateServer = async (serverId: number, updates: Partial<MCPServer>) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/admin/mcp-servers/${serverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update MCP server')
      }

      toast({
        title: "Success",
        description: "MCP server updated successfully"
      })

      setEditingServer(null)
      loadServers()
    } catch (error) {
      console.error('Error updating MCP server:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update MCP server",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteServer = async (serverId: number, serverName: string) => {
    if (!confirm(`Are you sure you want to delete the MCP server "${serverName}"? This action cannot be undone.`)) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/admin/mcp-servers/${serverId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete MCP server')
      }

      toast({
        title: "Success",
        description: `MCP server "${serverName}" deleted successfully`
      })

      loadServers()
      loadStats()
    } catch (error) {
      console.error('Error deleting MCP server:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete MCP server",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleServerStatus = async (serverId: number, action: 'connect' | 'disconnect') => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/admin/mcp-servers/${serverId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${action} MCP server`)
      }

      toast({
        title: "Success",
        description: `MCP server ${action}ed successfully`
      })

      loadServers()
    } catch (error) {
      console.error(`Error ${action}ing MCP server:`, error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} MCP server`,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString()
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">MCP Server Management</h2>
          <p className="text-muted-foreground">Manage global MCP servers available to all users</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Global Server
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Global MCP Server</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="serverName">Server Name</Label>
                <Input
                  id="serverName"
                  value={newServer.name}
                  onChange={(e) => setNewServer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Global WebSearch MCP"
                />
              </div>

              <div>
                <Label htmlFor="endpoint">Endpoint URL</Label>
                <Input
                  id="endpoint"
                  value={newServer.endpoint}
                  onChange={(e) => setNewServer(prev => ({ ...prev, endpoint: e.target.value }))}
                  placeholder="e.g., ws://mcp.example.com:8080"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newServer.description}
                  onChange={(e) => setNewServer(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What this server provides..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="credentials">Credentials (JSON)</Label>
                <Textarea
                  id="credentials"
                  value={newServer.credentials}
                  onChange={(e) => setNewServer(prev => ({ ...prev, credentials: e.target.value }))}
                  placeholder='{"apiKey": "...", "other": "..."}'
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={newServer.isGlobal}
                    onCheckedChange={(checked) => setNewServer(prev => ({ ...prev, isGlobal: checked }))}
                  />
                  <Label>Global Server</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={newServer.public}
                    onCheckedChange={(checked) => setNewServer(prev => ({ ...prev, public: checked }))}
                  />
                  <Label>Public</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={newServer.isEnabled}
                    onCheckedChange={(checked) => setNewServer(prev => ({ ...prev, isEnabled: checked }))}
                  />
                  <Label>Enabled</Label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateServer} disabled={isLoading}>
                  Create Server
                </Button>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Servers</p>
                <p className="text-2xl font-bold">{stats.totalServers}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Global</p>
                <p className="text-2xl font-bold">{stats.globalServers}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Connected</p>
                <p className="text-2xl font-bold">{stats.connectedServers}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Tools</p>
                <p className="text-2xl font-bold">{stats.totalTools}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Tabs defaultValue="servers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="servers">All Servers</TabsTrigger>
          <TabsTrigger value="global">Global Servers</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="servers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                MCP Servers ({servers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {servers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No MCP servers configured</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {servers.map((server) => (
                      <div key={server.id} className="p-4 border rounded">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getStatusIcon(server.status)}
                              <h3 className="font-medium">{server.name}</h3>
                              <Badge className={getStatusColor(server.status)}>
                                {server.status}
                              </Badge>
                              {server.isGlobal && (
                                <Badge variant="outline">
                                  <Globe className="h-3 w-3 mr-1" />
                                  Global
                                </Badge>
                              )}
                              {server.public && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Public
                                </Badge>
                              )}
                              {!server.isEnabled && (
                                <Badge variant="secondary">Disabled</Badge>
                              )}
                            </div>

                            <p className="text-sm text-muted-foreground mb-2">
                              {server.endpoint}
                            </p>

                            {server.description && (
                              <p className="text-sm mb-2">{server.description}</p>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                              <div>
                                <p>Users</p>
                                <p className="font-medium">{server.userCount}</p>
                              </div>
                              <div>
                                <p>Tools</p>
                                <p className="font-medium">{server.toolCount}</p>
                              </div>
                              <div>
                                <p>Created</p>
                                <p className="font-medium">{formatDate(server.createdAt)}</p>
                              </div>
                              {server.lastPing && (
                                <div>
                                  <p>Last Ping</p>
                                  <p className="font-medium">{formatDate(server.lastPing)}</p>
                                </div>
                              )}
                            </div>

                            {server.usageStats && (
                              <div className="mt-2 flex gap-4 text-sm">
                                <span>
                                  <strong>Total Calls:</strong> {server.usageStats.totalCalls}
                                </span>
                                <span>
                                  <strong>Last 24h:</strong> {server.usageStats.last24h}
                                </span>
                                <span>
                                  <strong>Success Rate:</strong> {server.usageStats.successRate.toFixed(1)}%
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 ml-4">
                            {server.status === 'connected' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleServerStatus(server.id, 'disconnect')}
                                disabled={isLoading}
                              >
                                <Square className="h-3 w-3 mr-1" />
                                Disconnect
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleToggleServerStatus(server.id, 'connect')}
                                disabled={isLoading || !server.isEnabled}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Connect
                              </Button>
                            )}

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Edit Server: {server.name}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label>Server Name</Label>
                                    <Input
                                      value={editingServer?.name || server.name}
                                      onChange={(e) => setEditingServer(prev => 
                                        prev ? { ...prev, name: e.target.value } : { ...server, name: e.target.value }
                                      )}
                                    />
                                  </div>

                                  <div>
                                    <Label>Description</Label>
                                    <Textarea
                                      value={editingServer?.description || server.description || ''}
                                      onChange={(e) => setEditingServer(prev => 
                                        prev ? { ...prev, description: e.target.value } : { ...server, description: e.target.value }
                                      )}
                                      rows={3}
                                    />
                                  </div>

                                  <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={editingServer?.isGlobal ?? server.isGlobal}
                                        onCheckedChange={(checked) => setEditingServer(prev => 
                                          prev ? { ...prev, isGlobal: checked } : { ...server, isGlobal: checked }
                                        )}
                                      />
                                      <Label>Global Server</Label>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={editingServer?.public ?? server.public}
                                        onCheckedChange={(checked) => setEditingServer(prev => 
                                          prev ? { ...prev, public: checked } : { ...server, public: checked }
                                        )}
                                      />
                                      <Label>Public</Label>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={editingServer?.isEnabled ?? server.isEnabled}
                                        onCheckedChange={(checked) => setEditingServer(prev => 
                                          prev ? { ...prev, isEnabled: checked } : { ...server, isEnabled: checked }
                                        )}
                                      />
                                      <Label>Enabled</Label>
                                    </div>
                                  </div>

                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => handleUpdateServer(server.id, {
                                        name: editingServer?.name || server.name,
                                        description: editingServer?.description || server.description,
                                        isGlobal: editingServer?.isGlobal ?? server.isGlobal,
                                        public: editingServer?.public ?? server.public,
                                        isEnabled: editingServer?.isEnabled ?? server.isEnabled
                                      })}
                                      disabled={isLoading}
                                    >
                                      Save Changes
                                    </Button>
                                    <Button variant="outline" onClick={() => setEditingServer(null)}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteServer(server.id, server.name)}
                              disabled={isLoading}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="global">
          <Card>
            <CardHeader>
              <CardTitle>Global MCP Servers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Global servers are available to all approved users by default.
              </p>
              {/* Filter to show only global servers */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Server Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Usage analytics and performance metrics for all MCP servers.
              </p>
              {/* Server analytics and metrics */}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Hook for admin MCP server management
export const useAdminMCPServers = () => {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadServers = async (apiUrl = '/api') => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/admin/mcp-servers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setServers(data.servers || [])
      }
    } catch (error) {
      console.error('Error loading admin MCP servers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async (apiUrl = '/api') => {
    try {
      const response = await fetch(`${apiUrl}/admin/mcp-servers/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading server stats:', error)
    }
  }

  useEffect(() => {
    loadServers()
    loadStats()
  }, [])

  return {
    servers,
    stats,
    isLoading,
    loadServers,
    loadStats
  }
}