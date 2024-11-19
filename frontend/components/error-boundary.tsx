import React from 'react';

import { toast, useToast } from '@/frontend/components/ui/use-toast';
import { api } from '../api';
import { AppState, FosReactGlobal } from '../types';
import { getActions } from '../lib/actions';

export class ErrorBoundary extends React.Component {

  state: { hasError: boolean; };
  props: {
    children: React.ReactNode;
    mode: string
    options: FosReactGlobal
    data: AppState
    setData: (data: AppState) => void

  };

  constructor(props: {
    children: React.ReactNode;
    mode: string
    options: FosReactGlobal
    data: AppState
    setData: (data: AppState) => void

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
    if (this.props.options.toast) {
      this.props.options.toast({
        title: 'Error',
        description: error.message,
        duration: 5000,
      })
    }

    const { logOut, putError } = getActions(this.props.options, this.props.data, this.props.setData)

    if(error.cause === 'unauthorized'){
      console.log('unauthorized error', error.message)
      // localStorage.removeItem('auth')
      logOut().then(() => {
      
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
      putError(error).then(() => {
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