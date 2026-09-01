'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional fallback when the section name is known */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for the Discover feature.
 * Catches render errors in the map, list, filters, or endorsement
 * components and shows a retry-able fallback instead of crashing
 * the entire page.
 */
export default class DiscoveryErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[DiscoveryErrorBoundary${this.props.section ? `: ${this.props.section}` : ''}]`,
      error,
      info.componentStack,
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="bg-red-50 border border-red-200 rounded-xl px-5 py-6 text-center"
          role="alert"
        >
          <p className="text-sm font-semibold text-red-700 mb-1">
            Something went wrong{this.props.section ? ` in ${this.props.section}` : ''}
          </p>
          <p className="text-xs text-red-500 mb-4 max-w-sm mx-auto">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 text-xs font-semibold bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
