'use client';

import { Component, type ReactNode } from 'react';

type Props = {
  section: string;
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export default class MailboxErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <svg
              className="w-10 h-10 text-gray-300 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <p className="text-sm font-semibold text-app-text mb-1">
              Couldn&apos;t load {this.props.section}
            </p>
            <p className="text-xs text-app-text-secondary mb-3">
              {this.state.error?.message || 'Something went wrong'}
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
