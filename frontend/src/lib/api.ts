import type { CreateOrder, Order, OrderSummary, Page, Problem, Stats, Status, User } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors?: Record<string, string>;

  constructor(problem: Problem) {
    super(problem.detail);
    this.name = 'ApiError';
    this.status = problem.status;
    this.code = problem.code;
    this.errors = problem.errors;
  }
}

interface Csrf {
  headerName: string;
  token: string;
}
let csrf: Csrf | undefined;
let csrfRequest: Promise<Csrf> | undefined;

async function getCsrf(): Promise<Csrf> {
  if (csrf) return csrf;
  csrfRequest ??= fetch('/api/auth/csrf', { credentials: 'same-origin' }).then(async (response) => {
    if (!response.ok)
      throw new Error('Não foi possível iniciar uma sessão segura. Tente novamente.');
    return response.json() as Promise<Csrf>;
  });
  try {
    csrf = await csrfRequest;
    return csrf;
  } finally {
    csrfRequest = undefined;
  }
}

export function resetCsrf() {
  csrf = undefined;
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (init.method && !['GET', 'HEAD', 'OPTIONS'].includes(init.method)) {
    const token = await getCsrf();
    headers.set(token.headerName, token.token);
  }
  const response = await fetch('/api' + url, { ...init, headers, credentials: 'same-origin' });
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({
      status: response.status,
      code: 'HTTP_ERROR',
      detail: 'Não foi possível concluir a operação. Tente novamente.',
    }))) as Problem;
    if (response.status === 403) resetCsrf();
    if (response.status === 401 && !url.startsWith('/auth/'))
      window.dispatchEvent(new Event('session-expired'));
    throw new ApiError({ ...problem, status: response.status });
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<User>('/auth/me'),
  updateProfile: async (data: {
    name: string;
    email: string;
    currentPassword?: string;
    expectedVersion: number;
  }) => {
    const user = await request<User>('/profile', { method: 'PATCH', body: JSON.stringify(data) });
    resetCsrf();
    return user;
  },
  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
    expectedVersion: number;
  }) => {
    const user = await request<User>('/profile/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    resetCsrf();
    return user;
  },
  uploadAvatar: (file: File) => {
    const data = new FormData();
    data.append('file', file);
    return request<User>('/profile/avatar', { method: 'PUT', body: data });
  },
  removeAvatar: () => request<User>('/profile/avatar', { method: 'DELETE' }),
  register: (data: { name: string; email: string; password: string }) =>
    request<User>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: async (data: { email: string; password: string }) => {
    const user = await request<User>('/auth/login', { method: 'POST', body: JSON.stringify(data) });
    resetCsrf();
    return user;
  },
  logout: async () => {
    await request<void>('/auth/logout', { method: 'POST' });
    resetCsrf();
  },
  orders: (page: number, status?: Status) =>
    request<Page<OrderSummary>>(`/orders?page=${page}&size=12${status ? '&status=' + status : ''}`),
  order: (id: string) => request<Order>('/orders/' + id),
  stats: () => request<Stats>('/orders/stats'),
  create: (order: CreateOrder) =>
    request<Order>('/orders', { method: 'POST', body: JSON.stringify(order) }),
  changeStatus: (id: string, status: Status, expectedVersion: number) =>
    request<Order>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, expectedVersion }),
    }),
};

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Ocorreu um erro. Tente novamente.';
