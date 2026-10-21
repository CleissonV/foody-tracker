import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, resetCsrf } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  resetCsrf();
});

describe('cliente HTTP', () => {
  it('obtém CSRF e usa cookie same-origin em escritas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'csrf-value' })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'order' })));
    vi.stubGlobal('fetch', fetchMock);
    await api.changeStatus('order', 'EM_PREPARO', 0);
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/orders/order/status');
    expect(init.credentials).toBe('same-origin');
    expect(new Headers(init.headers).get('X-CSRF-TOKEN')).toBe('csrf-value');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'EM_PREPARO', expectedVersion: 0 });
  });

  it('notifica sessão expirada e preserva o erro da API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'UNAUTHORIZED', detail: 'Entre novamente.' }), {
          status: 401,
        }),
      ),
    );
    const expired = vi.fn();
    window.addEventListener('session-expired', expired);
    await expect(api.orders(0)).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener('session-expired', expired);
  });
});

it('codifica o ID da busca e encaminha o cancelamento da consulta', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [] })));
  vi.stubGlobal('fetch', fetcher);
  const controller = new AbortController();
  await api.orders(0, 'RECEBIDO', '#ABCD1234', controller.signal);
  expect(fetcher).toHaveBeenCalledWith(
    '/api/orders?page=0&size=12&status=RECEBIDO&orderId=%23ABCD1234',
    expect.objectContaining({ signal: controller.signal }),
  );
});
