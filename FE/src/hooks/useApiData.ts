import { useState, useEffect, useCallback } from 'react';

/**
 * Generic hook for loading data from API with loading + error state.
 * Returns `refetch` to manually reload.
 */
export function useApiData<T>(
  apiCall: () => Promise<any>,
  dependencies: any[] = [],
  onSuccess?: (data: T[]) => void
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiCall();
        if (cancelled) return;
        const result = response.data || [];
        setData(result);
        onSuccess?.(result);
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading data:', err);
        setData([]);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, version]);

  return { data, loading, error, refetch };
}

/**
 * Hook for loading data based on a condition (e.g., when selectedFactory changes)
 */
export function useConditionalApiData<T>(
  apiCall: (() => Promise<any>) | null,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!apiCall) {
      setData([]);
      setError(null);
      return;
    }

    let cancelled = false;
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiCall();
        if (cancelled) return;
        setData(response.data || []);
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading data:', err);
        setData([]);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, version]);

  return { data, loading, error, refetch };
}
