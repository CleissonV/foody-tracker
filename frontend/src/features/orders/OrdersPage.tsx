import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Pagination from '@mui/material/Pagination';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import AddRounded from '@mui/icons-material/AddRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import RestaurantOutlined from '@mui/icons-material/RestaurantOutlined';
import { api, ApiError, errorMessage } from '../../lib/api';
import type { Status, User } from '../../lib/types';
import { dateTime, money, shortId, statuses, statusLabels } from '../../lib/types';
import { StatusBadge } from '../../components/StatusBadge';
import { OrderIllustration } from '../../components/OrderIllustration';
import { CreateOrderDialog } from './CreateOrderDialog';
import { OrderDetails } from './OrderDetails';

export function OrdersPage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [filter, setFilter] = useState<Status | undefined>();
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [message, setMessage] = useState('');
  const orders = useQuery({
    queryKey: ['orders', { page, filter }],
    queryFn: () => api.orders(page, filter),
    refetchInterval: 10_000,
  });
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 10_000 });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: onLogout,
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) onLogout();
    },
  });
  const changeFilter = (status?: Status) => {
    setFilter(status);
    setPage(0);
  };
  const refresh = () => {
    void Promise.all([orders.refetch(), stats.refetch()]);
  };
  const counts = stats.data?.counts;
  const firstName = user.name.split(' ')[0];
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const cards = [
    {
      title: 'Total de pedidos',
      value: stats.data?.total,
      icon: <ReceiptLongOutlined />,
      className: 'coral',
      caption: 'Todos os seus pedidos',
    },
    {
      title: 'Na cozinha',
      value: counts ? counts.RECEBIDO + counts.EM_PREPARO : undefined,
      icon: <RestaurantOutlined />,
      className: 'amber',
      caption: 'Recebidos e em preparo',
    },
    {
      title: 'A caminho',
      value: counts?.SAIU_PARA_ENTREGA,
      icon: <LocalShippingOutlined />,
      className: 'blue',
      caption: 'Saiu para entrega',
    },
    {
      title: 'Entregues',
      value: counts?.ENTREGUE,
      icon: <CheckCircleOutlineRounded />,
      className: 'green',
      caption: 'Entregas concluídas',
    },
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <img src="/brand/foody-logo.png" alt="Foody Delivery" className="sidebar-logo" />
        <span className="workspace-label">MINHA OPERAÇÃO</span>
        <button className="sidebar-nav active" onClick={() => changeFilter()}>
          <Inventory2Outlined fontSize="small" /> Pedidos <span>{stats.data?.total ?? '—'}</span>
        </button>
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
          <Button size="small" onClick={() => setCreating(true)} endIcon={<ArrowForwardRounded />}>
            Criar pedido
          </Button>
        </div>
        <div className="sidebar-bottom">
          <div className="account-info">
            <span className="account-avatar">{initials}</span>
            <div>
              <strong title={user.name}>{user.name}</strong>
              <small title={user.email}>{user.email}</small>
            </div>
          </div>
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
            <strong>Pedidos</strong>
          </div>
          <img className="mobile-logo" src="/brand/foody-logo.png" alt="Foody Delivery" />
          <div className="topbar-right">
            <span className="today-date">
              {new Date().toLocaleDateString('pt-BR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span className="account-avatar">{initials}</span>
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
        <main className="orders-main" id="main-content">
          {logout.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage(logout.error)}
            </Alert>
          )}
          <section className="page-heading">
            <div>
              <span className="eyebrow">TUDO PRONTO PARA A PRÓXIMA ENTREGA</span>
              <h1>Olá, {firstName}</h1>
              <p>Vamos cuidar dos pedidos de hoje?</p>
            </div>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setCreating(true)}
            >
              Novo pedido
            </Button>
          </section>
          <section className="overview-banner">
            <div>
              <span className="banner-tag">
                <span /> DO PEDIDO À ENTREGA
              </span>
              <h2>Sua operação em movimento.</h2>
              <p>Cada etapa no lugar. Cada entrega mais perto.</p>
            </div>
            <OrderIllustration />
          </section>
          {stats.isError && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              action={
                <Button
                  onClick={() => {
                    void stats.refetch();
                  }}
                >
                  Tentar novamente
                </Button>
              }
            >
              Não foi possível atualizar os indicadores.
            </Alert>
          )}
          <section className="stats-grid" aria-label="Resumo dos pedidos">
            {cards.map((card) => (
              <article className="stat-card" key={card.title}>
                <div className="stat-card-top">
                  <span>{card.title}</span>
                  <span className={`stat-icon ${card.className}`}>{card.icon}</span>
                </div>
                <strong>
                  {card.value === undefined ? (
                    <Skeleton width={40} />
                  ) : (
                    card.value.toLocaleString('pt-BR')
                  )}
                </strong>
                <small>{card.caption}</small>
              </article>
            ))}
          </section>
          <section className="orders-panel" aria-labelledby="orders-title">
            <div className="orders-panel-heading">
              <div>
                <h2 id="orders-title">
                  Seus pedidos <span>{orders.data?.totalElements ?? '—'}</span>
                </h2>
                <p>Acompanhe e atualize cada etapa da entrega.</p>
              </div>
              <IconButton
                aria-label="Atualizar pedidos"
                onClick={refresh}
                disabled={orders.isFetching || stats.isFetching}
              >
                {orders.isFetching ? <CircularProgress size={20} /> : <RefreshRounded />}
              </IconButton>
            </div>
            <div className="status-tabs" role="group" aria-label="Filtrar por status">
              <button className={!filter ? 'selected' : ''} onClick={() => changeFilter()}>
                Todos
              </button>
              {statuses.map((status) => (
                <button
                  key={status}
                  className={filter === status ? 'selected' : ''}
                  onClick={() => changeFilter(status)}
                >
                  {statusLabels[status]}
                  <span>{counts?.[status] ?? '—'}</span>
                </button>
              ))}
            </div>
            {orders.isError && (
              <Alert
                severity="error"
                sx={{ m: 2 }}
                action={
                  <Button
                    onClick={() => {
                      void orders.refetch();
                    }}
                  >
                    Tentar novamente
                  </Button>
                }
              >
                {errorMessage(orders.error)}
              </Alert>
            )}
            {orders.isPending ? (
              <div className="orders-loading" aria-label="Carregando pedidos">
                {[1, 2, 3].map((n) => (
                  <Skeleton key={n} height={70} />
                ))}
              </div>
            ) : orders.data && orders.data.content.length > 0 ? (
              <>
                <TableContainer className="orders-table">
                  <Table aria-label="Lista de pedidos">
                    <TableHead>
                      <TableRow>
                        <TableCell>Pedido / Cliente</TableCell>
                        <TableCell>Destino</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Valor</TableCell>
                        <TableCell align="right">Detalhes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orders.data.content.map((order) => (
                        <TableRow hover key={order.id}>
                          <TableCell>
                            <div className="table-customer">
                              <div className="customer-avatar">
                                {order.customerName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <strong>{order.customerName}</strong>
                                <small>
                                  {shortId(order.id)} · {dateTime(order.createdAt)}
                                </small>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="table-destination">
                              <strong>{order.deliveryAddress.neighborhood}</strong>
                              <small>
                                {order.deliveryAddress.city} / {order.deliveryAddress.state}
                              </small>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={order.status} />
                          </TableCell>
                          <TableCell align="right">
                            <strong className="order-price">{money(order.total)}</strong>
                            <small className="table-item-count">
                              {order.itemCount} {order.itemCount === 1 ? 'item' : 'itens'}
                            </small>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              aria-label={`Ver pedido de ${order.customerName}`}
                              onClick={() => setSelectedId(order.id)}
                            >
                              <ArrowForwardRounded fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <div className="mobile-orders">
                  {orders.data.content.map((order) => (
                    <button
                      key={order.id}
                      className="mobile-order-card"
                      onClick={() => setSelectedId(order.id)}
                      aria-label={`Ver pedido de ${order.customerName}`}
                    >
                      <div>
                        <small>{shortId(order.id)}</small>
                        <strong>{order.customerName}</strong>
                        <span>
                          {order.deliveryAddress.neighborhood} · {order.deliveryAddress.city}
                        </span>
                      </div>
                      <div>
                        <StatusBadge status={order.status} />
                        <strong>{money(order.total)}</strong>
                        <ArrowForwardRounded fontSize="small" />
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              orders.isSuccess && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Inventory2Outlined sx={{ fontSize: 30 }} />
                  </div>
                  <h3>
                    {filter ? 'Nenhum pedido nesta etapa.' : 'Sua próxima entrega começa aqui.'}
                  </h3>
                  <p>
                    {filter
                      ? 'Os pedidos aparecem aqui assim que chegarem a este status.'
                      : 'Crie seu primeiro pedido e acompanhe cada passo até a entrega.'}
                  </p>
                  <Button
                    variant="outlined"
                    startIcon={filter ? undefined : <AddRounded />}
                    onClick={() => (filter ? changeFilter() : setCreating(true))}
                  >
                    {filter ? 'Ver todos os pedidos' : 'Criar primeiro pedido'}
                  </Button>
                </div>
              )
            )}
            {orders.data && orders.data.totalPages > 0 && (
              <div className="table-footer">
                <span>
                  {orders.data.totalElements}{' '}
                  {orders.data.totalElements === 1 ? 'pedido' : 'pedidos'} · página {page + 1} de{' '}
                  {orders.data.totalPages}
                </span>
                <Pagination
                  count={orders.data.totalPages}
                  page={page + 1}
                  onChange={(_, value) => setPage(value - 1)}
                  size="small"
                  color="primary"
                />
              </div>
            )}
          </section>
          <footer className="workspace-footer">
            <span>
              <span className="sync-dot" /> Atualização automática a cada 10 segundos
            </span>
            <span>Feito para simplificar o caminho.</span>
          </footer>
        </main>
      </div>
      {creating && (
        <CreateOrderDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setPage(0);
            setFilter(undefined);
            setSelectedId(id);
            setMessage('Pedido criado. Vamos preparar uma boa entrega!');
          }}
        />
      )}
      {selectedId && (
        <OrderDetails
          key={selectedId}
          id={selectedId}
          onClose={() => setSelectedId(undefined)}
          onUpdated={() => setMessage('Status do pedido atualizado.')}
        />
      )}
      <Snackbar
        open={!!message}
        autoHideDuration={4000}
        onClose={() => setMessage('')}
        message={message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </div>
  );
}
