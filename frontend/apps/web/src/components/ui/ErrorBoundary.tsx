'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-red-200 bg-red-50/50 px-6">
          <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
          <p className="text-sm font-medium text-app-text mb-1">Something went wrong</p>
          <p className="text-xs text-app-text-secondary mb-3 max-w-xs">
            {this.state.error?.message || 'An unexpected error occurred in this section.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-3 py-1.5 text-xs font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100 transition"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
