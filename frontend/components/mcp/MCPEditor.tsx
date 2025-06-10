import React, { useState, useEffect } from 'react'
import { Button } from '@/frontend/components/ui/button'
import { Input } from '@/frontend/components/ui/input'
import { Textarea } from '@/frontend/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Badge } from '@/frontend/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { ScrollArea } from '@/frontend/components/ui/scroll-area'
import { Separator } from '@/frontend/components/ui/separator'
import { Label } from '@/frontend/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'
import { 
  Code, 
  Play, 
  Save, 
  Download, 
  Upload, 
  Copy, 
  Settings,
  Zap,
  MessageSquare,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react'
import { useToast } from '@/frontend/components/ui/use-toast'

interface MCPMessage {
  id: string
  method: string
  params: any
  result?: any
  error?: any
  timestamp: Date
  direction: 'sent' | 'received'
}

interface MCPToolConfig {
  id: string
  name: string
  description: string
  parameters: {
    name: string
    type: string
    description?: string
    required?: boolean
    default?: any
  }[]
  priceTokens: number
}

interface MCPEditorProps {
  servers: string[]
  onMessageSend?: (serverId: string, message: any) => Promise<any>
  onToolConfigSave?: (config: MCPToolConfig) => void
  className?: string
}

export const MCPEditor: React.FC<MCPEditorProps> = ({
  servers = [],
  onMessageSend,
  onToolConfigSave,
  className = ''
}) => {
  const [selectedServer, setSelectedServer] = useState<string>('')
  const [messageHistory, setMessageHistory] = useState<MCPMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [messageMethod, setMessageMethod] = useState('tools/call')
  const [messageParams, setMessageParams] = useState('{}')
  const [toolConfig, setToolConfig] = useState<MCPToolConfig>({
    id: '',
    name: '',
    description: '',
    parameters: [],
    priceTokens: 10
  })
  const [newParameter, setNewParameter] = useState({
    name: '',
    type: 'string',
    description: '',
    required: false,
    default: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const messageTemplates = {
    'tools/list': '{}',
    'tools/call': '{\n  "name": "tool_name",\n  "arguments": {\n    "param1": "value1"\n  }\n}',
    'resources/list': '{}',
    'resources/read': '{\n  "uri": "file://path/to/resource"\n}',
    'prompts/list': '{}',
    'prompts/get': '{\n  "name": "prompt_name",\n  "arguments": {}\n}'
  }

  useEffect(() => {
    if (messageMethod && messageTemplates[messageMethod as keyof typeof messageTemplates]) {
      setMessageParams(messageTemplates[messageMethod as keyof typeof messageTemplates])
    }
  }, [messageMethod])

  const sendMessage = async () => {
    if (!selectedServer || !messageMethod) {
      toast({
        title: "Validation Error",
        description: "Please select a server and method",
        variant: "destructive"
      })
      return
    }

    let parsedParams: any
    try {
      parsedParams = JSON.parse(messageParams)
    } catch (error) {
      toast({
        title: "JSON Error",
        description: "Invalid JSON in parameters",
        variant: "destructive"
      })
      return
    }

    const message: Omit<MCPMessage, 'id' | 'timestamp'> = {
      method: messageMethod,
      params: parsedParams,
      direction: 'sent'
    }

    const messageWithId: MCPMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    }

    setMessageHistory(prev => [...prev, messageWithId])
    setIsLoading(true)

    try {
      const result = await onMessageSend?.(selectedServer, {
        method: messageMethod,
        params: parsedParams
      })

      const responseMessage: MCPMessage = {
        id: Date.now().toString() + '_response',
        method: messageMethod,
        params: parsedParams,
        result,
        timestamp: new Date(),
        direction: 'received'
      }

      setMessageHistory(prev => [...prev, responseMessage])

      toast({
        title: "Message Sent",
        description: "MCP message sent successfully"
      })
    } catch (error) {
      const errorMessage: MCPMessage = {
        id: Date.now().toString() + '_error',
        method: messageMethod,
        params: parsedParams,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        direction: 'received'
      }

      setMessageHistory(prev => [...prev, errorMessage])

      toast({
        title: "Error",
        description: "Failed to send MCP message",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addParameter = () => {
    if (!newParameter.name) {
      toast({
        title: "Validation Error",
        description: "Parameter name is required",
        variant: "destructive"
      })
      return
    }

    setToolConfig(prev => ({
      ...prev,
      parameters: [...prev.parameters, { ...newParameter }]
    }))

    setNewParameter({
      name: '',
      type: 'string',
      description: '',
      required: false,
      default: ''
    })
  }

  const removeParameter = (index: number) => {
    setToolConfig(prev => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index)
    }))
  }

  const saveToolConfig = () => {
    if (!toolConfig.name || !toolConfig.description) {
      toast({
        title: "Validation Error",
        description: "Tool name and description are required",
        variant: "destructive"
      })
      return
    }

    onToolConfigSave?.(toolConfig)
    toast({
      title: "Tool Saved",
      description: `Tool configuration for "${toolConfig.name}" has been saved`
    })
  }

  const exportMessages = () => {
    const data = JSON.stringify(messageHistory, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mcp-messages-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: "Copied to clipboard"
    })
  }

  const getMessageStatusIcon = (message: MCPMessage) => {
    if (message.direction === 'sent') {
      return <Play className="h-3 w-3 text-blue-500" />
    }
    if (message.error) {
      return <AlertCircle className="h-3 w-3 text-red-500" />
    }
    if (message.result) {
      return <CheckCircle className="h-3 w-3 text-green-500" />
    }
    return <Clock className="h-3 w-3 text-yellow-500" />
  }

  return (
    <div className={className}>
      <Tabs defaultValue="protocol" className="space-y-4">
        <TabsList>
          <TabsTrigger value="protocol">Protocol Testing</TabsTrigger>
          <TabsTrigger value="tools">Tool Configuration</TabsTrigger>
          <TabsTrigger value="history">Message History</TabsTrigger>
        </TabsList>

        <TabsContent value="protocol" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                MCP Protocol Tester
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Server Selection */}
              <div>
                <Label htmlFor="server">MCP Server</Label>
                <Select value={selectedServer} onValueChange={setSelectedServer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an MCP server" />
                  </SelectTrigger>
                  <SelectContent>
                    {servers.map(server => (
                      <SelectItem key={server} value={server}>
                        {server}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Method Selection */}
              <div>
                <Label htmlFor="method">Method</Label>
                <Select value={messageMethod} onValueChange={setMessageMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tools/list">tools/list</SelectItem>
                    <SelectItem value="tools/call">tools/call</SelectItem>
                    <SelectItem value="resources/list">resources/list</SelectItem>
                    <SelectItem value="resources/read">resources/read</SelectItem>
                    <SelectItem value="prompts/list">prompts/list</SelectItem>
                    <SelectItem value="prompts/get">prompts/get</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Parameters */}
              <div>
                <Label htmlFor="params">Parameters (JSON)</Label>
                <Textarea
                  id="params"
                  value={messageParams}
                  onChange={(e) => setMessageParams(e.target.value)}
                  placeholder="Enter JSON parameters..."
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={sendMessage} disabled={isLoading || !selectedServer}>
                  <Play className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(messageParams)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Tool Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Tool Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="toolName">Tool Name</Label>
                  <Input
                    id="toolName"
                    value={toolConfig.name}
                    onChange={(e) => setToolConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., search_web"
                  />
                </div>
                <div>
                  <Label htmlFor="toolId">Tool ID</Label>
                  <Input
                    id="toolId"
                    value={toolConfig.id}
                    onChange={(e) => setToolConfig(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="Auto-generated from name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="toolDescription">Description</Label>
                <Textarea
                  id="toolDescription"
                  value={toolConfig.description}
                  onChange={(e) => setToolConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What this tool does..."
                />
              </div>

              <div>
                <Label htmlFor="priceTokens">Price (Tokens)</Label>
                <Input
                  id="priceTokens"
                  type="number"
                  value={toolConfig.priceTokens}
                  onChange={(e) => setToolConfig(prev => ({ ...prev, priceTokens: parseInt(e.target.value) || 0 }))}
                  min={0}
                />
              </div>

              {/* Parameters */}
              <div>
                <Label>Parameters</Label>
                <div className="space-y-3">
                  {toolConfig.parameters.map((param, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 border rounded">
                      <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="font-medium">{param.name}</span>
                          {param.required && <Badge className="ml-1 text-xs">required</Badge>}
                        </div>
                        <div className="text-muted-foreground">{param.type}</div>
                        <div className="text-muted-foreground">{param.description}</div>
                        <div className="text-muted-foreground">{param.default}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeParameter(index)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}

                  {/* Add Parameter Form */}
                  <div className="p-3 border border-dashed rounded space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={newParameter.name}
                        onChange={(e) => setNewParameter(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Parameter name"
                      />
                      <Select
                        value={newParameter.type}
                        onValueChange={(value) => setNewParameter(prev => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">string</SelectItem>
                          <SelectItem value="number">number</SelectItem>
                          <SelectItem value="boolean">boolean</SelectItem>
                          <SelectItem value="array">array</SelectItem>
                          <SelectItem value="object">object</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={newParameter.description}
                        onChange={(e) => setNewParameter(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Description"
                      />
                      <Input
                        value={newParameter.default}
                        onChange={(e) => setNewParameter(prev => ({ ...prev, default: e.target.value }))}
                        placeholder="Default value"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newParameter.required}
                          onChange={(e) => setNewParameter(prev => ({ ...prev, required: e.target.checked }))}
                        />
                        Required parameter
                      </label>
                      <Button size="sm" onClick={addParameter}>
                        Add Parameter
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={saveToolConfig}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Tool Config
                </Button>
                <Button variant="outline" onClick={() => copyToClipboard(JSON.stringify(toolConfig, null, 2))}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Message History
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportMessages}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setMessageHistory([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {messageHistory.length} messages
              </div>
            </CardHeader>
            <CardContent>
              {messageHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No messages sent yet</p>
                  <p className="text-sm">Use the Protocol Testing tab to send messages</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {messageHistory.map((message, index) => (
                      <div key={message.id} className="border rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getMessageStatusIcon(message)}
                            <span className="font-medium text-sm">
                              {message.method}
                            </span>
                            <Badge variant={message.direction === 'sent' ? 'default' : 'secondary'}>
                              {message.direction}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium">Params:</span>
                            <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                              {JSON.stringify(message.params, null, 2)}
                            </pre>
                          </div>
                          
                          {message.result && (
                            <div>
                              <span className="font-medium text-green-600">Result:</span>
                              <pre className="mt-1 p-2 bg-green-50 border border-green-200 rounded text-xs overflow-x-auto">
                                {JSON.stringify(message.result, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {message.error && (
                            <div>
                              <span className="font-medium text-red-600">Error:</span>
                              <pre className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs overflow-x-auto">
                                {message.error}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Hook for managing MCP editor state
export const useMCPEditor = () => {
  const [servers, setServers] = useState<string[]>([])
  const [toolConfigs, setToolConfigs] = useState<MCPToolConfig[]>([])

  const addServer = (serverUrl: string) => {
    setServers(prev => [...prev, serverUrl])
  }

  const removeServer = (serverUrl: string) => {
    setServers(prev => prev.filter(s => s !== serverUrl))
  }

  const saveToolConfig = (config: MCPToolConfig) => {
    setToolConfigs(prev => {
      const existing = prev.findIndex(t => t.id === config.id)
      if (existing >= 0) {
        return prev.map((t, i) => i === existing ? config : t)
      }
      return [...prev, config]
    })
  }

  const sendMessage = async (serverId: string, message: any): Promise<any> => {
    // Mock implementation - replace with actual MCP client
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: `Mock response for ${message.method}`,
          timestamp: new Date().toISOString()
        })
      }, 1000)
    })
  }

  // Load sample data
  useEffect(() => {
    setServers([
      'ws://localhost:8080/mcp',
      'ws://localhost:8081/mcp',
      'http://localhost:3001/mcp'
    ])
  }, [])

  return {
    servers,
    toolConfigs,
    addServer,
    removeServer,
    saveToolConfig,
    sendMessage
  }
}