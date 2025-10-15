import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Clock, 
  Mail, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  LogOut
} from 'lucide-react'

interface PendingApprovalProps {
  userEmail?: string
  userName?: string
  onLogout?: () => void
  onRefresh?: () => void
  className?: string
}

export const PendingApproval: React.FC<PendingApprovalProps> = ({
  userEmail,
  userName,
  onLogout,
  onRefresh,
  className = ''
}) => {
  const handleContactSupport = () => {
    const subject = encodeURIComponent('Account Approval Request')
    const body = encodeURIComponent(`Hello,

I registered for a Fosforescent account and am waiting for approval.

Account details:
- Username: ${userName || 'N/A'}
- Email: ${userEmail || 'N/A'}

Please let me know if you need any additional information.

Thank you!`)
    
    window.open(`mailto:support@fosforescent.com?subject=${subject}&body=${body}`)
  }

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gray-50 ${className}`}>
      <div className="max-w-md w-full space-y-6 p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Account Pending Approval
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Thanks for registering! Your account is awaiting approval.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              What's Next?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Registration Complete</p>
                <p className="text-sm text-muted-foreground">
                  Your account has been successfully created
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium">Approval Pending</p>
                <p className="text-sm text-muted-foreground">
                  An administrator will review and approve your account
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium">Email Notification</p>
                <p className="text-sm text-muted-foreground">
                  You'll receive an email when your account is approved
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {userName && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Account Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username:</span>
                  <span className="font-medium">{userName}</span>
                </div>
                {userEmail && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{userEmail}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <Button 
            onClick={onRefresh} 
            className="w-full"
            variant="default"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Check Approval Status
          </Button>

          <Button 
            onClick={handleContactSupport} 
            className="w-full"
            variant="outline"
          >
            <Mail className="h-4 w-4 mr-2" />
            Contact Support
          </Button>

          {onLogout && (
            <Button 
              onClick={onLogout} 
              className="w-full"
              variant="ghost"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Approval typically takes 1-2 business days. If you have questions,
            please contact our support team.
          </p>
        </div>
      </div>
    </div>
  )
}

// Hook to check user approval status
export const useUserApproval = () => {
  const [isApproved, setIsApproved] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [userInfo, setUserInfo] = useState<{ userName?: string; userEmail?: string } | null>(null)

  const checkApprovalStatus = async (apiUrl = '/api') => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setIsApproved(data.user?.approved || false)
        setUserInfo({
          userName: data.user?.user_name,
          userEmail: data.user?.email
        })
      } else if (response.status === 403) {
        // User exists but not approved
        setIsApproved(false)
      } else {
        // Other error - might not be logged in
        setIsApproved(null)
      }
    } catch (error) {
      console.error('Error checking approval status:', error)
      setIsApproved(null)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isApproved,
    isLoading,
    userInfo,
    checkApprovalStatus
  }
}