import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Filter, Users, Clock, DollarSign } from 'lucide-react'
import { CustomerRequestCard } from './CustomerRequestCard'

interface CustomerRequest {
  id: string
  customerId: string
  customerName: string
  title: string
  description: string
  budget?: { min: number, max: number }
  deadline?: Date
  category: string[]
  priority: 'low' | 'medium' | 'high' | 'urgent'
  location?: string
  voiceNotes?: Array<{
    id: string
    audioFileUrl: string
    duration: number
    transcription?: {
      text: string
      confidence: number
      language?: string
    }
  }>
  createdAt: Date
  status: 'open' | 'bidding' | 'awarded' | 'completed'
}

interface CustomerRequestQueueProps {
  apiUrl?: string
  className?: string
}

export const CustomerRequestQueue: React.FC<CustomerRequestQueueProps> = ({
  apiUrl = '/api',
  className = ''
}) => {
  const [customerRequests, setCustomerRequests] = useState<CustomerRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<CustomerRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadCustomerRequests()
  }, [])

  useEffect(() => {
    filterRequests()
  }, [customerRequests, statusFilter, priorityFilter])

  const loadCustomerRequests = async () => {
    setIsLoading(true)
    try {
      // Mock customer requests for now - in real implementation, fetch from API
      const mockRequests: CustomerRequest[] = [
        {
          id: 'req-1',
          customerId: 'cust-1',
          customerName: 'Sarah Johnson',
          title: 'Website Redesign for Local Restaurant',
          description: 'I need a complete redesign of my restaurant website. The current site is outdated and not mobile-friendly. I want something modern, clean, and easy for customers to view our menu and make reservations.',
          budget: { min: 3000, max: 8000 },
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          category: ['web-development', 'design', 'restaurant'],
          priority: 'high',
          location: 'Austin, TX',
          voiceNotes: [{
            id: 'voice-1',
            audioFileUrl: '/api/voice/mock-audio-1.webm',
            duration: 45,
            transcription: {
              text: "Hi there, I'm looking for someone to help redesign my restaurant website. The current one looks really dated and customers are having trouble viewing our menu on their phones. I'd love something modern and clean that makes it easy for people to see what we offer and maybe even make reservations online.",
              confidence: 0.92,
              language: 'en'
            }
          }],
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          status: 'open'
        },
        {
          id: 'req-2',
          customerId: 'cust-2',
          customerName: 'Mark Chen',
          title: 'Mobile App Development for Fitness Tracking',
          description: 'Looking for a developer to create a simple fitness tracking mobile app. Users should be able to log workouts, track progress, and set goals. Basic features needed with clean UI.',
          budget: { min: 15000, max: 25000 },
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          category: ['mobile-development', 'fitness', 'react-native'],
          priority: 'medium',
          location: 'Remote',
          voiceNotes: [{
            id: 'voice-2',
            audioFileUrl: '/api/voice/mock-audio-2.webm',
            duration: 62,
            transcription: {
              text: "I have an idea for a fitness tracking app that I'd like to develop. Nothing too complex - just the basics like logging workouts, tracking progress over time, and setting personal fitness goals. I'm thinking React Native so it works on both iOS and Android. Looking for someone with experience in mobile development.",
              confidence: 0.89,
              language: 'en'
            }
          }],
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          status: 'bidding'
        },
        {
          id: 'req-3',
          customerId: 'cust-3',
          customerName: 'Jennifer Liu',
          title: 'Logo Design for Tech Startup',
          description: 'Looking for a professional logo designer to create a modern, memorable logo for our AI technology startup. We need something that conveys innovation and trust.',
          budget: { min: 800, max: 2000 },
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          category: ['graphic-design', 'branding', 'logo'],
          priority: 'urgent',
          location: 'San Francisco, CA',
          createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          status: 'open'
        }
      ]
      
      setCustomerRequests(mockRequests)
    } catch (error) {
      console.error('Failed to load customer requests:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterRequests = () => {
    let filtered = [...customerRequests]

    if (statusFilter !== 'all') {
      filtered = filtered.filter(req => req.status === statusFilter)
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(req => req.priority === priorityFilter)
    }

    // Sort by priority and creation date
    filtered.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return b.createdAt.getTime() - a.createdAt.getTime()
    })

    setFilteredRequests(filtered)
  }

  const handleBidSubmit = (bid: any) => {
    console.log('Bid submitted:', bid)
    // In real implementation, update request status and notify customer
    loadCustomerRequests() // Refresh the list
  }

  const getRequestStats = () => {
    const total = customerRequests.length
    const open = customerRequests.filter(r => r.status === 'open').length
    const bidding = customerRequests.filter(r => r.status === 'bidding').length
    const totalBudget = customerRequests.reduce((sum, req) => 
      sum + (req.budget ? req.budget.max : 0), 0
    )
    return { total, open, bidding, totalBudget }
  }

  const stats = getRequestStats()

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading customer requests...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer Requests Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Requests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.open}</div>
              <div className="text-sm text-muted-foreground">Open</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.bidding}</div>
              <div className="text-sm text-muted-foreground">Bidding</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                ${stats.totalBudget.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Value</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Status:</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="bidding">Bidding</SelectItem>
                    <SelectItem value="awarded">Awarded</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Priority:</label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                variant="outline" 
                size="sm"
                onClick={loadCustomerRequests}
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <div className="text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No customer requests found</p>
                <p className="text-sm">Check your filters or refresh the list</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => (
            <CustomerRequestCard
              key={request.id}
              request={request}
              onBidSubmit={handleBidSubmit}
              apiUrl={apiUrl}
            />
          ))
        )}
      </div>
    </div>
  )
}