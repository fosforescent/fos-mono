import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Send,
  Users,
  Bot,
  User as UserIcon,
  Clock,
  CheckCheck
} from 'lucide-react'

interface Message {
  id: string
  type: 'user' | 'system' | 'event'
  author: string
  authorCid?: string
  content: string
  timestamp: Date
  metadata?: any
}

interface GroupMember {
  cid: string
  name: string
  isOnline: boolean
}

interface GroupConsoleProps {
  groupCid: string
  groupName: string
  members: GroupMember[]
  apiUrl: string
}

export const GroupConsole: React.FC<GroupConsoleProps> = ({
  groupCid,
  groupName,
  members,
  apiUrl
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initialize WebSocket or event connection
    connectToGroup()
    loadMessageHistory()

    return () => {
      disconnectFromGroup()
    }
  }, [groupCid])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const connectToGroup = () => {
    console.log('Connecting to group:', groupCid)

    // Connect to WebSocket for real-time events
    const token = localStorage.getItem('auth')
    if (!token) {
      addSystemMessage('Not authenticated')
      return
    }

    const wsUrl = `${apiUrl.replace('http', 'ws')}/ws/${token}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected for group events')
      setIsConnected(true)
      addSystemMessage('Connected to group')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('Received WebSocket message:', data)

        if (data.type === 'group_message' && data.groupCid === groupCid) {
          const message: Message = {
            id: Date.now().toString(),
            type: 'user',
            author: data.authorName || 'Unknown',
            authorCid: data.authorCid,
            content: data.data.message,
            timestamp: new Date(data.timestamp)
          }
          setMessages(prev => [...prev, message])
        } else if (data.type === 'member_joined' && data.groupCid === groupCid) {
          addSystemMessage(`${data.data.memberName} joined the group`)
        } else if (data.type === 'member_left' && data.groupCid === groupCid) {
          addSystemMessage(`${data.data.memberName} left the group`)
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsConnected(false)
      addSystemMessage('Connection error')
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
      addSystemMessage('Disconnected from group')
    }

    return () => {
      ws.close()
    }
  }

  const disconnectFromGroup = () => {
    console.log('Disconnecting from group:', groupCid)
    setIsConnected(false)
  }

  const loadMessageHistory = async () => {
    try {
      const response = await fetch(`${apiUrl}/groups/${groupCid}/messages?limit=50`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.cid,
          type: 'user',
          author: msg.authorName || 'Unknown',
          authorCid: msg.authorID,
          content: msg.content,
          timestamp: new Date(msg.createdAt)
        }))
        setMessages(loadedMessages.reverse()) // Reverse to show oldest first
      }
    } catch (error) {
      console.error('Error loading message history:', error)
      addSystemMessage('Failed to load message history')
    }
  }

  const addSystemMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'system',
      author: 'System',
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, message])
  }

  const sendMessage = async () => {
    if (!inputMessage.trim()) return

    const messageContent = inputMessage
    setInputMessage('')

    try {
      const response = await fetch(`${apiUrl}/groups/${groupCid}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify({
          message: messageContent
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // Message will be received via WebSocket and added to the UI
      // No need for optimistic update since WebSocket is fast
    } catch (error) {
      console.error('Error sending message:', error)
      addSystemMessage('Failed to send message')
      // Restore the message to input on error
      setInputMessage(messageContent)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'system':
        return <Bot className="h-4 w-4" />
      case 'event':
        return <Clock className="h-4 w-4" />
      default:
        return <UserIcon className="h-4 w-4" />
    }
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }).format(date)
  }

  return (
    <div className="flex flex-col h-screen max-h-[800px]">
      {/* Header */}
      <Card className="rounded-b-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {groupName}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                {members.length}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Messages */}
      <Card className="flex-1 rounded-none border-t-0">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.type === 'system' ? 'justify-center' : ''
                }`}
              >
                {message.type !== 'system' && (
                  <div className="flex-shrink-0 mt-1">
                    {getMessageIcon(message.type)}
                  </div>
                )}
                <div className={`flex-1 ${message.type === 'system' ? 'text-center' : ''}`}>
                  {message.type === 'system' ? (
                    <p className="text-sm text-muted-foreground italic">
                      {message.content}
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{message.author}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm">{message.content}</p>
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </Card>

      {/* Input */}
      <Card className="rounded-t-none border-t-0">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!isConnected}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || !isConnected}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Members sidebar (optional - can be toggled) */}
      {/* <Card className="w-64 rounded-l-none border-l-0">
        <CardHeader>
          <CardTitle className="text-sm">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-full">
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.cid} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${member.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm">{member.name}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card> */}
    </div>
  )
}

/**
 * Event propagation logic (to be implemented):
 *
 * 1. When a message is sent to a group node:
 *    - Store as COMMENT_FIELD child in the group node
 *    - Emit event to all PERSON_FIELD children (group members)
 *    - If group has GROUP_FIELD children (nested groups), propagate to those
 *
 * 2. Event types:
 *    - message: User message
 *    - node_update: Node structure changed
 *    - member_joined: User added to group
 *    - member_left: User removed from group
 *    - system: System notifications
 *
 * 3. Message storage:
 *    - Messages are FosNodes with COMMENT_FIELD type
 *    - Attached as children to the group node
 *    - Immutable - edits create new nodes with reference to original
 *
 * 4. Real-time delivery:
 *    - WebSocket connection per user
 *    - Server traverses group children to find all PERSON_FIELD members
 *    - Emits event to each member's active connections
 */
