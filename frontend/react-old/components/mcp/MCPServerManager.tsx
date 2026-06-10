import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Server, 
  Plus, 
  Settings, 
  Trash2, 
  Play, 
  Square, 
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  Zap
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export interface MCPServer {
  id: string
  name: string
  url: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  description?: string
  version?: string
  capabilities: string[]
  tools: MCPTool[]
  lastConnected?: Date
  autoConnect: boolean
  public: boolean
}

export interface MCPTool {
  id: string
  name: string
  description: string
  parameters: any[]
  priceTokens: number
}

interface MCPServerManagerProps {
  servers: MCPServer[]
  onServerAdd: (server: Omit<MCPServer, 'id' | 'status' | 'tools'>) => void
  onServerUpdate: (id: string, updates: Partial<MCPServer>) => void
  onServerDelete: (id: string) => void
  onServerConnect: (id: string) => void
  onServerDisconnect: (id: string) => void
  className?: string
}

export const MCPServerManager: React.FC<MCPServerManagerProps> = ({
  servers,
  onServerAdd,
  onServerUpdate,
  onServerDelete,
  onServerConnect,
  onServerDisconnect,
  className = ''
}) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null)
  const [newServer, setNewServer] = useState({
    name: '',
    url: '',
    description: '',
    autoConnect: false,
    public: false
  })
  const { toast } = useToast()

  const getStatusIcon = (status: MCPServer['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'connecting':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: MCPServer['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800'
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleAddServer = () => {
    if (!newServer.name.trim() || !newServer.url.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and URL are required",
        variant: "destructive"
      })
      return
    }

    onServerAdd({
      name: newServer.name,
      url: newServer.url,
      description: newServer.description,
      autoConnect: newServer.autoConnect,
      public: newServer.public,
      capabilities: [],
      tools: []
    })

    setNewServer({ name: '', url: '', description: '', autoConnect: false, public: false })
    setIsAddDialogOpen(false)
    
    toast({
      title: "Server Added",
      description: `MCP server "${newServer.name}" has been added`
    })
  }

  const handleServerAction = async (server: MCPServer, action: 'connect' | 'disconnect') => {
    try {
      if (action === 'connect') {
        onServerConnect(server.id)
        toast({
          title: "Connecting...",
          description: `Connecting to ${server.name}`
        })
      } else {
        onServerDisconnect(server.id)
        toast({
          title: "Disconnected",
          description: `Disconnected from ${server.name}`
        })
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: `Failed to ${action} ${server.name}`,
        variant: "destructive"
      })
    }
  }

  const connectedServers = servers.filter(s => s.status === 'connected').length
  const totalTools = servers.reduce((sum, server) => sum + server.tools.length, 0)

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              <CardTitle>MCP Servers</CardTitle>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Server
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add MCP Server</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Server Name</Label>
                    <Input
                      id="name"
                      value={newServer.name}
                      onChange={(e) => setNewServer(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., WebSearch MCP"
                    />
                  </div>
                  <div>
                    <Label htmlFor="url">Server URL</Label>
                    <Input
                      id="url"
                      value={newServer.url}
                      onChange={(e) => setNewServer(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="e.g., ws://localhost:8080/mcp"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={newServer.description}
                      onChange={(e) => setNewServer(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What this server does..."
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="autoConnect"
                        checked={newServer.autoConnect}
                        onChange={(e) => setNewServer(prev => ({ ...prev, autoConnect: e.target.checked }))}
                      />
                      <Label htmlFor="autoConnect">Auto-connect on startup</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="public"
                        checked={newServer.public}
                        onChange={(e) => setNewServer(prev => ({ ...prev, public: e.target.checked }))}
                      />
                      <Label htmlFor="public">Make this server publicly accessible</Label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddServer} className="flex-1">
                      Add Server
                    </Button>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          {/* Summary Stats */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{servers.length} servers</span>
            <span>{connectedServers} connected</span>
            <span>{totalTools} tools available</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {servers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No MCP servers configured</p>
              <p className="text-sm">Add a server to get started</p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-3">
                {servers.map((server) => (
                  <Card key={server.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(server.status)}
                          <h3 className="font-medium">{server.name}</h3>
                          <Badge className={getStatusColor(server.status)}>
                            {server.status}
                          </Badge>
                          {server.autoConnect && (
                            <Badge variant="outline" className="text-xs">
                              Auto
                            </Badge>
                          )}
                          {server.public && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                              Public
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          {server.url}
                        </p>
                        
                        {server.description && (
                          <p className="text-sm">{server.description}</p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{server.tools.length} tools</span>
                          {server.lastConnected && (
                            <span>
                              Last connected: {server.lastConnected.toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        
                        {/* Tools List */}
                        {server.tools.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {server.tools.slice(0, 3).map((tool) => (
                              <Badge key={tool.id} variant="secondary" className="text-xs">
                                <Zap className="h-3 w-3 mr-1" />
                                {tool.name} ({tool.priceTokens}t)
                              </Badge>
                            ))}
                            {server.tools.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{server.tools.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-1 ml-4">
                        {server.status === 'connected' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleServerAction(server, 'disconnect')}
                          >
                            <Square className="h-3 w-3 mr-1" />
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleServerAction(server, 'connect')}
                            disabled={server.status === 'connecting'}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Connect
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingServer(server)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            onServerDelete(server.id)
                            toast({
                              title: "Server Deleted",
                              description: `${server.name} has been removed`
                            })
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Hook for managing MCP servers
export const useMCPServers = () => {
  const [servers, setServers] = useState<MCPServer[]>([])

  const addServer = (serverData: Omit<MCPServer, 'id' | 'status' | 'tools'>) => {
    const newServer: MCPServer = {
      ...serverData,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      status: 'disconnected',
      tools: []
    }
    
    setServers(prev => [...prev, newServer])
    
    // Auto-connect if requested
    if (newServer.autoConnect) {
      setTimeout(() => connectServer(newServer.id), 1000)
    }
  }

  const updateServer = (id: string, updates: Partial<MCPServer>) => {
    setServers(prev =>
      prev.map(server => 
        server.id === id ? { ...server, ...updates } : server
      )
    )
  }

  const deleteServer = (id: string) => {
    setServers(prev => prev.filter(server => server.id !== id))
  }

  const connectServer = async (id: string) => {
    updateServer(id, { status: 'connecting' })
    
    try {
      // Simulate connection process
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock successful connection with tools
      const mockTools: MCPTool[] = [
        {
          id: 'search',
          name: 'Search',
          description: 'Search for information',
          parameters: [{ name: 'query', type: 'string' }],
          priceTokens: 10
        }
      ]
      
      updateServer(id, { 
        status: 'connected',
        lastConnected: new Date(),
        tools: mockTools
      })
    } catch (error) {
      updateServer(id, { status: 'error' })
    }
  }

  const disconnectServer = (id: string) => {
    updateServer(id, { status: 'disconnected' })
  }

  // Load sample servers
  useEffect(() => {
    const sampleServers: Omit<MCPServer, 'id' | 'status' | 'tools'>[] = [
      {
        name: 'WebSearch MCP',
        url: 'ws://localhost:8080/mcp',
        description: 'Search the web for information',
        autoConnect: true,
        public: false,
        capabilities: ['search', 'browse'],
        lastConnected: new Date(Date.now() - 3600000) // 1 hour ago
      },
      {
        name: 'CodeAnalysis MCP', 
        url: 'ws://localhost:8081/mcp',
        description: 'Analyze and review code',
        autoConnect: false,
        public: true,
        capabilities: ['analyze', 'review', 'format']
      }
    ]

    setTimeout(() => {
      sampleServers.forEach(server => addServer(server))
    }, 1000)
  }, [])

  return {
    servers,
    addServer,
    updateServer,
    deleteServer,
    connectServer,
    disconnectServer
  }
}