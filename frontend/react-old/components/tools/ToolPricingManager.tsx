import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  DollarSign, 
  Edit, 
  Save, 
  Plus, 
  Trash2,
  TrendingUp,
  Settings,
  Zap,
  History,
  BarChart3,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface ToolPricing {
  id: number
  serverId: number
  toolName: string
  pricePerUseTokens: number
  isEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

interface ToolUsageStats {
  toolName: string
  totalUsage: number
  totalRevenue: number
  avgDuration: number
  successRate: number
}

interface PricingHistory {
  id: number
  toolName: string
  oldPrice: number
  newPrice: number
  changedAt: Date
  changedBy: string
}

interface ToolPricingManagerProps {
  serverId: number
  serverName: string
  apiUrl?: string
  className?: string
}

export const ToolPricingManager: React.FC<ToolPricingManagerProps> = ({
  serverId,
  serverName,
  apiUrl = '/api',
  className = ''
}) => {
  const [pricing, setPricing] = useState<ToolPricing[]>([])
  const [usageStats, setUsageStats] = useState<ToolUsageStats[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [editingTool, setEditingTool] = useState<ToolPricing | null>(null)
  const [newToolPricing, setNewToolPricing] = useState({
    toolName: '',
    pricePerUseTokens: 10,
    isEnabled: true
  })
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadPricing()
    loadUsageStats()
  }, [serverId])

  const loadPricing = async () => {
    try {
      const response = await fetch(`${apiUrl}/mcp/servers/${serverId}/pricing`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) throw new Error('Failed to load pricing')

      const data = await response.json()
      setPricing(data.toolPricing || [])
    } catch (error) {
      console.error('Error loading pricing:', error)
      toast({
        title: "Error",
        description: "Failed to load tool pricing",
        variant: "destructive"
      })
    }
  }

  const loadUsageStats = async () => {
    try {
      // This would be a separate endpoint for usage analytics by tool
      const response = await fetch(`${apiUrl}/mcp/servers/${serverId}/tool-usage/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setUsageStats(data.toolStats || [])
      }
    } catch (error) {
      console.error('Error loading usage stats:', error)
    }
  }

  const handleSavePricing = async (toolName: string, pricePerUseTokens: number, isEnabled: boolean) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/mcp/servers/${serverId}/tools/${encodeURIComponent(toolName)}/pricing`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify({
          pricePerUseTokens,
          isEnabled
        })
      })

      if (!response.ok) throw new Error('Failed to save pricing')

      toast({
        title: "Success",
        description: `Pricing updated for ${toolName}`
      })

      setEditingTool(null)
      loadPricing()
    } catch (error) {
      console.error('Error saving pricing:', error)
      toast({
        title: "Error",
        description: "Failed to save pricing",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddNewPricing = async () => {
    if (!newToolPricing.toolName.trim()) {
      toast({
        title: "Validation Error",
        description: "Tool name is required",
        variant: "destructive"
      })
      return
    }

    // Check if pricing already exists
    const existingPricing = pricing.find(p => p.toolName === newToolPricing.toolName)
    if (existingPricing) {
      toast({
        title: "Validation Error",
        description: "Pricing for this tool already exists",
        variant: "destructive"
      })
      return
    }

    await handleSavePricing(
      newToolPricing.toolName,
      newToolPricing.pricePerUseTokens,
      newToolPricing.isEnabled
    )

    setNewToolPricing({
      toolName: '',
      pricePerUseTokens: 10,
      isEnabled: true
    })
    setIsAddDialogOpen(false)
  }

  const handleToggleEnabled = async (toolPricing: ToolPricing) => {
    await handleSavePricing(
      toolPricing.toolName,
      toolPricing.pricePerUseTokens,
      !toolPricing.isEnabled
    )
  }

  const getTotalRevenue = () => {
    return usageStats.reduce((sum, stat) => sum + stat.totalRevenue, 0)
  }

  const getTotalUsage = () => {
    return usageStats.reduce((sum, stat) => sum + stat.totalUsage, 0)
  }

  const getToolStats = (toolName: string) => {
    return usageStats.find(stat => stat.toolName === toolName)
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Tool Pricing Manager</h2>
          <p className="text-muted-foreground">Server: {serverName}</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Tool Pricing
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tool Pricing</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="toolName">Tool Name</Label>
                <Input
                  id="toolName"
                  value={newToolPricing.toolName}
                  onChange={(e) => setNewToolPricing(prev => ({ ...prev, toolName: e.target.value }))}
                  placeholder="e.g., search_web"
                />
              </div>
              <div>
                <Label htmlFor="price">Price per Use (Tokens)</Label>
                <Input
                  id="price"
                  type="number"
                  value={newToolPricing.pricePerUseTokens}
                  onChange={(e) => setNewToolPricing(prev => ({ ...prev, pricePerUseTokens: parseInt(e.target.value) || 0 }))}
                  min={0}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newToolPricing.isEnabled}
                  onCheckedChange={(checked) => setNewToolPricing(prev => ({ ...prev, isEnabled: checked }))}
                />
                <Label>Enabled</Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddNewPricing} disabled={isLoading}>
                  Add Pricing
                </Button>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Revenue Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">{getTotalRevenue()} tokens</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Usage</p>
              <p className="text-2xl font-bold">{getTotalUsage()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Tools Configured</p>
              <p className="text-2xl font-bold">{pricing.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pricing Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Tool Pricing Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pricing.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No tool pricing configured</p>
              <p className="text-sm">Add pricing for your tools to start earning tokens</p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {pricing.map((toolPricing) => {
                  const stats = getToolStats(toolPricing.toolName)
                  const isEditing = editingTool?.id === toolPricing.id

                  return (
                    <div key={toolPricing.id} className="p-4 border rounded">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Zap className="h-4 w-4 text-blue-500" />
                            <h3 className="font-medium">{toolPricing.toolName}</h3>
                            <div className="flex items-center gap-1">
                              {toolPricing.isEnabled ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                              <Badge variant={toolPricing.isEnabled ? 'default' : 'secondary'}>
                                {toolPricing.isEnabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label>Price per Use (Tokens)</Label>
                                  <Input
                                    type="number"
                                    value={editingTool.pricePerUseTokens}
                                    onChange={(e) => setEditingTool(prev => 
                                      prev ? { ...prev, pricePerUseTokens: parseInt(e.target.value) || 0 } : null
                                    )}
                                    min={0}
                                  />
                                </div>
                                <div className="flex items-end gap-2">
                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      checked={editingTool.isEnabled}
                                      onCheckedChange={(checked) => setEditingTool(prev => 
                                        prev ? { ...prev, isEnabled: checked } : null
                                      )}
                                    />
                                    <Label>Enabled</Label>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSavePricing(
                                    editingTool.toolName,
                                    editingTool.pricePerUseTokens,
                                    editingTool.isEnabled
                                  )}
                                  disabled={isLoading}
                                >
                                  <Save className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingTool(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Price per Use</p>
                                <p className="font-medium">{toolPricing.pricePerUseTokens} tokens</p>
                              </div>
                              {stats && (
                                <>
                                  <div>
                                    <p className="text-muted-foreground">Total Usage</p>
                                    <p className="font-medium">{stats.totalUsage}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Revenue</p>
                                    <p className="font-medium">{stats.totalRevenue} tokens</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Success Rate</p>
                                    <p className="font-medium">{stats.successRate.toFixed(1)}%</p>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingTool(toolPricing)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleEnabled(toolPricing)}
                            >
                              {toolPricing.isEnabled ? 'Disable' : 'Enable'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Usage Analytics */}
      {usageStats.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {usageStats.slice(0, 10).map((stat, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{stat.toolName}</p>
                    <p className="text-sm text-muted-foreground">
                      {stat.totalUsage} uses • {stat.successRate.toFixed(1)}% success rate
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">{stat.totalRevenue} tokens</p>
                    <p className="text-sm text-muted-foreground">
                      Avg: {(stat.avgDuration / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Hook for managing tool pricing
export const useToolPricing = (serverId: number) => {
  const [pricing, setPricing] = useState<ToolPricing[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadPricing = async (apiUrl = '/api') => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/mcp/servers/${serverId}/pricing`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setPricing(data.toolPricing || [])
      }
    } catch (error) {
      console.error('Error loading pricing:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updatePricing = async (toolName: string, pricePerUseTokens: number, isEnabled: boolean, apiUrl = '/api') => {
    try {
      const response = await fetch(`${apiUrl}/mcp/servers/${serverId}/tools/${encodeURIComponent(toolName)}/pricing`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify({
          pricePerUseTokens,
          isEnabled
        })
      })

      if (response.ok) {
        await loadPricing(apiUrl)
        return true
      }
    } catch (error) {
      console.error('Error updating pricing:', error)
    }
    return false
  }

  useEffect(() => {
    if (serverId) {
      loadPricing()
    }
  }, [serverId])

  return {
    pricing,
    isLoading,
    loadPricing,
    updatePricing
  }
}