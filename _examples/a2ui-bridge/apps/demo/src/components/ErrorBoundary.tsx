/**
 * ErrorBoundary - Catches React rendering errors and displays fallback UI
 *
 * Implements:
 * - Component-level error catching
 * - Graceful fallback UI
 * - Error reporting/logging
 * - Recovery mechanisms (retry, reset)
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw, Bug, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  isDark?: boolean;
  /** Show minimal error indicator instead of full error UI */
  minimal?: boolean;
  /** Component name for better error messages */
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error to console for debugging
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, isDark, minimal, componentName } = this.props;

    if (hasError) {
      // If custom fallback provided, use it
      if (fallback) {
        return fallback;
      }

      // Minimal error indicator (inline)
      if (minimal) {
        return (
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-2 rounded-sm text-sm",
            isDark
              ? "bg-red-900/20 text-red-400 border border-red-800"
              : "bg-red-50 text-red-600 border border-red-200"
          )}>
            <XCircle className="h-4 w-4" />
            <span>{componentName || 'Component'} failed to render</span>
            <button
              onClick={this.handleReset}
              className="ml-2 hover:underline text-sm"
            >
              Retry
            </button>
          </div>
        );
      }

      // Full error UI
      return (
        <ErrorFallback
          error={error}
          errorInfo={errorInfo}
          onReset={this.handleReset}
          isDark={isDark}
          componentName={componentName}
        />
      );
    }

    return children;
  }
}

/**
 * Fallback UI for displaying errors
 */
interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset?: () => void;
  isDark?: boolean;
  componentName?: string;
}

export function ErrorFallback({
  error,
  errorInfo,
  onReset,
  isDark,
  componentName,
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div className={cn(
      "p-6 rounded-sm border max-w-lg mx-auto",
      isDark
        ? "bg-zinc-800 border-zinc-700"
        : "bg-white border-zinc-200"
    )}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
          isDark ? "bg-red-900/30" : "bg-red-100"
        )}>
          <AlertTriangle className={cn(
            "h-6 w-6",
            isDark ? "text-red-400" : "text-red-600"
          )} />
        </div>
        <div className="flex-1">
          <h3 className={cn(
            "text-lg font-semibold",
            isDark ? "text-zinc-100" : "text-zinc-900"
          )}>
            {componentName ? `${componentName} Error` : 'Something went wrong'}
          </h3>
          <p className={cn(
            "text-sm mt-1",
            isDark ? "text-zinc-400" : "text-zinc-600"
          )}>
            {error?.message || 'An unexpected error occurred while rendering this component.'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center gap-3">
        {onReset && (
          <Button
            onClick={onReset}
            size="sm"
            className="bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-dark))]"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
        >
          <Bug className="h-4 w-4 mr-2" />
          {showDetails ? 'Hide' : 'Show'} Details
        </Button>
      </div>

      {/* Error Details (collapsible) */}
      {showDetails && (
        <div className={cn(
          "mt-4 p-4 rounded-sm text-xs font-mono overflow-auto max-h-[200px]",
          isDark ? "bg-zinc-900 text-zinc-400" : "bg-zinc-50 text-zinc-600"
        )}>
          <div className="mb-2 font-semibold">Error:</div>
          <pre className="whitespace-pre-wrap break-all">{error?.toString()}</pre>
          {errorInfo?.componentStack && (
            <>
              <div className="mt-4 mb-2 font-semibold">Component Stack:</div>
              <pre className="whitespace-pre-wrap break-all">
                {errorInfo.componentStack}
              </pre>
            </>
          )}
        </div>
      )}

      {/* Helpful hint */}
      <p className={cn(
        "text-xs mt-4",
        isDark ? "text-zinc-500" : "text-zinc-400"
      )}>
        If this keeps happening, try refreshing the page or check the browser console for more details.
      </p>
    </div>
  );
}

// Import React for useState in ErrorFallback
import React from 'react';

/**
 * A2UI-specific error boundary for Surface components
 * Handles malformed A2UI JSON gracefully
 */
interface A2UIErrorBoundaryProps {
  children: ReactNode;
  isDark?: boolean;
  onReset?: () => void;
}

export function A2UIErrorBoundary({ children, isDark, onReset }: A2UIErrorBoundaryProps) {
  return (
    <ErrorBoundary
      isDark={isDark}
      componentName="A2UI Surface"
      onReset={onReset}
      onError={(error) => {
        // Could send to error tracking service here
        console.error('[A2UI] Rendering error:', error.message);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Inline error boundary for individual components
 * Shows minimal error indicator that doesn't break the layout
 */
export function ComponentErrorBoundary({
  children,
  name,
  isDark,
}: {
  children: ReactNode;
  name?: string;
  isDark?: boolean;
}) {
  return (
    <ErrorBoundary
      isDark={isDark}
      componentName={name}
      minimal
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
