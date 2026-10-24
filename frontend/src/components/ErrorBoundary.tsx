import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Change this (e.g. the current route) to auto-reset the boundary after navigation. */
  resetKey?: string | number;
  language?: 'ar' | 'en';
}
interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render/runtime errors in any child page so a single broken screen
 * shows a graceful, retryable message instead of white-screening the whole app.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidUpdate(prev: Props) {
    // Reset when the caller navigates to a different route.
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught:', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const ar = this.props.language !== 'en';
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6" dir={ar ? 'rtl' : 'ltr'}>
        <div className="premium-card max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-danger-red/10 text-danger-red flex items-center justify-center text-2xl">⚠️</div>
          <h2 className="text-lg font-bold text-[var(--text-main)] mb-2">
            {ar ? 'حدث خطأ غير متوقع في هذه الصفحة' : 'Something went wrong on this page'}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            {ar
              ? 'باقي التطبيق يعمل بشكل طبيعي. يمكنك إعادة المحاولة أو الانتقال لصفحة أخرى.'
              : 'The rest of the app is still working. You can retry or navigate elsewhere.'}
          </p>
          {this.state.error?.message && (
            <pre className="text-xs text-left text-danger-red/80 bg-danger-red/5 rounded-lg p-3 mb-5 overflow-auto max-h-32 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn-primary px-5 py-2 rounded-xl text-sm font-bold"
            >
              {ar ? 'إعادة المحاولة' : 'Retry'}
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: '/dashboard' }))}
              className="px-5 py-2 rounded-xl text-sm font-bold border border-[var(--border-main)] text-[var(--text-secondary)]"
            >
              {ar ? 'لوحة التحكم' : 'Dashboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
