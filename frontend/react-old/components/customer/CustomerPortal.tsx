import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ConsoleAgent } from '../console/ConsoleAgent'
import { MessageSquare, User, ArrowRight, CheckCircle, Clock, Briefcase } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface CustomerPortalProps {
  isAnonymous?: boolean
  data?: any
  setData?: (data: any) => void
  options?: any
  apiUrl?: string
}

interface ServiceRequest {
  id: string
  title: string
  description: string
  status: 'draft' | 'published' | 'bidding' | 'awarded' | 'completed'
  budget?: { min: number, max: number }
  createdAt: Date
  bidsCount: number
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  isAnonymous = false,
  data,
  setData,
  options,
  apiUrl = '/api'
}) => {
  const [activeRequests, setActiveRequests] = useState<ServiceRequest[]>([])
  const { toast } = useToast()

  const handleServiceRequestGenerated = (request: any) => {
    // Handle the generated service request
    console.log('Service request generated:', request)
    
    const newRequest: ServiceRequest = {
      id: Date.now().toString(),
      title: request.title || 'Service Request',
      description: request.description,
      status: 'draft',
      budget: request.budget,
      createdAt: new Date(),
      bidsCount: 0
    }
    
    setActiveRequests(prev => [...prev, newRequest])
    
    toast({
      title: "Service Request Created",
      description: "Your request has been generated. Review and submit it to providers.",
    })
  }

  const getStatusIcon = (status: ServiceRequest['status']) => {
    switch (status) {
      case 'draft': return <Clock className="h-4 w-4 text-gray-500" />
      case 'published': return <MessageSquare className="h-4 w-4 text-blue-500" />
      case 'bidding': return <Briefcase className="h-4 w-4 text-orange-500" />
      case 'awarded': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />
    }
  }

  const getStatusColor = (status: ServiceRequest['status']) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700'
      case 'published': return 'bg-blue-100 text-blue-700'
      case 'bidding': return 'bg-orange-100 text-orange-700'
      case 'awarded': return 'bg-green-100 text-green-700'
      case 'completed': return 'bg-green-100 text-green-800'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">Service Marketplace</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Describe your project needs and get matched with qualified service providers. 
            Use voice or text to explain what you're looking for.
          </p>
          
          {isAnonymous && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-yellow-600" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800">Anonymous Session</p>
                  <p className="text-yellow-700">Create an account to save your requests</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Request Interface */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  Describe Your Project
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ConsoleAgent
                  consoleMode="customer_request"
                  uiVariant="customer"
                  onServiceRequestGenerated={handleServiceRequestGenerated}
                  welcomeMessage="Hi! I'm here to help you find the right service provider. You can speak or type to describe what you need."
                  enableVoiceInput={true}
                  apiUrl={apiUrl}
                  defaultMode="confirm"
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Active Requests</span>
                  <Badge variant="outline">{activeRequests.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Bids</span>
                  <Badge variant="outline">
                    {activeRequests.reduce((sum, req) => sum + req.bidsCount, 0)}
                  </Badge>
                </div>
                <Separator />
                <div className="text-xs text-gray-500">
                  {isAnonymous 
                    ? "Sign up to track your requests across sessions"
                    : "Your requests are automatically saved"
                  }
                </div>
              </CardContent>
            </Card>

            {/* Recent Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {activeRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No requests yet</p>
                    <p className="text-xs">Describe your project to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeRequests.slice(-3).map((request) => (
                      <div key={request.id} className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm line-clamp-1">{request.title}</h4>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(request.status)}
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                          {request.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getStatusColor(request.status)}`}
                          >
                            {request.status}
                          </Badge>
                          {request.bidsCount > 0 && (
                            <span className="text-xs text-gray-500">
                              {request.bidsCount} bids
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {activeRequests.length > 3 && (
                      <Button variant="ghost" size="sm" className="w-full">
                        View All Requests
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* How It Works */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How It Works</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-blue-600">1</span>
                    </div>
                    <div>
                      <h5 className="font-medium text-sm">Describe Your Project</h5>
                      <p className="text-xs text-gray-600">Tell us what you need using voice or text</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-blue-600">2</span>
                    </div>
                    <div>
                      <h5 className="font-medium text-sm">Get Matched</h5>
                      <p className="text-xs text-gray-600">AI matches you with qualified providers</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-blue-600">3</span>
                    </div>
                    <div>
                      <h5 className="font-medium text-sm">Review & Choose</h5>
                      <p className="text-xs text-gray-600">Compare bids and select the best fit</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}