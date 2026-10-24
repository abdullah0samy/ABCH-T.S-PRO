import { useEffect, useState } from 'react';

/**
 * Make a query error dismissible.
 *
 * The admin pages render `<ErrorBanner error={error} onDismiss={() => setError(null)} />`
 * while `error` is derived from React Query rather than state — so `setError`
 * did not exist and dismissing the banner threw a ReferenceError. The error is
 * not ours to clear, so track the dismissal separately and reset it whenever a
 * different error arrives.
 */
export function useDismissibleError(message: string | null | undefined) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [message]);

  return {
    error: dismissed ? null : message || null,
    dismiss: () => setDismissed(true),
  };
}
