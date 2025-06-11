import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Coins, 
  TrendingUp, 
  TrendingDown,
  ShoppingCart, 
  History, 
  Plus, 
  Download,
  Filter,
  RefreshCw,
  CreditCard,
  Zap
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface TokenBalance {
  availableTokens: number
  totalPurchased: number
  totalUsed: number
  subscriptionTokens: number
  purchasedTokens: number
  lastResetAt?: Date
}

interface TokenTransaction {
  id: number
  transactionId: string
  type: 'debit' | 'credit' | 'subscription_grant' | 'purchase'
  amount: number
  description: string
  balanceBefore: number
  balanceAfter: number
  metadata: any
  stripePaymentIntentId?: string
  createdAt: Date
  toolUse?: {
    toolName: string
    serverId: number
  }
}

interface TokenPurchase {
  id: number
  purchaseId: string
  tokenAmount: number
  priceInCents: number
  pricePerTokenCents: number
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  stripePaymentIntentId: string
  stripeCheckoutSessionId?: string
  processedAt?: Date
  createdAt: Date
}

interface TokenManagementProps {
  apiUrl?: string
  onPurchaseTokens?: (amount: number, pricePerToken: number) => void
  className?: string
}

export const TokenManagement: React.FC<TokenManagementProps> = ({
  apiUrl = '/api',
  onPurchaseTokens,
  className = ''
}) => {
  const [balance, setBalance] = useState<TokenBalance | null>(null)
  const [transactions, setTransactions] = useState<TokenTransaction[]>([])
  const [purchases, setPurchases] = useState<TokenPurchase[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'debit' | 'credit'>('all')
  const [purchaseAmount, setPurchaseAmount] = useState(1000)
  const [pricePerToken, setPricePerToken] = useState(0.01)
  const { toast } = useToast()

  // Pagination
  const [transactionPage, setTransactionPage] = useState(0)
  const [purchasePage, setPurchasePage] = useState(0)
  const PAGE_SIZE = 20

  useEffect(() => {
    loadTokenBalance()
    loadTransactions()
    loadPurchases()
  }, [])

  const loadTokenBalance = async () => {
    try {
      const response = await fetch(`${apiUrl}/tokens/balance`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to load token balance')
      
      const data = await response.json()
      setBalance(data.balance)
    } catch (error) {
      console.error('Error loading token balance:', error)
      toast({
        title: "Error",
        description: "Failed to load token balance",
        variant: "destructive"
      })
    }
  }

  const loadTransactions = async (offset = 0, type?: string) => {
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: offset.toString()
      })
      if (type && type !== 'all') params.append('type', type)

      const response = await fetch(`${apiUrl}/tokens/transactions?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to load transactions')
      
      const data = await response.json()
      
      if (offset === 0) {
        setTransactions(data.transactions)
      } else {
        setTransactions(prev => [...prev, ...data.transactions])
      }
    } catch (error) {
      console.error('Error loading transactions:', error)
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive"
      })
    }
  }

  const loadPurchases = async (offset = 0) => {
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: offset.toString()
      })

      const response = await fetch(`${apiUrl}/tokens/purchases?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to load purchases')
      
      const data = await response.json()
      
      if (offset === 0) {
        setPurchases(data.purchases)
      } else {
        setPurchases(prev => [...prev, ...data.purchases])
      }
    } catch (error) {
      console.error('Error loading purchases:', error)
      toast({
        title: "Error",
        description: "Failed to load purchases",
        variant: "destructive"
      })
    }
  }

  const handlePurchaseTokens = async () => {
    if (purchaseAmount <= 0 || pricePerToken <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter valid amounts",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/tokens/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify({
          tokenAmount: purchaseAmount,
          pricePerTokenCents: Math.round(pricePerToken * 100)
        })
      })

      if (!response.ok) throw new Error('Failed to create purchase')

      const data = await response.json()
      
      // Redirect to Stripe checkout
      window.location.href = data.checkoutUrl
      
    } catch (error) {
      console.error('Error creating token purchase:', error)
      toast({
        title: "Error",
        description: "Failed to create token purchase",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFilterChange = (newFilter: 'all' | 'debit' | 'credit') => {
    setTransactionFilter(newFilter)
    setTransactionPage(0)
    loadTransactions(0, newFilter === 'all' ? undefined : newFilter)
  }

  const handleRefresh = () => {
    loadTokenBalance()
    loadTransactions(0, transactionFilter === 'all' ? undefined : transactionFilter)
    loadPurchases(0)
    setTransactionPage(0)
    setPurchasePage(0)
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100)
  }

  const formatTokenAmount = (amount: number) => {
    return amount.toLocaleString()
  }

  const getTransactionIcon = (type: string, amount: number) => {
    if (amount > 0) {
      return <TrendingUp className="h-4 w-4 text-green-500" />
    } else {
      return <TrendingDown className="h-4 w-4 text-red-500" />
    }
  }

  const getTransactionBadgeColor = (type: string) => {
    switch (type) {
      case 'credit':
      case 'subscription_grant':
      case 'purchase':
        return 'bg-green-100 text-green-800'
      case 'debit':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPurchaseStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'refunded':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Token Management</h2>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Token Balance Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Token Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balance ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded">
                <p className="text-2xl font-bold text-blue-600">
                  {formatTokenAmount(balance.availableTokens)}
                </p>
                <p className="text-sm text-muted-foreground">Available</p>
              </div>
              <div className="text-center p-4 border rounded">
                <p className="text-2xl font-bold text-green-600">
                  {formatTokenAmount(balance.totalPurchased)}
                </p>
                <p className="text-sm text-muted-foreground">Total Purchased</p>
              </div>
              <div className="text-center p-4 border rounded">
                <p className="text-2xl font-bold text-purple-600">
                  {formatTokenAmount(balance.totalUsed)}
                </p>
                <p className="text-sm text-muted-foreground">Total Used</p>
              </div>
              <div className="text-center p-4 border rounded">
                <p className="text-2xl font-bold text-orange-600">
                  {formatTokenAmount(balance.subscriptionTokens)}
                </p>
                <p className="text-sm text-muted-foreground">Subscription</p>
              </div>
            </div>
          ) : (
            <div className="text-center p-8">
              <Coins className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-muted-foreground">Loading balance...</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="purchase" className="space-y-4">
        <TabsList>
          <TabsTrigger value="purchase">Purchase Tokens</TabsTrigger>
          <TabsTrigger value="transactions">Transaction History</TabsTrigger>
          <TabsTrigger value="purchases">Purchase History</TabsTrigger>
        </TabsList>

        <TabsContent value="purchase" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Purchase Tokens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tokenAmount">Token Amount</Label>
                  <Input
                    id="tokenAmount"
                    type="number"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(parseInt(e.target.value) || 0)}
                    min={1}
                    placeholder="1000"
                  />
                </div>
                <div>
                  <Label htmlFor="pricePerToken">Price per Token (USD)</Label>
                  <Input
                    id="pricePerToken"
                    type="number"
                    step="0.001"
                    value={pricePerToken}
                    onChange={(e) => setPricePerToken(parseFloat(e.target.value) || 0)}
                    min={0.001}
                    placeholder="0.01"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-muted rounded">
                <div className="flex justify-between items-center">
                  <span>Total Cost:</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(purchaseAmount * pricePerToken * 100)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Tokens:</span>
                  <span>{formatTokenAmount(purchaseAmount)}</span>
                </div>
              </div>

              <Button 
                onClick={handlePurchaseTokens} 
                disabled={isLoading || purchaseAmount <= 0 || pricePerToken <= 0}
                className="w-full"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {isLoading ? 'Processing...' : 'Purchase with Stripe'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Transaction History
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={transactionFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFilterChange('all')}
                  >
                    All
                  </Button>
                  <Button
                    variant={transactionFilter === 'credit' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFilterChange('credit')}
                  >
                    Credits
                  </Button>
                  <Button
                    variant={transactionFilter === 'debit' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFilterChange('debit')}
                  >
                    Debits
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No transactions found</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {transactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          {getTransactionIcon(transaction.type, transaction.amount)}
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(transaction.createdAt).toLocaleDateString()}
                            </p>
                            {transaction.toolUse && (
                              <p className="text-xs text-muted-foreground">
                                Tool: {transaction.toolUse.toolName}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${
                              transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.amount > 0 ? '+' : ''}{formatTokenAmount(transaction.amount)}
                            </span>
                            <Badge className={getTransactionBadgeColor(transaction.type)}>
                              {transaction.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Balance: {formatTokenAmount(transaction.balanceAfter)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Purchase History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {purchases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No purchases found</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {purchases.map((purchase) => (
                      <div key={purchase.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">
                            {formatTokenAmount(purchase.tokenAmount)} tokens
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(purchase.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ID: {purchase.purchaseId}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(purchase.priceInCents)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(purchase.pricePerTokenCents)} per token
                          </p>
                          <Badge className={getPurchaseStatusColor(purchase.status)}>
                            {purchase.status}
                          </Badge>
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

// Hook for managing token data
export const useTokenManagement = () => {
  const [balance, setBalance] = useState<TokenBalance | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refreshBalance = async (apiUrl = '/api') => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/tokens/balance`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setBalance(data.balance)
      }
    } catch (error) {
      console.error('Error refreshing token balance:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshBalance()
  }, [])

  return {
    balance,
    isLoading,
    refreshBalance
  }
}