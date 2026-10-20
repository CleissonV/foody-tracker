import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../lib/api';
import type { Order } from '../../lib/types';
import { renderApp } from '../../test/render';
import { OrderDetails } from './OrderDetails';

const order: Order = {
  id: 'abc12345-1234-4321-1234-123456789012',
  customerName: 'Ana Silva',
  status: 'RECEBIDO',
  total: 59.8,
  version: 2,
  createdAt: '2026-10-20T12:00:00Z',
  updatedAt: '2026-10-20T12:00:00Z',
  deliveryAddress: {
    street: 'Rua Um',
    number: '42',
    neighborhood: 'Centro',
    city: 'Bauru',
    state: 'SP',
    postalCode: '17010-000',
  },
  items: [{ id: 'item', name: 'Pizza', quantity: 2, unitPrice: 29.9, subtotal: 59.8 }],
  history: [{ status: 'RECEBIDO', changedAt: '2026-10-20T12:00:00Z', changedBy: 'user' }],
  allowedNextStatuses: ['EM_PREPARO', 'CANCELADO'],
};

describe('detalhes e transições', () => {
  it('confirma cancelamento e envia a versão exibida', async () => {
    vi.spyOn(api, 'order').mockResolvedValue(order);
    const update = vi
      .spyOn(api, 'changeStatus')
      .mockResolvedValue({ ...order, status: 'CANCELADO', version: 3, allowedNextStatuses: [] });
    const user = userEvent.setup();
    renderApp(<OrderDetails id={order.id} onClose={vi.fn()} onUpdated={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Cancelar pedido' }));
    expect(update).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole('dialog', { name: 'Cancelar este pedido?' })).getByRole('button', {
        name: 'Sim, cancelar pedido',
      }),
    );
    expect(update).toHaveBeenCalledWith(order.id, 'CANCELADO', 2);
    expect(await screen.findByText('Este pedido foi cancelado.')).toBeInTheDocument();
  });

  it('mostra conflito e busca a versão atual sem repetir a escrita', async () => {
    const fetchOrder = vi.spyOn(api, 'order').mockResolvedValue(order);
    const update = vi.spyOn(api, 'changeStatus').mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'ORDER_CONFLICT',
        detail: 'O pedido foi alterado em outra sessão.',
      }),
    );
    const user = userEvent.setup();
    renderApp(<OrderDetails id={order.id} onClose={vi.fn()} onUpdated={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Iniciar preparo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O pedido foi alterado em outra sessão.',
    );
    expect(fetchOrder).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('não oferece ações para pedidos encerrados', async () => {
    vi.spyOn(api, 'order').mockResolvedValue({
      ...order,
      status: 'ENTREGUE',
      allowedNextStatuses: [],
    });
    renderApp(<OrderDetails id={order.id} onClose={vi.fn()} onUpdated={vi.fn()} />);
    expect(
      await screen.findByText('Entrega concluída. Mais um pedido bem cuidado.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
  });
});
