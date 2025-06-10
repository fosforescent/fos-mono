import React from 'react'
import { useProps } from '@/frontend/App'
import { Dashboard } from './Dashboard'
import { AdminDashboard } from './admin/AdminDashboard'

export const DashboardRouter: React.FC = () => {
  const { data } = useProps()
  
  // Determine which dashboard to show based on user role
  const userRole = data.info?.role || 'user'
  const isAdmin = userRole === 'admin' || userRole === 'superadmin'
  
  if (isAdmin) {
    return <AdminDashboard />
  }
  
  return <Dashboard userRole={userRole as 'user' | 'admin' | 'superadmin'} />
}