// web/src/features/dashboard/useAnalyticsData.js
import { useCallback, useEffect, useState } from 'react';
import { analyticsApi } from './analyticsApi.js';

/** Tải song song 4 nhóm số liệu cho Dashboard; hủy request cũ khi đổi khoảng ngày. */
export function useAnalyticsData({ from, to, enabled = true }) {
  const [state, setState] = useState({ loading: enabled, error: null, data: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    const { signal } = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    Promise.all([
      analyticsApi.getStationUtilization(signal),
      analyticsApi.getFlightSummary(from, to, signal),
      analyticsApi.getFlightDaily(from, to, signal),
      analyticsApi.getOrderStatusSummary(signal),
    ])
      .then(([stations, summary, daily, orders]) => {
        setState({ loading: false, error: null, data: { stations, summary, daily, orders } });
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState((prev) => ({ ...prev, loading: false, error: err.message }));
      });

    return () => controller.abort();
  }, [from, to, enabled, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
