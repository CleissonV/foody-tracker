import { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { api, ApiError, errorMessage, resetCsrf } from './lib/api';
import type { User } from './lib/types';
import { AuthPage } from './features/auth/AuthPage';

const OrdersPage = lazy(() =>
  import('./features/orders/OrdersPage').then((module) => ({ default: module.OrdersPage })),
);

export function App() {
  const client = useQueryClient();
  const [sessionExpired, setSessionExpired] = useState(false);
  const me = useQuery({
    queryKey: ['auth'],
    queryFn: api.me,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const expire = () => {
      resetCsrf();
      void client.cancelQueries();
      client.setQueryData(['auth'], null);
      setSessionExpired(true);
    };
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, [client]);

  useEffect(() => {
    if (!me.data) {
      // Run after the authenticated view unmounts, so active observers cannot recreate its cache.
      void client.cancelQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
    }
  }, [client, me.data]);

  const login = (user: User) => {
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
    client.setQueryData(['auth'], user);
    setSessionExpired(false);
  };
  const logout = () => {
    void client.cancelQueries();
    client.setQueryData(['auth'], null);
  };

  if (me.isPending)
    return (
      <main className="boot-loader">
        <img src="/brand/foody-logo.png" alt="Foody Delivery" />
        <CircularProgress size={28} aria-label="Carregando sessão" />
      </main>
    );
  if (me.isError && !(me.error instanceof ApiError && me.error.status === 401)) {
    return (
      <main className="boot-loader">
        <Alert severity="error">{errorMessage(me.error)}</Alert>
        <Button
          onClick={() => {
            void me.refetch();
          }}
        >
          Tentar novamente
        </Button>
      </main>
    );
  }
  return me.data ? (
    <Suspense
      fallback={
        <main className="boot-loader">
          <CircularProgress aria-label="Carregando pedidos" />
        </main>
      }
    >
      <OrdersPage user={me.data} onLogout={logout} />
    </Suspense>
  ) : (
    <AuthPage onLogin={login} sessionExpired={sessionExpired} />
  );
}
