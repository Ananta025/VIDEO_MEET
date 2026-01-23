import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/home';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
          <div className="max-w-md text-center">
            <h1 className="text-4xl font-bold mb-4 text-red-500">Oops!</h1>
            <h2 className="text-xl mb-4">Something went wrong</h2>
            <p className="text-gray-400 mb-6">
              We're sorry for the inconvenience. Please try refreshing the page or go back to home.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left bg-gray-800 p-4 rounded-lg">
                <summary className="cursor-pointer text-yellow-400 mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="text-xs text-red-400 overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleReload}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
              >
                Refresh Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
