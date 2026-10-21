import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { OrdersPage } from './OrdersPage';
import { api } from '../../lib/api';
import { renderApp } from '../../test/render';
import type { OrderSummary } from '../../lib/types';

const order: OrderSummary = {
  id: 'abcd1234-1111-4111-8111-111111111111',
  customerName: 'Maria Busca',
  status: 'RECEBIDO',
  itemCount: 1,
  total: 30,
  createdAt: '2026-10-20T12:00:00Z',
  updatedAt: '2026-10-20T12:00:00Z',
  version: 0,
  allowedNextStatuses: ['EM_PREPARO', 'CANCELADO'],
  deliveryAddress: {
    street: 'Rua Um',
    number: '10',
    neighborhood: 'Centro',
    city: 'Bauru',
    state: 'SP',
    postalCode: '17010-000',
  },
};
const userData = { id: 'user', name: 'Ana', email: 'ana@example.com', version: 0 };
function setup() {
  vi.spyOn(api, 'stats').mockResolvedValue({
    total: 1,
    counts: { RECEBIDO: 1, EM_PREPARO: 0, SAIU_PARA_ENTREGA: 0, ENTREGUE: 0, CANCELADO: 0 },
  });
  return vi.spyOn(api, 'orders').mockImplementation(async (_page, _status, search) => ({
    content: search === '00000000' ? [] : [order],
    page: 0,
    size: 12,
    totalElements: search === '00000000' ? 0 : 1,
    totalPages: search === '00000000' ? 0 : 1,
  }));
}
it('busca o ID no servidor, combina status e limpa o campo', async () => {
  const orders = setup();
  const user = userEvent.setup();
  renderApp(<OrdersPage user={userData} />);
  await user.type(screen.getByLabelText('Buscar pedido por ID'), '#ABCD1234');
  await waitFor(() =>
    expect(orders).toHaveBeenCalledWith(0, undefined, '#ABCD1234', expect.any(AbortSignal)),
  );
  await user.click(screen.getByRole('button', { name: /^Recebido/ }));
  await waitFor(() =>
    expect(orders).toHaveBeenCalledWith(0, 'RECEBIDO', '#ABCD1234', expect.any(AbortSignal)),
  );
  await user.click(screen.getByRole('button', { name: 'Limpar busca' }));
  expect(screen.getByLabelText('Buscar pedido por ID')).toHaveValue('');
  await waitFor(() =>
    expect(orders).toHaveBeenCalledWith(0, 'RECEBIDO', '', expect.any(AbortSignal)),
  );
});
it('mostra estado vazio específico da busca e permite recuperar a listagem', async () => {
  setup();
  const user = userEvent.setup();
  renderApp(<OrdersPage user={userData} />);
  await user.type(screen.getByLabelText('Buscar pedido por ID'), '00000000');
  expect(
    await screen.findByRole('heading', { name: 'Nenhum pedido encontrado.' }),
  ).toBeInTheDocument();
  await user.click(screen.getAllByRole('button', { name: 'Limpar busca' })[0]);
  await waitFor(() =>
    expect(
      screen.queryByRole('heading', { name: 'Nenhum pedido encontrado.' }),
    ).not.toBeInTheDocument(),
  );
});
