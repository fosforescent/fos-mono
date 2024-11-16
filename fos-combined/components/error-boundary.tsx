import React from 'react';

import { toast, useToast } from '@/components/ui/use-toast';
import { api } from '../api';

export class ErrorBoundary extends React.Component {

  state: { hasError: boolean; };
  props: {
    children: React.ReactNode;
    toast?: ReturnType<typeof useToast>['toast'] 
    // setAppState: React.Dispatch<React.SetStateAction<any>>
    logOut: () => Promise<void>
    email: string
    apiUrl: string
    mode: string
  };

  constructor(props: {
    children: React.ReactNode;
    toast?: ReturnType<typeof useToast>['toast'] 
    // setAppState: React.Dispatch<React.SetStateAction<any>>
    logOut: () => Promise<void>
    email: string
    apiUrl: string
    mode: string
  }) {
    super(props);
    this.state = { hasError: false };
    this.props = props;
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: any) {
    // Example "componentStack":
    //   in ComponentThatThrows (created by App)
    //   in ErrorBoundary (created by App)
    //   in div (created by App)
    //   in App
    // logErrorToMyService(error, info.componentStack);

    console.error('ErrorBoundary did catch error', error, info)
    if (this.props.toast) {
      this.props.toast({
        title: 'Error',
        description: error.message,
      })
    }

    if(error.cause === 'unauthorized'){
      localStorage.removeItem('auth')
      this.props.logOut().then(() => {
      
        if (error.message === 'Token expired') {
          toast({
            title: 'Unauthorized',
            description: 'Please log in',
            variant: 'destructive'
          })
        } else {
          toast({
            title: 'Authorization expired',
            description: 'Please log in again',
            variant: 'destructive'
          })
        }
      });
      console.warn('unauthorized error', error.message)

    } else {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })

      console.error('ErrorBoundary did catch error', error, info)
      api(this.props.apiUrl).public.putError(error, this.props.email).then(() => {
        console.warn('error logged', error)
      }).catch((e: Error) => {
        console.error(error)
        console.error('error logging failed', e)
      })
    } 


  }

  render() {


    return this.props.children;
  }
}