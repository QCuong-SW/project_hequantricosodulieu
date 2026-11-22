export function showToast(message, type = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sdd-toast', {
        detail: {
          id: `${Date.now()}-${Math.random()}`,
          message,
          type, // 'success' | 'error' | 'warning' | 'info'
          timestamp: Date.now(),
        },
      })
    );
  }
}
