import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { api, ApiError, errorMessage, resetCsrf } from './lib/api';
import type { User } from './lib/types';
import { AuthPage } from './features/auth/AuthPage';
import { AppShell } from './components/AppShell';
import type { AppView } from './components/AppShell';

const OrdersPage = lazy(() =>
  import('./features/orders/OrdersPage').then((module) => ({ default: module.OrdersPage })),
);
const ProfilePage = lazy(() =>
  import('./features/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const subscribeNavigation = (listener: () => void) => {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
};
const currentView = (): AppView => (window.location.hash === '#perfil' ? 'profile' : 'orders');

export function App() {
  const client = useQueryClient();
  const [sessionExpired, setSessionExpired] = useState(false);
  const view = useSyncExternalStore(subscribeNavigation, currentView);
  const navigate = (next: AppView) => {
    window.location.hash = next === 'profile' ? 'perfil' : 'pedidos';
  };
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
    <AppShell user={me.data} onLogout={logout} view={view} onNavigate={navigate}>
      <Suspense
        fallback={
          <main className="boot-loader">
            <CircularProgress aria-label="Carregando pedidos" />
          </main>
        }
      >
        {view === 'profile' ? <ProfilePage user={me.data} /> : <OrdersPage user={me.data} />}
      </Suspense>
    </AppShell>
  ) : (
    <AuthPage onLogin={login} sessionExpired={sessionExpired} />
  );
}
