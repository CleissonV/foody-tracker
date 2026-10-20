import type { ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import { api, ApiError, errorMessage } from '../lib/api';
import type { User } from '../lib/types';
import { UserAvatar } from './UserAvatar';
import { OrderSyncContext, useOrderUpdates } from '../lib/orderUpdates';

export type AppView = 'orders' | 'profile';

export function AppShell({
  user,
  onLogout,
  view,
  onNavigate,
  children,
}: {
  user: User;
  onLogout: () => void;
  view: AppView;
  onNavigate: (view: AppView) => void;
  children: ReactNode;
}) {
  const sync = useOrderUpdates(user.id);
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: api.stats,
  });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: onLogout,
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) onLogout();
    },
  });
  return (
    <div className="app-layout">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <img src="/brand/foody-logo.png" alt="Foody Delivery" className="sidebar-logo" />
        <span className="workspace-label">MINHA OPERAÇÃO</span>
        <nav aria-label="Menu principal">
          <button
            className={`sidebar-nav ${view === 'orders' ? 'active' : ''}`}
            aria-current={view === 'orders' ? 'page' : undefined}
            onClick={() => onNavigate('orders')}
          >
            <Inventory2Outlined fontSize="small" /> Pedidos <span>{stats.data?.total ?? '—'}</span>
          </button>
          <button
            className={`sidebar-nav ${view === 'profile' ? 'active' : ''}`}
            aria-current={view === 'profile' ? 'page' : undefined}
            onClick={() => onNavigate('profile')}
          >
            <PersonOutlineRounded fontSize="small" /> Meu perfil
          </button>
        </nav>
        <div className="sidebar-guide">
          <div className="guide-icon">
            <LocalShippingOutlined />
          </div>
          <strong>
            Uma boa entrega
            <br />
            começa aqui.
          </strong>
          <p>Acompanhe cada pedido, do recebimento à porta do cliente.</p>
          <Button
            size="small"
            onClick={() => onNavigate('orders')}
            endIcon={<ArrowForwardRounded />}
          >
            Ver pedidos
          </Button>
        </div>
        <div className="sidebar-bottom">
          <button
            className="account-info account-link"
            onClick={() => onNavigate('profile')}
            aria-label="Editar meu perfil"
          >
            <UserAvatar user={user} />
            <div>
              <strong title={user.name}>{user.name}</strong>
              <small title={user.email}>{user.email}</small>
            </div>
          </button>
          <Button
            fullWidth
            color="secondary"
            startIcon={<LogoutRounded fontSize="small" />}
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            Sair da conta
          </Button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Minha operação</span>
            <span>/</span>
            <strong>{view === 'orders' ? 'Pedidos' : 'Meu perfil'}</strong>
          </div>
          <button
            className="mobile-brand-link"
            onClick={() => onNavigate('orders')}
            aria-label="Ver pedidos"
          >
            <img className="mobile-logo" src="/brand/foody-logo.png" alt="Foody Delivery" />
          </button>
          <div className="topbar-right">
            <span className="today-date">
              {new Date().toLocaleDateString('pt-BR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <IconButton
              aria-label="Abrir meu perfil"
              onClick={() => onNavigate('profile')}
              size="small"
            >
              <UserAvatar user={user} />
            </IconButton>
            <IconButton
              className="mobile-logout"
              aria-label="Sair da conta"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogoutRounded fontSize="small" />
            </IconButton>
          </div>
        </header>
        {logout.isError && (
          <Alert severity="error" sx={{ mx: 3, mt: 2 }}>
            {errorMessage(logout.error)}
          </Alert>
        )}
        <OrderSyncContext.Provider value={sync}>{children}</OrderSyncContext.Provider>
      </div>
    </div>
  );
}
