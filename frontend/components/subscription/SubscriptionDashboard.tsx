import React, { useState, useEffect } from 'react'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Badge } from '@/frontend/components/ui/badge'
import { Progress } from '@/frontend/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { ScrollArea } from '@/frontend/components/ui/scroll-area'
import { Separator } from '@/frontend/components/ui/separator'
import { 
  CreditCard, 
  TrendingUp, 
  Zap, 
  Calendar,
  DollarSign,
  Download,
  ArrowUp,
  ArrowDown,
  BarChart3,
  Clock
} from 'lucide-react'

interface TokenUsage {
  date: string
  tokensUsed: number
  toolsExecuted: number
  cost: number
}

interface SubscriptionInfo {
  plan: 'free' | 'pro' | 'enterprise'
  status: 'active' | 'cancelled' | 'past_due'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  tokensIncluded: number
  tokensUsed: number
  tokensRemaining: number
  nextBillingDate: Date
  amount: number
  currency: string
}

interface BillingHistory {
  id: string
  date: Date
  description: string
  amount: number
  currency: string
  status: 'paid' | 'pending' | 'failed'
  downloadUrl?: string
}

interface SubscriptionDashboardProps {
  subscription: SubscriptionInfo
  usage: TokenUsage[]
  billingHistory: BillingHistory[]
  onUpgrade: () => void
  onAddTokens: () => void
  onCancelSubscription: () => void
  className?: string
}

export const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({
  subscription,
  usage,
  billingHistory,
  onUpgrade,
  onAddTokens,
  onCancelSubscription,
  className = ''
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'pro':
        return 'bg-blue-100 text-blue-800'
      case 'enterprise':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'past_due':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const tokenUsagePercentage = (subscription.tokensUsed / subscription.tokensIncluded) * 100
  const isLowTokens = tokenUsagePercentage > 80

  const filteredUsage = usage.filter(item => {
    const itemDate = new Date(item.date)
    const now = new Date()
    const daysAgo = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90
    const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    return itemDate >= cutoffDate
  })

  const totalTokensUsed = filteredUsage.reduce((sum, item) => sum + item.tokensUsed, 0)
  const totalToolsExecuted = filteredUsage.reduce((sum, item) => sum + item.toolsExecuted, 0)
  const totalCost = filteredUsage.reduce((sum, item) => sum + item.cost, 0)

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const daysUntilBilling = Math.ceil(
    (subscription.nextBillingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Subscription Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <CardTitle>Subscription Overview</CardTitle>
            </div>
            <div className="flex gap-2">
              <Badge className={getPlanBadgeColor(subscription.plan)}>
                {subscription.plan.toUpperCase()}
              </Badge>
              <Badge className={getStatusBadgeColor(subscription.status)}>
                {subscription.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Token Usage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Token Usage</span>
              <span className="text-sm text-muted-foreground">
                {subscription.tokensUsed.toLocaleString()} / {subscription.tokensIncluded.toLocaleString()}
              </span>
            </div>
            <Progress 
              value={tokenUsagePercentage} 
              className={`h-2 ${isLowTokens ? 'bg-red-100' : ''}`}
            />
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>{subscription.tokensRemaining.toLocaleString()} remaining</span>
              <span>{tokenUsagePercentage.toFixed(1)}% used</span>
            </div>
            {isLowTokens && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                ⚠️ Low token balance. Consider adding more tokens or upgrading your plan.
              </div>
            )}
          </div>

          {/* Billing Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Period</p>
              <p className="font-medium">
                {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next Billing</p>
              <p className="font-medium">
                {formatDate(subscription.nextBillingDate)} ({daysUntilBilling} days)
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plan Price</p>
              <p className="font-medium">
                {formatCurrency(subscription.amount, subscription.currency)}/month
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium capitalize">
                {subscription.status.replace('_', ' ')}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={onAddTokens} variant="outline">
              <Zap className="h-4 w-4 mr-2" />
              Add Tokens
            </Button>
            {subscription.plan === 'free' && (
              <Button onClick={onUpgrade}>
                <ArrowUp className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            )}
            {subscription.status === 'active' && (
              <Button variant="outline" onClick={onCancelSubscription}>
                Cancel Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Analytics */}
      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
          <TabsTrigger value="billing">Billing History</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  <CardTitle>Usage Analytics</CardTitle>
                </div>
                <div className="flex gap-1">
                  {(['7d', '30d', '90d'] as const).map(period => (
                    <Button
                      key={period}
                      variant={selectedPeriod === period ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedPeriod(period)}
                    >
                      {period}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tokens Used</p>
                      <p className="text-2xl font-bold">{totalTokensUsed.toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tools Executed</p>
                      <p className="text-2xl font-bold">{totalToolsExecuted}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Cost</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Usage Timeline */}
              <div>
                <h4 className="font-medium mb-3">Daily Usage</h4>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {filteredUsage.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{item.date}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.toolsExecuted} tools executed
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{item.tokensUsed} tokens</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.cost)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <CardTitle>Billing History</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-1">
                  {billingHistory.map((bill, index) => (
                    <div key={bill.id}>
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            bill.status === 'paid' ? 'bg-green-500' :
                            bill.status === 'pending' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`} />
                          <div>
                            <p className="font-medium">{bill.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(bill.date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="font-medium">
                              {formatCurrency(bill.amount, bill.currency)}
                            </p>
                            <Badge
                              variant={bill.status === 'paid' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {bill.status}
                            </Badge>
                          </div>
                          {bill.downloadUrl && bill.status === 'paid' && (
                            <Button variant="ghost" size="sm">
                              <Download className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {index < billingHistory.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Hook for managing subscription data
export const useSubscription = () => {
  const [subscription, setSubscription] = useState<SubscriptionInfo>({
    plan: 'pro',
    status: 'active',
    currentPeriodStart: new Date(2024, 11, 1),
    currentPeriodEnd: new Date(2024, 11, 31),
    tokensIncluded: 10000,
    tokensUsed: 7500,
    tokensRemaining: 2500,
    nextBillingDate: new Date(2024, 11, 31),
    amount: 29.99,
    currency: 'USD'
  })

  const [usage, setUsage] = useState<TokenUsage[]>([])
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([])

  // Generate sample usage data
  useEffect(() => {
    const generateUsage = () => {
      const data: TokenUsage[] = []
      for (let i = 30; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        data.push({
          date: date.toISOString().split('T')[0],
          tokensUsed: Math.floor(Math.random() * 500) + 100,
          toolsExecuted: Math.floor(Math.random() * 20) + 5,
          cost: Math.random() * 10 + 2
        })
      }
      setUsage(data)
    }

    const generateBillingHistory = () => {
      const bills: BillingHistory[] = [
        {
          id: '1',
          date: new Date(2024, 10, 1),
          description: 'Pro Plan - November 2024',
          amount: 29.99,
          currency: 'USD',
          status: 'paid',
          downloadUrl: '/invoice/1'
        },
        {
          id: '2',
          date: new Date(2024, 9, 1),
          description: 'Pro Plan - October 2024',
          amount: 29.99,
          currency: 'USD',
          status: 'paid',
          downloadUrl: '/invoice/2'
        },
        {
          id: '3',
          date: new Date(2024, 8, 1),
          description: 'Additional Tokens - 5000',
          amount: 15.00,
          currency: 'USD',
          status: 'paid',
          downloadUrl: '/invoice/3'
        }
      ]
      setBillingHistory(bills)
    }

    generateUsage()
    generateBillingHistory()
  }, [])

  const addTokens = (amount: number) => {
    setSubscription(prev => ({
      ...prev,
      tokensIncluded: prev.tokensIncluded + amount,
      tokensRemaining: prev.tokensRemaining + amount
    }))
  }

  const upgradePlan = (newPlan: 'pro' | 'enterprise') => {
    setSubscription(prev => ({
      ...prev,
      plan: newPlan,
      amount: newPlan === 'pro' ? 29.99 : 99.99,
      tokensIncluded: newPlan === 'pro' ? 10000 : 50000
    }))
  }

  const cancelSubscription = () => {
    setSubscription(prev => ({
      ...prev,
      status: 'cancelled'
    }))
  }

  return {
    subscription,
    usage,
    billingHistory,
    addTokens,
    upgradePlan,
    cancelSubscription
  }
}