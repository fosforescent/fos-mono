import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VoiceNote } from '../voice/VoiceNote'
import { 
  User, 
  MessageSquare, 
  Clock, 
  DollarSign, 
  MapPin, 
  Tag,
  Send,
  Info,
  Calendar
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

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

interface CustomerRequestCardProps {
  request: CustomerRequest
  onBidSubmit?: (bid: ServiceBid) => void
  apiUrl?: string
  className?: string
}

interface ServiceBid {
  requestId: string
  providerId: string
  proposal: string
  timeline: {
    startDate: Date
    estimatedCompletion: Date
  }
  pricing: {
    totalCost: number
    breakdown: string[]
  }
  bidType: 'service' | 'adhoc'
  isAdHoc: boolean
}

export const CustomerRequestCard: React.FC<CustomerRequestCardProps> = ({
  request,
  onBidSubmit,
  apiUrl = '/api',
  className = ''
}) => {
  const [isSubmittingBid, setIsSubmittingBid] = useState(false)
  const [bidDialogOpen, setBidDialogOpen] = useState(false)
  const [bidForm, setBidForm] = useState({
    proposal: '',
    totalCost: '',
    timelineWeeks: '',
    breakdown: '',
    bidType: 'service' as 'service' | 'adhoc'
  })
  const { toast } = useToast()

  const handleBidSubmit = async () => {
    if (!bidForm.proposal.trim() || !bidForm.totalCost) {
      toast({
        title: "Invalid Bid",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    setIsSubmittingBid(true)

    try {
      const startDate = new Date()
      const estimatedCompletion = new Date()
      estimatedCompletion.setDate(startDate.getDate() + (parseInt(bidForm.timelineWeeks) * 7))

      const bid: ServiceBid = {
        requestId: request.id,
        providerId: 'current-user', // This would come from auth context
        proposal: bidForm.proposal,
        timeline: {
          startDate,
          estimatedCompletion
        },
        pricing: {
          totalCost: parseFloat(bidForm.totalCost),
          breakdown: bidForm.breakdown.split('\n').filter(line => line.trim())
        },
        bidType: bidForm.bidType,
        isAdHoc: bidForm.bidType === 'adhoc'
      }

      // Submit bid via API
      const response = await fetch(`${apiUrl}/service-bids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify(bid)
      })

      if (!response.ok) {
        throw new Error('Failed to submit bid')
      }

      onBidSubmit?.(bid)
      setBidDialogOpen(false)
      setBidForm({ proposal: '', totalCost: '', timelineWeeks: '', breakdown: '', bidType: 'service' })

      toast({
        title: bidForm.bidType === 'adhoc' ? "Custom Bid Submitted" : "Service Bid Submitted",
        description: bidForm.bidType === 'adhoc' 
          ? "Your custom bid has been sent to the customer"
          : "Your service bid has been sent to the customer",
      })

    } catch (error) {
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit bid",
        variant: "destructive"
      })
    } finally {
      setIsSubmittingBid(false)
    }
  }

  const formatBudget = (budget: { min: number, max: number }) => {
    if (budget.min === budget.max) {
      return `$${budget.min.toLocaleString()}`
    }
    return `$${budget.min.toLocaleString()} - $${budget.max.toLocaleString()}`
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800'
      case 'bidding': return 'bg-orange-100 text-orange-800'
      case 'awarded': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className={`hover:shadow-md transition-shadow ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg line-clamp-2">{request.title}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{request.customerName}</span>
              <Clock className="h-3 w-3 ml-2" />
              <span>{new Date(request.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Badge className={getPriorityColor(request.priority)}>
              {request.priority}
            </Badge>
            <Badge variant="outline" className={getStatusColor(request.status)}>
              {request.status}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <div>
          <p className="text-sm text-gray-700 line-clamp-3">
            {request.description}
          </p>
        </div>

        {/* Voice Notes - CRITICAL */}
        {request.voiceNotes && request.voiceNotes.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Voice Notes from Customer
            </Label>
            {request.voiceNotes.map(voiceNote => (
              <VoiceNote
                key={voiceNote.id}
                audioUrl={voiceNote.audioFileUrl}
                duration={voiceNote.duration}
                transcription={voiceNote.transcription}
                showTranscription={true}
                className="border-none bg-blue-50"
              />
            ))}
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {request.budget && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="font-medium">{formatBudget(request.budget)}</span>
            </div>
          )}

          {request.deadline && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-600" />
              <span>{new Date(request.deadline).toLocaleDateString()}</span>
            </div>
          )}

          {request.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span className="line-clamp-1">{request.location}</span>
            </div>
          )}

          {request.category.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-purple-600" />
              <span className="line-clamp-1">{request.category.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Categories */}
        {request.category.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {request.category.slice(0, 3).map((cat, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {cat}
              </Badge>
            ))}
            {request.category.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{request.category.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-4 flex gap-2">
        <Dialog open={bidDialogOpen} onOpenChange={setBidDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex-1">
              <Send className="h-4 w-4 mr-2" />
              Submit Bid
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Submit Bid for "{request.title}"</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="bidType">Bid Type</Label>
                <Select value={bidForm.bidType} onValueChange={(value: 'service' | 'adhoc') => setBidForm(prev => ({ ...prev, bidType: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">📋 Service Bid - Based on existing service offering</SelectItem>
                    <SelectItem value="adhoc">⚡ Ad-hoc Bid - Custom solution for this request</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground mt-1">
                  {bidForm.bidType === 'service' 
                    ? "This will be associated with one of your existing services"
                    : "This is a custom bid specifically for this customer request"
                  }
                </div>
              </div>

              <div>
                <Label htmlFor="proposal">
                  {bidForm.bidType === 'adhoc' ? 'Custom Proposal' : 'Service Proposal'}
                </Label>
                <Textarea
                  id="proposal"
                  placeholder={bidForm.bidType === 'adhoc' 
                    ? "Describe your custom solution and approach for this specific request..."
                    : "Describe how your service matches this request and why you're the right fit..."
                  }
                  value={bidForm.proposal}
                  onChange={(e) => setBidForm(prev => ({ ...prev, proposal: e.target.value }))}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="totalCost">
                    {bidForm.bidType === 'adhoc' ? 'Custom Price ($)' : 'Total Cost ($)'}
                  </Label>
                  <Input
                    id="totalCost"
                    type="number"
                    placeholder={bidForm.bidType === 'adhoc' ? "Custom quote" : "5000"}
                    value={bidForm.totalCost}
                    onChange={(e) => setBidForm(prev => ({ ...prev, totalCost: e.target.value }))}
                  />
                  {bidForm.bidType === 'adhoc' && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Price specifically tailored for this customer's needs
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="timeline">
                    {bidForm.bidType === 'adhoc' ? 'Custom Timeline (weeks)' : 'Timeline (weeks)'}
                  </Label>
                  <Input
                    id="timeline"
                    type="number"
                    placeholder={bidForm.bidType === 'adhoc' ? "Custom timeframe" : "4"}
                    value={bidForm.timelineWeeks}
                    onChange={(e) => setBidForm(prev => ({ ...prev, timelineWeeks: e.target.value }))}
                  />
                  {bidForm.bidType === 'adhoc' && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Timeline optimized for this specific project
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="breakdown">
                  {bidForm.bidType === 'adhoc' ? 'Custom Cost Breakdown (optional)' : 'Cost Breakdown (optional)'}
                </Label>
                <Textarea
                  id="breakdown"
                  placeholder={bidForm.bidType === 'adhoc' 
                    ? "Custom Research: $X&#10;Custom Development: $Y&#10;Custom Testing: $Z"
                    : "Design: $1500&#10;Development: $3000&#10;Testing: $500"
                  }
                  value={bidForm.breakdown}
                  onChange={(e) => setBidForm(prev => ({ ...prev, breakdown: e.target.value }))}
                  rows={3}
                />
                {bidForm.bidType === 'adhoc' && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Breakdown of custom work required for this specific request
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleBidSubmit}
                  disabled={isSubmittingBid}
                  className="flex-1"
                >
                  {isSubmittingBid ? 'Submitting...' : 
                    bidForm.bidType === 'adhoc' ? 'Submit Custom Bid' : 'Submit Service Bid'
                  }
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBidDialogOpen(false)}
                  disabled={isSubmittingBid}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button variant="outline" size="sm">
          <Info className="h-4 w-4 mr-2" />
          More Details
        </Button>
      </CardFooter>
    </Card>
  )
}