import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Settings, 
  DollarSign, 
  Clock, 
  Star,
  TrendingUp,
  Users,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface Service {
  id: string
  name: string
  description: string
  category: string[]
  pricing: {
    type: 'fixed' | 'hourly' | 'project'
    amount: number
    currency: string
  }
  timeline: {
    min: number
    max: number
    unit: 'hours' | 'days' | 'weeks'
  }
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  tags: string[]
}

interface ServiceBid {
  id: string
  serviceId?: string // Optional for ad-hoc bids
  requestId: string
  customerName: string
  requestTitle: string
  bidAmount: number
  timeline: string
  status: 'pending' | 'accepted' | 'rejected' | 'completed'
  submittedAt: Date
  proposal: string
  bidType: 'service' | 'adhoc'
  isAdHoc: boolean
}

interface ServiceManagementProps {
  apiUrl?: string
  className?: string
}

export const ServiceManagement: React.FC<ServiceManagementProps> = ({
  apiUrl = '/api',
  className = ''
}) => {
  const [services, setServices] = useState<Service[]>([])
  const [bids, setBids] = useState<ServiceBid[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [activeTab, setActiveTab] = useState('services')
  const { toast } = useToast()

  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    category: '',
    pricingType: 'project' as 'fixed' | 'hourly' | 'project',
    pricingAmount: '',
    timelineMin: '',
    timelineMax: '',
    timelineUnit: 'weeks' as 'hours' | 'days' | 'weeks',
    tags: ''
  })

  useEffect(() => {
    loadServices()
    loadBids()
  }, [])

  const loadServices = async () => {
    setIsLoading(true)
    try {
      // Mock services for now - in real implementation, fetch from API
      const mockServices: Service[] = [
        {
          id: 'svc-1',
          name: 'Website Development',
          description: 'Custom website development using modern technologies like React, Next.js, and Tailwind CSS',
          category: ['web-development', 'frontend', 'fullstack'],
          pricing: { type: 'project', amount: 5000, currency: 'USD' },
          timeline: { min: 2, max: 6, unit: 'weeks' },
          isActive: true,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          tags: ['react', 'nextjs', 'tailwind', 'responsive']
        },
        {
          id: 'svc-2',
          name: 'Mobile App Development',
          description: 'Native and cross-platform mobile app development for iOS and Android',
          category: ['mobile-development', 'react-native', 'flutter'],
          pricing: { type: 'project', amount: 15000, currency: 'USD' },
          timeline: { min: 8, max: 16, unit: 'weeks' },
          isActive: true,
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          tags: ['react-native', 'ios', 'android', 'mobile-ui']
        },
        {
          id: 'svc-3',
          name: 'UI/UX Design',
          description: 'Complete UI/UX design services from wireframing to high-fidelity prototypes',
          category: ['design', 'ui-ux', 'prototyping'],
          pricing: { type: 'hourly', amount: 85, currency: 'USD' },
          timeline: { min: 1, max: 4, unit: 'weeks' },
          isActive: false,
          createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
          tags: ['figma', 'sketch', 'prototyping', 'user-research']
        }
      ]
      setServices(mockServices)
    } catch (error) {
      console.error('Failed to load services:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadBids = async () => {
    try {
      // Mock bids for now - in real implementation, fetch from API
      const mockBids: ServiceBid[] = [
        {
          id: 'bid-1',
          serviceId: 'svc-1',
          requestId: 'req-1',
          customerName: 'Sarah Johnson',
          requestTitle: 'Website Redesign for Local Restaurant',
          bidAmount: 6500,
          timeline: '4 weeks',
          status: 'pending',
          submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          proposal: 'I can deliver a modern, responsive website that will perfectly showcase your restaurant menu and enable online reservations.',
          bidType: 'service',
          isAdHoc: false
        },
        {
          id: 'bid-2',
          serviceId: 'svc-2',
          requestId: 'req-2',
          customerName: 'Mark Chen',
          requestTitle: 'Mobile App Development for Fitness Tracking',
          bidAmount: 18000,
          timeline: '12 weeks',
          status: 'accepted',
          submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          proposal: 'I have extensive experience building fitness apps with React Native. I can deliver all the features you need with a clean, intuitive interface.',
          bidType: 'service',
          isAdHoc: false
        },
        {
          id: 'bid-3',
          requestId: 'req-3',
          customerName: 'Jennifer Liu',
          requestTitle: 'Logo Design for Tech Startup',
          bidAmount: 1200,
          timeline: '2 weeks',
          status: 'pending',
          submittedAt: new Date(Date.now() - 30 * 60 * 1000),
          proposal: 'I can create a custom logo specifically for your AI startup that captures innovation and trust. This will be a completely custom design process tailored to your brand vision.',
          bidType: 'adhoc',
          isAdHoc: true
        }
      ]
      setBids(mockBids)
    } catch (error) {
      console.error('Failed to load bids:', error)
    }
  }

  const handleCreateService = async () => {
    try {
      const newService: Service = {
        id: `svc-${Date.now()}`,
        name: serviceForm.name,
        description: serviceForm.description,
        category: serviceForm.category.split(',').map(c => c.trim()),
        pricing: {
          type: serviceForm.pricingType,
          amount: parseFloat(serviceForm.pricingAmount),
          currency: 'USD'
        },
        timeline: {
          min: parseInt(serviceForm.timelineMin),
          max: parseInt(serviceForm.timelineMax),
          unit: serviceForm.timelineUnit
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: serviceForm.tags.split(',').map(t => t.trim())
      }

      setServices(prev => [...prev, newService])
      setShowCreateDialog(false)
      resetForm()

      toast({
        title: "Service Created",
        description: "Your new service has been added successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create service",
        variant: "destructive"
      })
    }
  }

  const handleUpdateService = async (service: Service) => {
    try {
      const updatedService = { ...service, updatedAt: new Date() }
      setServices(prev => prev.map(s => s.id === service.id ? updatedService : s))
      setEditingService(null)

      toast({
        title: "Service Updated",
        description: "Service has been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update service",
        variant: "destructive"
      })
    }
  }

  const handleDeleteService = async (serviceId: string) => {
    try {
      setServices(prev => prev.filter(s => s.id !== serviceId))
      toast({
        title: "Service Deleted",
        description: "Service has been removed successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive"
      })
    }
  }

  const toggleServiceStatus = async (serviceId: string) => {
    try {
      setServices(prev => prev.map(s => 
        s.id === serviceId 
          ? { ...s, isActive: !s.isActive, updatedAt: new Date() }
          : s
      ))
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update service status",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setServiceForm({
      name: '',
      description: '',
      category: '',
      pricingType: 'project',
      pricingAmount: '',
      timelineMin: '',
      timelineMax: '',
      timelineUnit: 'weeks',
      tags: ''
    })
  }

  const getBidStatusColor = (status: ServiceBid['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'accepted': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
    }
  }

  const getBidStatusIcon = (status: ServiceBid['status']) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />
      case 'accepted': return <CheckCircle className="h-4 w-4" />
      case 'rejected': return <AlertCircle className="h-4 w-4" />
      case 'completed': return <Star className="h-4 w-4" />
    }
  }

  const formatPricing = (pricing: Service['pricing']) => {
    const symbol = pricing.currency === 'USD' ? '$' : pricing.currency
    if (pricing.type === 'hourly') {
      return `${symbol}${pricing.amount}/hour`
    }
    return `${symbol}${pricing.amount.toLocaleString()}`
  }

  const formatTimeline = (timeline: Service['timeline']) => {
    const range = timeline.min === timeline.max 
      ? `${timeline.min}` 
      : `${timeline.min}-${timeline.max}`
    return `${range} ${timeline.unit}`
  }

  const getServiceStats = () => {
    const activeServices = services.filter(s => s.isActive).length
    const totalBids = bids.length
    const acceptedBids = bids.filter(b => b.status === 'accepted').length
    const pendingBids = bids.filter(b => b.status === 'pending').length
    return { activeServices, totalBids, acceptedBids, pendingBids }
  }

  const stats = getServiceStats()

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stats Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Service Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.activeServices}</div>
              <div className="text-sm text-muted-foreground">Active Services</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.totalBids}</div>
              <div className="text-sm text-muted-foreground">Total Bids</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.acceptedBids}</div>
              <div className="text-sm text-muted-foreground">Accepted</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.pendingBids}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="services">My Services</TabsTrigger>
          <TabsTrigger value="bids">My Bids</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Service Offerings</h3>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create New Service</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Service Name</Label>
                    <Input
                      id="name"
                      value={serviceForm.name}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Website Development"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={serviceForm.description}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what this service includes..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category">Categories (comma-separated)</Label>
                      <Input
                        id="category"
                        value={serviceForm.category}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, category: e.target.value }))}
                        placeholder="web-development, frontend"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tags">Tags (comma-separated)</Label>
                      <Input
                        id="tags"
                        value={serviceForm.tags}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, tags: e.target.value }))}
                        placeholder="react, nextjs, tailwind"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="pricingType">Pricing Type</Label>
                      <Select value={serviceForm.pricingType} onValueChange={(value: any) => setServiceForm(prev => ({ ...prev, pricingType: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="project">Per Project</SelectItem>
                          <SelectItem value="hourly">Per Hour</SelectItem>
                          <SelectItem value="fixed">Fixed Price</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="pricingAmount">Amount ($)</Label>
                      <Input
                        id="pricingAmount"
                        type="number"
                        value={serviceForm.pricingAmount}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, pricingAmount: e.target.value }))}
                        placeholder="5000"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="timelineMin">Min Timeline</Label>
                      <Input
                        id="timelineMin"
                        type="number"
                        value={serviceForm.timelineMin}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, timelineMin: e.target.value }))}
                        placeholder="2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="timelineMax">Max Timeline</Label>
                      <Input
                        id="timelineMax"
                        type="number"
                        value={serviceForm.timelineMax}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, timelineMax: e.target.value }))}
                        placeholder="6"
                      />
                    </div>
                    <div>
                      <Label htmlFor="timelineUnit">Unit</Label>
                      <Select value={serviceForm.timelineUnit} onValueChange={(value: any) => setServiceForm(prev => ({ ...prev, timelineUnit: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                          <SelectItem value="weeks">Weeks</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleCreateService} className="flex-1">
                      Create Service
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {services.map((service) => (
              <Card key={service.id} className={`${!service.isActive ? 'opacity-60' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg">{service.name}</h4>
                        <Badge variant={service.isActive ? 'default' : 'secondary'}>
                          {service.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mb-3">{service.description}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {formatPricing(service.pricing)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatTimeline(service.timeline)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {service.category.map((cat, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {cat}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {service.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleServiceStatus(service.id)}
                      >
                        {service.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingService(service)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteService(service.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="bids" className="space-y-4">
          <h3 className="text-lg font-semibold">Bid History</h3>
          
          <div className="grid gap-4">
            {bids.map((bid) => (
              <Card key={bid.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{bid.requestTitle}</h4>
                        <Badge className={getBidStatusColor(bid.status)}>
                          <div className="flex items-center gap-1">
                            {getBidStatusIcon(bid.status)}
                            {bid.status}
                          </div>
                        </Badge>
                        <Badge variant={bid.isAdHoc ? 'secondary' : 'outline'} className="text-xs">
                          {bid.isAdHoc ? '⚡ Ad-hoc' : '📋 Service'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {bid.customerName}
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          ${bid.bidAmount.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {bid.timeline}
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">{bid.proposal}</p>
                      
                      <div className="text-xs text-muted-foreground">
                        Submitted {bid.submittedAt.toLocaleDateString()} at {bid.submittedAt.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}