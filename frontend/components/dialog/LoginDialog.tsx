import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LogIn, User, BookKey, Cloud } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { getActions } from '@/lib/actions'
import { AppState, FosReactOptions } from '@fosforescent/shared/types'

interface LoginDialogProps {
  open: boolean
  setOpen: (open: boolean) => void
  data: AppState
  setData: (data: AppState) => void
  options: FosReactOptions
}

export const LoginDialog = ({ open, setOpen, data, setData, options }: LoginDialogProps) => {
  const { logIn, registerUser } = getActions(options, data, setData)
  const { toast } = useToast()
  const [loginData, setLoginData] = useState({ username: '', password: '', remember: false })
  const [registerData, setRegisterData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await logIn(loginData.username, loginData.password, loginData.remember)

      // Clear offline mode flag after successful login
      setData({
        ...data,
        auth: {
          ...data.auth,
          offlineMode: false
        },
        info: {
          ...data.info,
          offlineMode: false
        }
      })

      toast({
        title: 'Login successful',
        description: 'Your data will now sync to the cloud.'
      })

      setOpen(false)
    } catch (error: any) {
      console.log('Login error:', error)
      toast({
        title: 'Login failed',
        description: error.message || 'Invalid credentials',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (registerData.password !== registerData.confirmPassword) {
      toast({
        title: 'Password mismatch',
        description: 'Passwords do not match',
        variant: 'destructive'
      })
      return
    }

    if (!registerData.acceptTerms) {
      toast({
        title: 'Terms required',
        description: 'Please accept the terms and conditions',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)

    try {
      await registerUser(registerData.username, registerData.password, registerData.acceptTerms)

      toast({
        title: 'Registration successful',
        description: 'You are now logged in.'
      })

      setOpen(false)
    } catch (error: any) {
      console.log('Registration error:', error)
      toast({
        title: 'Registration failed',
        description: error.message || 'Something went wrong',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Sign In to Sync
          </DialogTitle>
          <DialogDescription>
            Sign in to sync your data across devices
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="login" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" className="flex items-center gap-2">
              <LogIn size={16} />
              Sign In
            </TabsTrigger>
            <TabsTrigger value="register" className="flex items-center gap-2">
              <BookKey size={16} />
              Register
            </TabsTrigger>
          </TabsList>

          {/* Login Tab */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="Enter your email"
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={loginData.remember}
                  onCheckedChange={(checked) => setLoginData({ ...loginData, remember: !!checked })}
                />
                <Label htmlFor="remember" className="text-sm">Remember me</Label>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                <LogIn size={16} className="mr-2" />
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </TabsContent>

          {/* Register Tab */}
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="Enter your email"
                  value={registerData.username}
                  onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <Input
                  id="register-password"
                  type="password"
                  placeholder="Create a password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="accept-terms"
                  checked={registerData.acceptTerms}
                  onCheckedChange={(checked) => setRegisterData({ ...registerData, acceptTerms: !!checked })}
                />
                <Label htmlFor="accept-terms" className="text-sm">
                  I accept the Terms & Conditions
                </Label>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                <User size={16} className="mr-2" />
                {isLoading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
