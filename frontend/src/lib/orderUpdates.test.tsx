import { act, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderApp } from '../test/render';
import { api, ApiError } from './api';
import { useOrderUpdates } from './orderUpdates';

class Stream extends EventTarget {
  static instances: Stream[] = [];
  readyState = 0;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {
    super();
    Stream.instances.push(this);
  }
}
function Probe() {
  return <p>{useOrderUpdates('user')}</p>;
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Stream.instances = [];
});

it('recarrega na conexão e nos eventos, usa fallback apenas desconectado e fecha ao sair', async () => {
  vi.stubGlobal('EventSource', Stream);
  vi.useFakeTimers();
  vi.spyOn(api, 'me').mockResolvedValue({
    id: 'user',
    name: 'Ana',
    email: 'a@example.com',
    version: 0,
  });
  const { client, unmount } = renderApp(<Probe />);
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const stream = Stream.instances[0];
  expect(stream.url).toBe('/api/orders/events');
  act(() => stream.dispatchEvent(new Event('ready')));
  expect(screen.getByText('connected')).toBeInTheDocument();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['orders'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['stats'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['order'] });
  invalidate.mockClear();
  act(() => vi.advanceTimersByTime(10_000));
  expect(invalidate).not.toHaveBeenCalled();
  act(() => stream.dispatchEvent(new Event('orders-changed')));
  expect(invalidate).toHaveBeenCalledTimes(3);
  invalidate.mockClear();
  await act(async () => stream.onerror?.());
  expect(screen.getByText('reconnecting')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(10_000));
  expect(invalidate).toHaveBeenCalledTimes(3);
  act(() => stream.dispatchEvent(new Event('ready')));
  invalidate.mockClear();
  act(() => vi.advanceTimersByTime(10_000));
  expect(invalidate).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new Event('offline')));
  expect(screen.getByText('reconnecting')).toBeInTheDocument();
  expect(stream.close).toHaveBeenCalledOnce();
  act(() => window.dispatchEvent(new Event('online')));
  const recovered = Stream.instances[1];
  act(() => recovered.dispatchEvent(new Event('ready')));
  expect(screen.getByText('connected')).toBeInTheDocument();
  invalidate.mockClear();
  unmount();
  expect(recovered.close).toHaveBeenCalledOnce();
  act(() => vi.advanceTimersByTime(10_000));
  expect(invalidate).not.toHaveBeenCalled();
});

it('encerra a sessão da interface quando a reconexão recebe 401', async () => {
  vi.stubGlobal('EventSource', Stream);
  vi.spyOn(api, 'me').mockRejectedValue(
    new ApiError({ status: 401, code: 'UNAUTHORIZED', detail: 'Sessão encerrada.' }),
  );
  const expired = vi.fn();
  window.addEventListener('session-expired', expired);
  const { unmount } = renderApp(<Probe />);
  try {
    await act(async () => Stream.instances[0].onerror?.());
    expect(expired).toHaveBeenCalledOnce();
  } finally {
    unmount();
    window.removeEventListener('session-expired', expired);
  }
});

it('reabre um stream encerrado definitivamente pelo servidor', async () => {
  vi.stubGlobal('EventSource', Stream);
  vi.useFakeTimers();
  vi.spyOn(api, 'me').mockResolvedValue({
    id: 'user',
    name: 'Ana',
    email: 'a@example.com',
    version: 0,
  });
  const { unmount } = renderApp(<Probe />);
  const stream = Stream.instances[0];
  stream.readyState = 2;
  await act(async () => stream.onerror?.());
  act(() => vi.advanceTimersByTime(10_000));
  expect(Stream.instances).toHaveLength(2);
  act(() => Stream.instances[1].dispatchEvent(new Event('ready')));
  expect(screen.getByText('connected')).toBeInTheDocument();
  unmount();
});
