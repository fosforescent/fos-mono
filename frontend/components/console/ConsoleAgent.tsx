import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Terminal, Send, Bot, User, Settings, Zap, Cog, CheckCircle, AlertCircle, Volume2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { VoiceInput } from '../voice/VoiceInput'
import { VoiceNote } from '../voice/VoiceNote'

type AgentMode = 'auto' | 'confirm' | 'prompt'

interface VoiceNoteData {
  audioBlob: Blob
  duration: number
  transcription?: string
  audioUrl?: string
}

interface Message {
  id: string
  type: 'user' | 'agent' | 'system' | 'tool' | 'confirmation' | 'options' | 'voice_input'
  content: string
  timestamp: Date
  toolName?: string
  cost?: number
  mode?: AgentMode
  data?: any // For storing structured response data
  voiceNote?: VoiceNoteData // For voice messages
}

interface ToolOption {
  bidId: string
  name: string
  description: string
  cost: number
  server: string
  reason: string
  relevanceScore?: number
}

interface AgentResponse {
  message: string
  sessionId?: string
  availableTools?: number
  mode: AgentMode
  autoExecuted?: boolean
  executedTool?: {
    name: string
    cost: number
    server: string
  }
  result?: any
  recommendedTool?: {
    bidId: string
    name: string
    description: string
    cost: number
    server: string
    reason: string
  }
  confirmation?: {
    question: string
    yesAction: any
  }
  toolOptions?: ToolOption[]
  instruction?: string
  suggestion?: string
}

interface ConsoleAgentProps {
  apiUrl?: string
  onToolExecution?: (toolName: string, params: any) => void
  defaultMode?: AgentMode
  defaultMaxTokens?: number
  // NEW: Support for customer mode and service requests
  consoleMode?: 'standard' | 'customer_request'
  uiVariant?: 'dashboard' | 'customer'
  onServiceRequestGenerated?: (request: any) => void
  welcomeMessage?: string
  enableVoiceInput?: boolean
}

export const ConsoleAgent: React.FC<ConsoleAgentProps> = ({ 
  apiUrl = '/api', 
  onToolExecution,
  defaultMode = 'prompt',
  defaultMaxTokens = 100,
  consoleMode = 'standard',
  uiVariant = 'dashboard',
  onServiceRequestGenerated,
  welcomeMessage,
  enableVoiceInput = true
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<AgentMode>(defaultMode)
  const [maxTokens, setMaxTokens] = useState(defaultMaxTokens)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [pendingConfirmation, setPendingConfirmation] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Initialize connection
    connectToMCPServer()
    // Add welcome message
    const defaultWelcome = consoleMode === 'customer_request' 
      ? "Hi! I'm here to help you find the right service provider. You can speak or type to describe what you need."
      : `ConsoleAgent ready! Mode: ${mode}, Max tokens: ${maxTokens}`
    addSystemMessage(welcomeMessage || defaultWelcome)
  }, [])

  useEffect(() => {
    // Update system when mode changes
    if (messages.length > 0) {
      addSystemMessage(`Mode changed to: ${mode}${mode === 'auto' ? ` (max ${maxTokens} tokens)` : ''}`)
    }
  }, [mode, maxTokens])

  const connectToMCPServer = async () => {
    setConnectionStatus('connecting')
    try {
      // Test connection to MCP server
      const response = await fetch(`${apiUrl}/mcp/tools/list`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })
      
      if (response.ok) {
        setConnectionStatus('connected')
        addSystemMessage('Connected to Fosforescent MCP server')
      } else {
        throw new Error('Connection failed')
      }
    } catch (error) {
      setConnectionStatus('disconnected')
      addSystemMessage('Failed to connect to MCP server')
    }
  }

  const callMCPTool = async (toolName: string, params: any) => {
    const response = await fetch(`${apiUrl}/mcp/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth')}`
      },
      body: JSON.stringify({
        name: toolName,
        arguments: params
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Tool execution failed')
    }

    const result = await response.json()
    return JSON.parse(result.content[0].text)
  }

  const addMessage = (type: Message['type'], content: string, toolName?: string, cost?: number, data?: any, voiceNote?: VoiceNoteData) => {
    const message: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      toolName,
      cost,
      mode,
      data,
      voiceNote
    }
    setMessages(prev => [...prev, message])
  }

  const addSystemMessage = (content: string) => {
    addMessage('system', content)
  }

  const handleVoiceNoteSubmit = async (voiceNote: VoiceNoteData) => {
    // Add voice message to console
    const content = voiceNote.transcription || '[Processing voice input...]'
    addMessage('voice_input', content, undefined, undefined, undefined, voiceNote)

    setIsLoading(true)

    try {
      // Process based on console mode
      if (consoleMode === 'customer_request' && voiceNote.transcription) {
        await generateServiceRequest(voiceNote.transcription, voiceNote)
      } else if (voiceNote.transcription) {
        await handleChatMessage(voiceNote.transcription)
      }
    } catch (error) {
      addMessage('system', `Error processing voice input: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const generateServiceRequest = async (description: string, voiceNote?: VoiceNoteData) => {
    // AI agent processes voice/text to create structured service request
    try {
      const serviceRequest = await callMCPTool('generate_service_request', {
        description,
        voiceNote: voiceNote ? {
          duration: voiceNote.duration,
          transcription: voiceNote.transcription
        } : undefined,
        mode: 'request_generation'
      })

      // Show generated request for customer approval
      addMessage('agent', 
        `I've created a service request based on your description. Here's what I understood:\n\n${JSON.stringify(serviceRequest, null, 2)}\n\nWould you like me to send this to service providers?`,
        undefined,
        undefined,
        { serviceRequest, requiresApproval: true }
      )

      if (onServiceRequestGenerated) {
        onServiceRequestGenerated(serviceRequest)
      }
    } catch (error) {
      // Fallback to regular chat if service request generation fails
      await handleChatMessage(description)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userInput = input.trim()
    setInput('')
    addMessage('user', userInput)

    setIsLoading(true)

    try {
      // Check if this is a tool command
      if (userInput.startsWith('/')) {
        await handleToolCommand(userInput)
      } else {
        // Regular chat with agent
        await handleChatMessage(userInput)
      }
    } catch (error) {
      addMessage('system', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      toast({
        title: "Error",
        description: "Failed to process command",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleToolCommand = async (command: string) => {
    const [toolCommand, ...args] = command.slice(1).split(' ')
    
    switch (toolCommand) {
      case 'tools':
        showAvailableTools()
        break
      case 'use':
        if (args.length > 0) {
          await executeToolByName(args[0], args.slice(1))
        } else {
          addMessage('system', 'Usage: /use <tool-name> [args...]')
        }
        break
      case 'help':
        showHelp()
        break
      default:
        addMessage('system', `Unknown command: ${toolCommand}. Type /help for available commands.`)
    }
  }

  const showAvailableTools = async () => {
    try {
      const response = await callMCPTool('get_bids', {
        taskDescription: 'show me all available tools',
        context: {}
      })
      
      if (response.bids && response.bids.length > 0) {
        const toolsList = response.bids.map((bid: any) => 
          `• ${bid.toolName} (${bid.tokenCost} tokens) - ${bid.toolDescription || 'No description'}\n  Server: ${bid.serverName}`
        ).join('\n\n')
        
        addMessage('system', `Available Tools:\n${toolsList}\n\nChat naturally or use /use <tool-name> to execute specific tools.`)
      } else {
        addMessage('system', 'No tools are currently available. Make sure MCP servers are connected.')
      }
    } catch (error) {
      addMessage('system', `Failed to load tools: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const showHelp = () => {
    const helpText = `Console Agent Commands:
/tools - List available tools
/use <tool-name> [args] - Execute a tool
/help - Show this help message

Agent Modes:
• AUTO: Automatically executes best tool under token limit
• CONFIRM: Suggests best tool and asks yes/no
• PROMPT: Shows all available tools for selection

You can also chat naturally and the agent will find appropriate tools based on your current mode.`
    
    addMessage('system', helpText)
  }

  const executeToolByName = async (toolName: string, args: string[]) => {
    // For direct tool execution, get bids first then execute
    try {
      const bidResponse = await callMCPTool('get_bids', {
        taskDescription: `execute ${toolName} with ${args.join(' ')}`,
        context: {}
      })
      
      const matchingBid = bidResponse.bids?.find((bid: any) => 
        bid.toolName.toLowerCase() === toolName.toLowerCase()
      )
      
      if (!matchingBid) {
        addMessage('system', `Tool "${toolName}" not found. Use /tools to see available tools.`)
        return
      }
      
      await executeToolBid(matchingBid.bidId, { query: args.join(' ') })
    } catch (error) {
      addMessage('system', `Failed to execute tool: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const executeToolBid = async (bidId: string, params: any) => {
    try {
      addMessage('system', `Executing tool...`)
      
      const result = await callMCPTool('proxy_tool', {
        bidId,
        parameters: params
      })
      
      if (result.success) {
        addMessage('tool', 
          result.result?.result || 'Tool executed successfully', 
          result.result?.toolName,
          result.tokenCost
        )
        
        onToolExecution?.(result.result?.toolName, params)
        
        toast({
          title: "Tool Executed",
          description: `Tool completed successfully`,
        })
      } else {
        throw new Error(result.error || 'Tool execution failed')
      }
    } catch (error) {
      addMessage('system', `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleConfirmation = async (confirmed: boolean) => {
    if (!pendingConfirmation) return
    
    if (confirmed && pendingConfirmation.yesAction) {
      try {
        const result = await callMCPTool('agent_execute_with_mode', pendingConfirmation.yesAction.params)
        
        if (result.success && result.result) {
          const toolResult = JSON.parse(result.result.content[0].text)
          addMessage('tool', 
            toolResult.result?.result || 'Tool executed successfully',
            toolResult.result?.toolName,
            toolResult.tokenCost
          )
        } else {
          addMessage('system', `Execution failed: ${result.error || 'Unknown error'}`)
        }
      } catch (error) {
        addMessage('system', `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else {
      addMessage('system', 'Tool execution cancelled.')
    }
    
    setPendingConfirmation(null)
  }

  const handleToolOptionSelection = async (bidId: string, toolName: string) => {
    try {
      await executeToolBid(bidId, { query: input })
    } catch (error) {
      console.error('Tool execution failed:', error)
    }
  }

  const handleChatMessage = async (message: string) => {
    try {
      // Call the agent_chat MCP tool
      const response: AgentResponse = await callMCPTool('agent_chat', {
        message,
        mode,
        maxTokens,
        context: {}
      })

      // Add agent response message
      addMessage('agent', response.message, undefined, undefined, response)

      // Handle different response types based on mode
      if (response.autoExecuted && response.result) {
        // Auto mode - tool was executed
        const toolResult = JSON.parse(response.result.content[0].text)
        if (toolResult.success) {
          addMessage('tool', 
            `✅ Auto-executed: ${response.executedTool?.name}\n${toolResult.result?.result || 'Tool completed successfully'}`,
            response.executedTool?.name,
            response.executedTool?.cost
          )
        } else {
          addMessage('system', `❌ Auto-execution failed: ${toolResult.error}`)
        }
      } else if (response.confirmation) {
        // Confirm mode - show confirmation prompt
        setPendingConfirmation(response.confirmation)
        addMessage('confirmation', 
          response.confirmation.question,
          undefined,
          undefined,
          response.confirmation
        )
      } else if (response.toolOptions) {
        // Prompt mode - show options
        addMessage('options', 
          `Available tools:\n${response.toolOptions.map(tool => 
            `• ${tool.name} (${tool.cost} tokens) - ${tool.description}\n  Server: ${tool.server}\n  Reason: ${tool.reason}`
          ).join('\n\n')}\n\n${response.instruction}`,
          undefined,
          undefined,
          response.toolOptions
        )
      }

    } catch (error) {
      addMessage('system', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      toast({
        title: "Agent Error",
        description: "Failed to process your request",
        variant: "destructive"
      })
    }
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500'
      case 'connecting': return 'bg-yellow-500'
      case 'disconnected': return 'bg-red-500'
    }
  }

  const getMessageIcon = (type: Message['type']) => {
    switch (type) {
      case 'user': return <User className="h-4 w-4" />
      case 'agent': return <Bot className="h-4 w-4" />
      case 'tool': return <Zap className="h-4 w-4" />
      case 'system': return <Settings className="h-4 w-4" />
      case 'confirmation': return <AlertCircle className="h-4 w-4" />
      case 'options': return <CheckCircle className="h-4 w-4" />
      case 'voice_input': return <Volume2 className="h-4 w-4" />
    }
  }

  const getModeColor = (mode: AgentMode) => {
    switch (mode) {
      case 'auto': return 'bg-green-100 text-green-800'
      case 'confirm': return 'bg-yellow-100 text-yellow-800'
      case 'prompt': return 'bg-blue-100 text-blue-800'
    }
  }

  const getModeDescription = (mode: AgentMode) => {
    switch (mode) {
      case 'auto': return 'Automatically executes best affordable tool'
      case 'confirm': return 'Suggests best tool and asks for confirmation'
      case 'prompt': return 'Shows all tool options for manual selection'
    }
  }

  const containerClass = uiVariant === 'customer' 
    ? "h-[600px] flex flex-col border-blue-200 bg-gradient-to-br from-blue-50 to-white"
    : "h-[600px] flex flex-col"

  const headerTitle = consoleMode === 'customer_request' ? 'Service Request Assistant' : 'Console Agent'

  return (
    <Card className={containerClass}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            <CardTitle>{headerTitle}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <span className="text-sm text-muted-foreground capitalize">
              {connectionStatus}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Badge className={getModeColor(mode)} title={getModeDescription(mode)}>
            <Cog className="h-3 w-3 mr-1" />
            {mode.toUpperCase()}
          </Badge>
          {mode === 'auto' && (
            <Badge variant="outline" className="text-xs">
              Max: {maxTokens}t
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {connectionStatus}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 pb-4">
            {messages.map((message, index) => (
              <div key={message.id} className="flex gap-3">
                <div className={`p-2 rounded-full ${
                  message.type === 'user' ? 'bg-blue-100' :
                  message.type === 'agent' ? 'bg-green-100' :
                  message.type === 'tool' ? 'bg-purple-100' :
                  message.type === 'voice_input' ? 'bg-orange-100' :
                  'bg-gray-100'
                }`}>
                  {getMessageIcon(message.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm capitalize">
                      {message.type === 'tool' ? message.toolName : message.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                    {message.cost && (
                      <Badge variant="outline" className="text-xs">
                        {message.cost} tokens
                      </Badge>
                    )}
                    {message.mode && (
                      <Badge className={getModeColor(message.mode)} variant="outline">
                        {message.mode}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </div>

                  {/* Render voice note if present */}
                  {message.voiceNote && (
                    <div className="mt-2">
                      <VoiceNote
                        audioUrl={message.voiceNote.audioUrl!}
                        duration={message.voiceNote.duration}
                        transcription={message.voiceNote.transcription ? {
                          text: message.voiceNote.transcription,
                          confidence: 0.8
                        } : undefined}
                        showTranscription={true}
                        className="border-none shadow-sm"
                      />
                    </div>
                  )}
                  
                  {/* Render interactive elements for different message types */}
                  {message.type === 'confirmation' && message.data && (
                    <div className="flex gap-2 mt-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleConfirmation(true)}
                        disabled={isLoading}
                      >
                        ✅ Yes
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleConfirmation(false)}
                        disabled={isLoading}
                      >
                        ❌ No
                      </Button>
                    </div>
                  )}
                  
                  {message.type === 'options' && message.data && (
                    <div className="grid gap-2 mt-2 max-w-md">
                      {message.data.slice(0, 3).map((option: ToolOption) => (
                        <Button
                          key={option.bidId}
                          size="sm"
                          variant="outline"
                          className="justify-start text-left h-auto p-2"
                          onClick={() => handleToolOptionSelection(option.bidId, option.name)}
                          disabled={isLoading}
                        >
                          <div>
                            <div className="font-medium">{option.name} ({option.cost}t)</div>
                            <div className="text-xs text-muted-foreground">{option.server}</div>
                          </div>
                        </Button>
                      ))}
                      {message.data.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{message.data.length - 3} more tools available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="p-2 rounded-full bg-green-100">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground">
                    Agent is thinking...
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>
        
        <Separator />
        
        {/* Mode Controls */}
        <div className="p-4 border-b bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="mode" className="text-xs font-medium">Agent Mode</Label>
              <Select value={mode} onValueChange={(value: AgentMode) => setMode(value)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prompt">💬 Prompt - Show options</SelectItem>
                  <SelectItem value="confirm">❓ Confirm - Ask yes/no</SelectItem>
                  <SelectItem value="auto">🤖 Auto - Execute best tool</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {mode === 'auto' && (
              <div>
                <Label htmlFor="maxTokens" className="text-xs font-medium">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  min="0"
                  max="1000"
                  className="h-8 text-xs"
                />
              </div>
            )}
            
            <div className="text-xs text-muted-foreground flex items-end">
              {getModeDescription(mode)}
            </div>
          </div>
        </div>
        
        {enableVoiceInput ? (
          <div className="p-4">
            <VoiceInput
              onVoiceNoteSubmit={handleVoiceNoteSubmit}
              onTextSubmit={async (text) => {
                setInput('')
                addMessage('user', text)
                setIsLoading(true)
                try {
                  if (text.startsWith('/')) {
                    await handleToolCommand(text)
                  } else {
                    if (consoleMode === 'customer_request') {
                      await generateServiceRequest(text)
                    } else {
                      await handleChatMessage(text)
                    }
                  }
                } catch (error) {
                  addMessage('system', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
                } finally {
                  setIsLoading(false)
                }
              }}
              placeholder={consoleMode === 'customer_request' 
                ? "Describe what service you need..."
                : "Type a message or /help for commands..."
              }
              disabled={isLoading || connectionStatus !== 'connected'}
              apiUrl={apiUrl}
              className="space-y-2"
            />
            <div className="text-xs text-muted-foreground mt-2">
              {consoleMode === 'customer_request' 
                ? "Describe your project needs in detail for better service matching"
                : `Commands: /tools, /use <tool>, /help | Mode: ${mode}${mode === 'auto' ? ` (≤${maxTokens}t)` : ''}`
              }
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message or /help for commands..."
                disabled={isLoading || connectionStatus !== 'connected'}
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={isLoading || !input.trim() || connectionStatus !== 'connected'}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Commands: /tools, /use &lt;tool&gt;, /help | Mode: {mode}{mode === 'auto' ? ` (≤${maxTokens}t)` : ''}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}