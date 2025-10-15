import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { LogIn, User, BookKey, DoorClosed } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { getActions } from '../lib/actions'
import { AppState, FosReactOptions } from '@fosforescent/shared/types'

interface AuthLandingProps {
  data: AppState
  setData: (data: AppState) => void
  options: FosReactOptions
}

export const AuthLanding = ({ data, setData, options }: AuthLandingProps) => {
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

      toast({
        title: 'Login successful',
        description: 'Welcome back!'
      })

      // The logIn action will handle setting auth state and redirecting
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
        description: 'Please check your email to confirm your account'
      })

      // Could automatically switch to login tab
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Fosforescent</h1>
          <p className="text-xl text-muted-foreground">
            Distributed collaborative workflow system
          </p>
        </div>

        {/* Main Auth Container */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Welcome/Info Side */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Welcome to Fosforescent</CardTitle>
                <CardDescription>
                  A powerful platform for managing workflows with AI and human collaboration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">✨ Key Features</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Visual graph-based workflow management</li>
                    <li>• AI-powered task suggestions and automation</li>
                    <li>• Real-time collaboration</li>
                    <li>• Distributed architecture</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Auth Forms Side */}
          <Card>
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login" className="flex items-center gap-2">
                    <DoorClosed size={16} />
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
                    <Button type="button" variant="ghost" className="w-full text-sm">
                      Forgot your password?
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
                        I accept the Terms & Conditions and Privacy Policy
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}