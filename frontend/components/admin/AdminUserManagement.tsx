import React, { useState, useEffect } from 'react'
import { Button } from '@/frontend/components/ui/button'
import { Input } from '@/frontend/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Badge } from '@/frontend/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { ScrollArea } from '@/frontend/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/frontend/components/ui/dialog'
import { Label } from '@/frontend/components/ui/label'
import { 
  Users, 
  UserCheck, 
  UserX, 
  Crown, 
  Shield, 
  Clock,
  Search,
  Filter,
  Plus,
  Edit,
  Mail,
  Calendar,
  Activity,
  DollarSign,
  Zap
} from 'lucide-react'
import { useToast } from '@/frontend/components/ui/use-toast'

interface User {
  id: number
  user_name: string
  email?: string
  approved: boolean
  role: 'user' | 'admin' | 'superadmin'
  createdAt: Date
  updatedAt: Date
  stripe_customer_id?: string
  subscription_status: string
  tokenBalance?: {
    availableTokens: number
    totalPurchased: number
    totalUsed: number
  }
  lastLogin?: Date
  apiCallsUsed: number
  apiCallsAvailable: number
}

interface UserStats {
  totalUsers: number
  pendingApproval: number
  approvedUsers: number
  adminUsers: number
  activeUsers: number
}

interface AdminUserManagementProps {
  apiUrl?: string
  className?: string
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({
  apiUrl = '/api',
  className = ''
}) => {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'admin'>('all')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [tokenCreditAmount, setTokenCreditAmount] = useState(1000)
  
  const { toast } = useToast()
  const PAGE_SIZE = 20

  useEffect(() => {
    loadUsers(true)
    loadStats()
  }, [searchQuery, statusFilter])

  const loadUsers = async (reset = false) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: (reset ? 0 : page * PAGE_SIZE).toString()
      })

      if (searchQuery) params.append('search', searchQuery)
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const response = await fetch(`${apiUrl}/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) throw new Error('Failed to load users')

      const data = await response.json()
      
      if (reset) {
        setUsers(data.users || [])
        setPage(0)
      } else {
        setUsers(prev => [...prev, ...(data.users || [])])
      }
      
      setHasMore(data.pagination?.hasMore || false)
    } catch (error) {
      console.error('Error loading users:', error)
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch(`${apiUrl}/admin/users/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  const handleApproveUser = async (userId: number, userName: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) throw new Error('Failed to approve user')

      toast({
        title: "Success",
        description: `User ${userName} has been approved`
      })

      loadUsers(true)
      loadStats()
    } catch (error) {
      console.error('Error approving user:', error)
      toast({
        title: "Error",
        description: "Failed to approve user",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRejectUser = async (userId: number, userName: string) => {
    if (!confirm(`Are you sure you want to reject user "${userName}"? This will delete their account.`)) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/admin/users/${userId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (!response.ok) throw new Error('Failed to reject user')

      toast({
        title: "Success",
        description: `User ${userName} has been rejected and deleted`
      })

      loadUsers(true)
      loadStats()
    } catch (error) {
      console.error('Error rejecting user:', error)
      toast({
        title: "Error",
        description: "Failed to reject user",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateUserRole = async (userId: number, newRole: string, userName: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify({ role: newRole })
      })

      if (!response.ok) throw new Error('Failed to update user role')

      toast({
        title: "Success",
        description: `User ${userName} role updated to ${newRole}`
      })

      loadUsers(true)
      loadStats()
    } catch (error) {
      console.error('Error updating user role:', error)
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreditTokens = async (userId: number, amount: number, userName: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/admin/tokens/credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify({
          userId,
          amount,
          description: `Admin credit: ${amount} tokens`
        })
      })

      if (!response.ok) throw new Error('Failed to credit tokens')

      toast({
        title: "Success",
        description: `Credited ${amount} tokens to ${userName}`
      })

      loadUsers(true)
    } catch (error) {
      console.error('Error crediting tokens:', error)
      toast({
        title: "Error",
        description: "Failed to credit tokens",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadMore = () => {
    setPage(prev => prev + 1)
    loadUsers(false)
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString()
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-purple-100 text-purple-800'
      case 'admin':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadgeColor = (approved: boolean) => {
    return approved 
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800'
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'superadmin':
        return <Crown className="h-4 w-4" />
      case 'admin':
        return <Shield className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Button onClick={() => loadUsers(true)} variant="outline" size="sm">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pendingApproval}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{stats.approvedUsers}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold">{stats.adminUsers}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{stats.activeUsers}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">All Users</TabsTrigger>
          <TabsTrigger value="pending">Pending Approval</TabsTrigger>
          <TabsTrigger value="admins">Administrators</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="search">Search Users</Label>
                  <Input
                    id="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by username or email..."
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="pending">Pending Approval</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="admin">Administrators</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Users ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No users found</p>
                </div>
              ) : (
                <>
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {users.map((user) => (
                        <div key={user.id} className="p-4 border rounded">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                {getRoleIcon(user.role)}
                                <h3 className="font-medium">{user.user_name}</h3>
                                <Badge className={getStatusBadgeColor(user.approved)}>
                                  {user.approved ? 'Approved' : 'Pending'}
                                </Badge>
                                <Badge className={getRoleBadgeColor(user.role)}>
                                  {user.role}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                                <div>
                                  <p>Email</p>
                                  <p className="font-medium">{user.email || 'N/A'}</p>
                                </div>
                                <div>
                                  <p>Registered</p>
                                  <p className="font-medium">{formatDate(user.createdAt)}</p>
                                </div>
                                <div>
                                  <p>API Calls</p>
                                  <p className="font-medium">{user.apiCallsUsed}/{user.apiCallsAvailable}</p>
                                </div>
                                {user.tokenBalance && (
                                  <div>
                                    <p>Tokens</p>
                                    <p className="font-medium">{user.tokenBalance.availableTokens}</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 ml-4">
                              {!user.approved && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveUser(user.id, user.user_name)}
                                    disabled={isLoading}
                                  >
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRejectUser(user.id, user.user_name)}
                                    disabled={isLoading}
                                  >
                                    <UserX className="h-3 w-3 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}

                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="ghost">
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Manage User: {user.user_name}</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div>
                                      <Label>Role</Label>
                                      <Select
                                        value={user.role}
                                        onValueChange={(value) => handleUpdateUserRole(user.id, value, user.user_name)}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="user">User</SelectItem>
                                          <SelectItem value="admin">Admin</SelectItem>
                                          <SelectItem value="superadmin">Super Admin</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div>
                                      <Label>Credit Tokens</Label>
                                      <div className="flex gap-2">
                                        <Input
                                          type="number"
                                          value={tokenCreditAmount}
                                          onChange={(e) => setTokenCreditAmount(parseInt(e.target.value) || 0)}
                                          placeholder="Amount"
                                          min={0}
                                        />
                                        <Button
                                          onClick={() => handleCreditTokens(user.id, tokenCreditAmount, user.user_name)}
                                          disabled={isLoading}
                                        >
                                          <Zap className="h-4 w-4 mr-1" />
                                          Credit
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="text-sm text-muted-foreground">
                                      <p><strong>User ID:</strong> {user.id}</p>
                                      <p><strong>Created:</strong> {formatDate(user.createdAt)}</p>
                                      <p><strong>Updated:</strong> {formatDate(user.updatedAt)}</p>
                                      {user.stripe_customer_id && (
                                        <p><strong>Stripe Customer:</strong> {user.stripe_customer_id}</p>
                                      )}
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {hasMore && (
                    <div className="mt-4 text-center">
                      <Button onClick={loadMore} variant="outline" disabled={isLoading}>
                        {isLoading ? 'Loading...' : 'Load More'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Users waiting for admin approval to access the platform.
              </p>
              {/* Filter to show only pending users */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admins">
          <Card>
            <CardHeader>
              <CardTitle>Administrator Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Manage administrator and super administrator accounts.
              </p>
              {/* Filter to show only admin users */}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Hook for admin user management
export const useAdminUsers = () => {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadUsers = async (apiUrl = '/api', status = 'pending') => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/admin/users?status=${status}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error loading admin users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async (apiUrl = '/api') => {
    try {
      const response = await fetch(`${apiUrl}/admin/users/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  useEffect(() => {
    loadUsers()
    loadStats()
  }, [])

  return {
    users,
    stats,
    isLoading,
    loadUsers,
    loadStats
  }
}