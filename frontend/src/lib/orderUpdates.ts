import { createContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';

export type OrderSyncState = 'connecting' | 'connected' | 'reconnecting';
export const OrderSyncContext = createContext<OrderSyncState>('connecting');

export function useOrderUpdates(userId: string): OrderSyncState {
  const client = useQueryClient();
  const [state, setState] = useState<OrderSyncState>('connecting');

  useEffect(() => {
    let active = true;
    let connected = false;
    let source: EventSource | undefined;
    const reload = () => {
      if (!active) return;
      void client.invalidateQueries({ queryKey: ['orders'] });
      void client.invalidateQueries({ queryKey: ['stats'] });
      void client.invalidateQueries({ queryKey: ['order'] });
    };
    const expire = () => {
      if (active) window.dispatchEvent(new Event('session-expired'));
    };
    const connect = () => {
      source?.close();
      if (typeof EventSource === 'undefined') return;
      const stream = new EventSource('/api/orders/events');
      source = stream;
      stream.addEventListener('ready', () => {
        if (!active || source !== stream) return;
        connected = true;
        setState('connected');
        // Reload also covers changes missed before connecting or while offline.
        reload();
      });
      stream.addEventListener('orders-changed', () => {
        if (source === stream) reload();
      });
      stream.addEventListener('session-expired', () => {
        if (source === stream) expire();
      });
      stream.onerror = () => {
        if (!active || source !== stream) return;
        connected = false;
        setState('reconnecting');
        // EventSource hides HTTP status codes. Check whether authentication caused the failure.
        void api.me().catch((error: unknown) => {
          if (source === stream && error instanceof ApiError && error.status === 401) expire();
        });
      };
    };
    const offline = () => {
      connected = false;
      source?.close();
      source = undefined;
      setState('reconnecting');
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', connect);
    connect();
    const fallback = window.setInterval(() => {
      if (!connected) {
        reload();
        // HTTP errors such as 429/503 may permanently close the native EventSource.
        if (source?.readyState === 2) connect();
      }
    }, 10_000);
    return () => {
      active = false;
      source?.close();
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', connect);
      window.clearInterval(fallback);
    };
  }, [client, userId]);
  return state;
}
