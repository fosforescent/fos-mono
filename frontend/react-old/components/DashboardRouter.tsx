import React from 'react'
import { useProps } from '@/App'
import { Dashboard } from './Dashboard'
import { AdminDashboard } from './admin/AdminDashboard'
import { CustomerPortal } from './customer/CustomerPortal'

export const DashboardRouter: React.FC = () => {
  const { data, setData, options } = useProps()
  
  // Determine which dashboard to show based on user role and service provider status
  const userRole = data.info?.role || 'user'
  const isAdmin = userRole === 'admin' || userRole === 'superadmin'
  const isServiceProvider = data.info?.profile?.is_service_provider ?? true // Default existing users to providers
  
  // Admin users get admin dashboard
  if (isAdmin) {
    return <AdminDashboard />
  }
  
  // Service providers get full dashboard
  if (isServiceProvider) {
    return <Dashboard userRole={userRole as 'user' | 'admin' | 'superadmin'} />
  }
  
  // Customer-only users get customer portal
  return (
    <CustomerPortal 
      data={data}
      setData={setData}
      options={options}
    />
  )
}