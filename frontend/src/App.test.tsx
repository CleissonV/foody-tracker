import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { App } from './App';
import { api, ApiError } from './lib/api';
import { renderApp } from './test/render';

it('atualiza a tela no login/logout e elimina o cache privado sem perder o observador de sessão', async () => {
  vi.spyOn(api, 'me').mockRejectedValue(
    new ApiError({ status: 401, code: 'UNAUTHORIZED', detail: 'Entre novamente.' }),
  );
  vi.spyOn(api, 'login').mockResolvedValue({
    id: 'user',
    name: 'Ana Silva',
    email: 'ana@example.com',
  });
  vi.spyOn(api, 'logout').mockResolvedValue(undefined);
  vi.spyOn(api, 'orders').mockResolvedValue({
    content: [],
    page: 0,
    size: 12,
    totalElements: 0,
    totalPages: 0,
  });
  vi.spyOn(api, 'stats').mockResolvedValue({
    total: 0,
    counts: { RECEBIDO: 0, EM_PREPARO: 0, SAIU_PARA_ENTREGA: 0, ENTREGUE: 0, CANCELADO: 0 },
  });
  const user = userEvent.setup();
  const { client } = renderApp(<App />);
  client.setQueryData(['order', 'previous-account'], { customerName: 'Private customer' });
  await user.type(await screen.findByLabelText('E-mail'), 'ana@example.com');
  await user.type(screen.getByLabelText('Senha'), 'SenhaForte123!');
  await user.click(screen.getByRole('button', { name: 'Entrar na minha conta' }));
  expect(
    await screen.findByRole('heading', { name: /^Olá, Ana/ }, { timeout: 5000 }),
  ).toBeInTheDocument();
  expect(client.getQueryData(['order', 'previous-account'])).toBeUndefined();
  await user.click(screen.getAllByRole('button', { name: 'Sair da conta' })[0]);
  expect(await screen.findByRole('button', { name: 'Entrar na minha conta' })).toBeInTheDocument();
  expect(client.getQueryData(['auth'])).toBeNull();
  expect(client.getQueryData(['stats'])).toBeUndefined();
});
