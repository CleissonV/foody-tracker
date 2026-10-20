import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import { api, ApiError, errorMessage } from '../../lib/api';
import type { Status } from '../../lib/types';
import { dateTime, money, shortId, statusLabels } from '../../lib/types';
import { StatusBadge } from '../../components/StatusBadge';

export function OrderDetails({
  id,
  onClose,
  onUpdated,
}: {
  id: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const client = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const detail = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.order(id),
  });
  const update = useMutation({
    mutationFn: ({ status, version }: { status: Status; version: number }) =>
      api.changeStatus(id, status, version),
    onSuccess: async (order) => {
      client.setQueryData(['order', id], order);
      setConfirmCancel(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['orders'] }),
        client.invalidateQueries({ queryKey: ['stats'] }),
      ]);
      onUpdated();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409)
        void client.invalidateQueries({ queryKey: ['order', id] });
    },
  });
  const order = detail.data;
  const changeStatus = (status: Status) => {
    if (order) update.mutate({ status, version: order.version });
  };

  return (
    <>
      <Drawer
        anchor="right"
        open
        onClose={update.isPending ? undefined : onClose}
        slotProps={{
          paper: {
            className: 'details-drawer',
            role: 'dialog',
            'aria-modal': true,
            'aria-labelledby': 'order-detail-title',
          },
        }}
      >
        <div className="detail-top">
          <div>
            <span className="eyebrow">DETALHES DO PEDIDO</span>
            <h2 id="order-detail-title">{shortId(id)}</h2>
          </div>
          <IconButton aria-label="Fechar detalhes" onClick={onClose} disabled={update.isPending}>
            <CloseRounded />
          </IconButton>
        </div>
        {detail.isPending && (
          <div className="detail-loading">
            <CircularProgress aria-label="Carregando pedido" />
          </div>
        )}
        {detail.isError && (
          <Alert
            severity="error"
            sx={{ m: 3 }}
            action={
              <Button
                onClick={() => {
                  void detail.refetch();
                }}
              >
                Tentar novamente
              </Button>
            }
          >
            {errorMessage(detail.error)}
          </Alert>
        )}
        {order && (
          <>
            <div className="detail-body">
              {update.isError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {errorMessage(update.error)}
                </Alert>
              )}
              <div className="detail-customer">
                <div className="customer-avatar large">
                  {order.customerName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3>{order.customerName}</h3>
                  <span>Criado em {dateTime(order.createdAt)}</span>
                </div>
              </div>
              <StatusBadge status={order.status} />
              <section className="detail-section">
                <h4>
                  <LocationOnOutlined fontSize="small" /> Endereço de entrega
                </h4>
                <p>
                  {order.deliveryAddress.street}, {order.deliveryAddress.number}
                  {order.deliveryAddress.complement ? ` · ${order.deliveryAddress.complement}` : ''}
                  <br />
                  {order.deliveryAddress.neighborhood} · {order.deliveryAddress.city}/
                  {order.deliveryAddress.state}
                  <br />
                  <span>CEP {order.deliveryAddress.postalCode}</span>
                </p>
              </section>
              <section className="detail-section">
                <h4>
                  <Inventory2Outlined fontSize="small" /> Itens do pedido
                </h4>
                <div className="detail-items">
                  {order.items.map((item) => (
                    <div key={item.id}>
                      <span className="item-quantity">{item.quantity}×</span>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{money(item.unitPrice)} por unidade</small>
                      </div>
                      <b>{money(item.subtotal)}</b>
                    </div>
                  ))}
                </div>
                <div className="detail-total">
                  <span>Total</span>
                  <strong>{money(order.total)}</strong>
                </div>
              </section>
              <section className="detail-section">
                <h4>
                  <AccessTimeRounded fontSize="small" /> Caminho do pedido
                </h4>
                <ol className="order-timeline">
                  {order.history.map((event, index) => (
                    <li
                      key={`${event.status}-${index}`}
                      className={index === order.history.length - 1 ? 'current' : ''}
                    >
                      <span className="timeline-dot" />
                      <div>
                        <strong>{statusLabels[event.status]}</strong>
                        <time dateTime={event.changedAt}>{dateTime(event.changedAt)}</time>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
            <div className="detail-bottom">
              {order.allowedNextStatuses.length > 0 ? (
                <>
                  {order.allowedNextStatuses
                    .filter((status) => status !== 'CANCELADO')
                    .map((status) => (
                      <Button
                        key={status}
                        fullWidth
                        variant="contained"
                        endIcon={<ArrowForwardRounded />}
                        disabled={update.isPending}
                        onClick={() => changeStatus(status)}
                      >
                        {update.isPending
                          ? 'Atualizando...'
                          : status === 'EM_PREPARO'
                            ? 'Iniciar preparo'
                            : status === 'SAIU_PARA_ENTREGA'
                              ? 'Enviar para entrega'
                              : 'Confirmar entrega'}
                      </Button>
                    ))}
                  {order.allowedNextStatuses.includes('CANCELADO') && (
                    <Button
                      fullWidth
                      color="secondary"
                      disabled={update.isPending}
                      onClick={() => setConfirmCancel(true)}
                    >
                      Cancelar pedido
                    </Button>
                  )}
                </>
              ) : (
                <div className="terminal-message">
                  {order.status === 'ENTREGUE'
                    ? 'Entrega concluída. Mais um pedido bem cuidado.'
                    : 'Este pedido foi cancelado.'}
                </div>
              )}
            </div>
          </>
        )}
      </Drawer>
      <Dialog
        open={confirmCancel}
        onClose={update.isPending ? undefined : () => setConfirmCancel(false)}
        aria-labelledby="cancel-title"
      >
        <DialogTitle id="cancel-title">Cancelar este pedido?</DialogTitle>
        <DialogContent>
          O pedido será encerrado e não poderá voltar para o preparo.
          {update.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorMessage(update.error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmCancel(false)}
            disabled={update.isPending}
            color="secondary"
          >
            Voltar
          </Button>
          <Button
            variant="contained"
            onClick={() => changeStatus('CANCELADO')}
            disabled={update.isPending}
          >
            {update.isPending ? 'Cancelando...' : 'Sim, cancelar pedido'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
