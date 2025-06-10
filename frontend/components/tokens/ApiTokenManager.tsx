import React, { useState, useEffect } from 'react'
import { Button } from '@/frontend/components/ui/button'
import { Input } from '@/frontend/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Badge } from '@/frontend/components/ui/badge'
import { Switch } from '@/frontend/components/ui/switch'
import { ScrollArea } from '@/frontend/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/frontend/components/ui/dialog'
import { Label } from '@/frontend/components/ui/label'
import { Textarea } from '@/frontend/components/ui/textarea'
import { Checkbox } from '@/frontend/components/ui/checkbox'
import { 
  Key, 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Eye, 
  EyeOff,
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings
} from 'lucide-react'
import { useToast } from '@/frontend/components/ui/use-toast'

interface ApiToken {
  id: number
  name: string
  scopes: string[]
  lastUsed?: Date
  expiresAt?: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  token?: string // Only returned on creation
}

interface CreateTokenRequest {
  name: string
  scopes: string[]
  expiresAt?: string
}

interface ApiTokenManagerProps {
  apiUrl?: string
  className?: string
}

const AVAILABLE_SCOPES = [
  { id: 'tokens:read', label: 'Read Token Balance', description: 'View token balance and transaction history' },
  { id: 'tokens:purchase', label: 'Purchase Tokens', description: 'Create token purchase checkout sessions' },
  { id: 'tools:execute', label: 'Execute Tools', description: 'Execute MCP tools and incur token costs' },
  { id: 'tools:read', label: 'Read Tool Usage', description: 'View tool usage history and statistics' },
  { id: 'prompts:read', label: 'Read Prompts', description: 'View user prompts and notifications' },
  { id: 'prompts:respond', label: 'Respond to Prompts', description: 'Respond to and manage prompts' },
  { id: 'mcp:read', label: 'Read MCP Servers', description: 'View MCP server configurations and status' },
  { id: 'mcp:manage', label: 'Manage MCP Servers', description: 'Add and configure MCP servers' },
  { id: 'admin:read', label: 'Admin Read Access', description: 'View admin statistics and user data' },
  { id: 'admin:write', label: 'Admin Write Access', description: 'Manage users and system settings' }
]

export const ApiTokenManager: React.FC<ApiTokenManagerProps> = ({
  apiUrl = '/api',
  className = ''
}) => {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newToken, setNewToken] = useState<CreateTokenRequest>({
    name: '',
    scopes: [],
    expiresAt: ''
  })
  const [editingToken, setEditingToken] = useState<ApiToken | null>(null)
  const [showTokenValue, setShowTokenValue] = useState<Record<number, boolean>>({})
  const [justCreatedToken, setJustCreatedToken] = useState<ApiToken | null>(null)
  
  const { toast } = useToast()

  useEffect(() => {
    loadTokens()
  }, [])

  const loadTokens = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api-tokens`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) throw new Error('Failed to load API tokens')

      const data = await response.json()
      setTokens(data.tokens || [])
    } catch (error) {
      console.error('Error loading API tokens:', error)
      toast({
        title: "Error",
        description: "Failed to load API tokens",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateToken = async () => {
    if (!newToken.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Token name is required",
        variant: "destructive"
      })
      return
    }

    if (newToken.scopes.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one scope is required",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify(newToken)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create API token')
      }

      const data = await response.json()
      setJustCreatedToken(data.token)
      
      toast({
        title: "Success",
        description: "API token created successfully"
      })

      setNewToken({ name: '', scopes: [], expiresAt: '' })
      setIsCreateDialogOpen(false)
      loadTokens()
    } catch (error) {
      console.error('Error creating API token:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create API token",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateToken = async (tokenId: number, updates: Partial<ApiToken>) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api-tokens/${tokenId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update API token')
      }

      toast({
        title: "Success",
        description: "API token updated successfully"
      })

      setEditingToken(null)
      loadTokens()
    } catch (error) {
      console.error('Error updating API token:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update API token",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteToken = async (tokenId: number, tokenName: string) => {
    if (!confirm(`Are you sure you want to delete the API token "${tokenName}"? This action cannot be undone.`)) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api-tokens/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete API token')
      }

      toast({
        title: "Success",
        description: "API token deleted successfully"
      })

      loadTokens()
    } catch (error) {
      console.error('Error deleting API token:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete API token",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevokeToken = async (tokenId: number) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api-tokens/${tokenId}/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to revoke API token')
      }

      toast({
        title: "Success",
        description: "API token revoked successfully"
      })

      loadTokens()
    } catch (error) {
      console.error('Error revoking API token:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revoke API token",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: "Token copied to clipboard"
    })
  }

  const toggleTokenVisibility = (tokenId: number) => {
    setShowTokenValue(prev => ({
      ...prev,
      [tokenId]: !prev[tokenId]
    }))
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString()
  }

  const isTokenExpired = (expiresAt?: Date) => {
    if (!expiresAt) return false
    return new Date() > new Date(expiresAt)
  }

  const getDaysUntilExpiry = (expiresAt?: Date) => {
    if (!expiresAt) return null
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diff = expiry.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return days
  }

  const handleScopeToggle = (scopeId: string, checked: boolean) => {
    setNewToken(prev => ({
      ...prev,
      scopes: checked
        ? [...prev.scopes, scopeId]
        : prev.scopes.filter(s => s !== scopeId)
    }))
  }

  const getScopeLabel = (scopeId: string) => {
    const scope = AVAILABLE_SCOPES.find(s => s.id === scopeId)
    return scope?.label || scopeId
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">API Token Management</h2>
          <p className="text-muted-foreground">Manage API tokens for external integrations</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Token
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create API Token</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tokenName">Token Name</Label>
                <Input
                  id="tokenName"
                  value={newToken.name}
                  onChange={(e) => setNewToken(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Production App, Mobile Client"
                />
              </div>

              <div>
                <Label htmlFor="expiresAt">Expiration Date (Optional)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={newToken.expiresAt}
                  onChange={(e) => setNewToken(prev => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>

              <div>
                <Label>Scopes & Permissions</Label>
                <ScrollArea className="h-64 border rounded p-3 mt-2">
                  <div className="space-y-3">
                    {AVAILABLE_SCOPES.map((scope) => (
                      <div key={scope.id} className="flex items-start space-x-2">
                        <Checkbox
                          checked={newToken.scopes.includes(scope.id)}
                          onCheckedChange={(checked) => handleScopeToggle(scope.id, checked === true)}
                        />
                        <div className="flex-1">
                          <label className="text-sm font-medium">{scope.label}</label>
                          <p className="text-xs text-muted-foreground">{scope.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateToken} disabled={isLoading}>
                  Create Token
                </Button>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* New Token Display */}
      {justCreatedToken && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              Token Created Successfully
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-green-700">
                Your new API token has been created. Make sure to copy it now as it won't be shown again.
              </p>
              <div className="p-3 bg-white border rounded">
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono">{justCreatedToken.token}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(justCreatedToken.token!)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setJustCreatedToken(null)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tokens List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Tokens ({tokens.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No API tokens created</p>
              <p className="text-sm">Create your first token to get started with the API</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tokens.map((token) => {
                const isExpired = isTokenExpired(token.expiresAt)
                const daysUntilExpiry = getDaysUntilExpiry(token.expiresAt)
                const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7

                return (
                  <div key={token.id} className={`p-4 border rounded ${
                    isExpired ? 'border-red-200 bg-red-50' : 
                    isExpiringSoon ? 'border-yellow-200 bg-yellow-50' : ''
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{token.name}</h3>
                          <Badge variant={token.isActive && !isExpired ? 'default' : 'secondary'}>
                            {isExpired ? 'Expired' : token.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {isExpiringSoon && !isExpired && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Expires Soon
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>
                            <p>Created</p>
                            <p className="font-medium">{formatDate(token.createdAt)}</p>
                          </div>
                          {token.lastUsed && (
                            <div>
                              <p>Last Used</p>
                              <p className="font-medium">{formatDate(token.lastUsed)}</p>
                            </div>
                          )}
                          {token.expiresAt && (
                            <div>
                              <p>Expires</p>
                              <p className="font-medium">{formatDate(token.expiresAt)}</p>
                            </div>
                          )}
                          <div>
                            <p>Scopes</p>
                            <p className="font-medium">{token.scopes.length} permissions</p>
                          </div>
                        </div>

                        <div className="mt-2">
                          <div className="flex flex-wrap gap-1">
                            {token.scopes.slice(0, 3).map((scope) => (
                              <Badge key={scope} variant="outline" className="text-xs">
                                {getScopeLabel(scope)}
                              </Badge>
                            ))}
                            {token.scopes.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{token.scopes.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Token Details</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Token Name</Label>
                                <p className="text-sm">{token.name}</p>
                              </div>
                              <div>
                                <Label>Token ID</Label>
                                <p className="text-sm font-mono">fos_****{token.id.toString().padStart(4, '0')}</p>
                              </div>
                              <div>
                                <Label>Scopes</Label>
                                <div className="space-y-1">
                                  {token.scopes.map((scope) => (
                                    <div key={scope} className="text-sm">
                                      <span className="font-medium">{getScopeLabel(scope)}</span>
                                      <span className="text-muted-foreground"> ({scope})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Edit className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Token</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Token Name</Label>
                                <Input
                                  value={editingToken?.name || token.name}
                                  onChange={(e) => setEditingToken(prev => 
                                    prev ? { ...prev, name: e.target.value } : { ...token, name: e.target.value }
                                  )}
                                />
                              </div>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={editingToken?.isActive ?? token.isActive}
                                  onCheckedChange={(checked) => setEditingToken(prev => 
                                    prev ? { ...prev, isActive: checked } : { ...token, isActive: checked }
                                  )}
                                />
                                <Label>Active</Label>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleUpdateToken(token.id, {
                                    name: editingToken?.name || token.name,
                                    isActive: editingToken?.isActive ?? token.isActive
                                  })}
                                  disabled={isLoading}
                                >
                                  Save Changes
                                </Button>
                                <Button variant="outline" onClick={() => setEditingToken(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {token.isActive && !isExpired && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRevokeToken(token.id)}
                            disabled={isLoading}
                          >
                            <Shield className="h-3 w-3" />
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteToken(token.id, token.name)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Documentation Link */}
      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">API Documentation</p>
              <p className="text-sm text-muted-foreground">
                Learn how to use your API tokens to integrate with the Fosforescent API
              </p>
            </div>
            <Button variant="outline" size="sm">
              View Docs
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Hook for API token management
export const useApiTokens = () => {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadTokens = async (apiUrl = '/api') => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api-tokens`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setTokens(data.tokens || [])
      }
    } catch (error) {
      console.error('Error loading API tokens:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTokens()
  }, [])

  return {
    tokens,
    isLoading,
    loadTokens
  }
}