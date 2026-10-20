import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../lib/api';
import { renderApp } from '../../test/render';
import { AuthPage } from './AuthPage';

describe('autenticação', () => {
  it('valida campos antes de enviar credenciais', async () => {
    const login = vi.spyOn(api, 'login');
    const user = userEvent.setup();
    renderApp(<AuthPage onLogin={vi.fn()} sessionExpired={false} />);
    await user.click(screen.getByRole('button', { name: 'Entrar na minha conta' }));
    expect(await screen.findByText('Informe seu e-mail.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('exibe credenciais inválidas sem autenticar', async () => {
    vi.spyOn(api, 'login').mockRejectedValue(
      new ApiError({ status: 401, code: 'UNAUTHORIZED', detail: 'E-mail ou senha inválidos.' }),
    );
    const onLogin = vi.fn();
    const user = userEvent.setup();
    renderApp(<AuthPage onLogin={onLogin} sessionExpired={false} />);
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'senhaerrada');
    await user.click(screen.getByRole('button', { name: 'Entrar na minha conta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.');
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('cadastra e autentica pelo mesmo fluxo', async () => {
    const account = { id: '1', name: 'Ana', email: 'ana@example.com', version: 0 };
    const register = vi.spyOn(api, 'register').mockResolvedValue(account);
    vi.spyOn(api, 'login').mockResolvedValue(account);
    const onLogin = vi.fn();
    const user = userEvent.setup();
    renderApp(<AuthPage onLogin={onLogin} sessionExpired={false} />);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await user.type(screen.getByLabelText('Seu nome'), 'Ana');
    await user.type(screen.getByLabelText('E-mail'), account.email);
    await user.type(screen.getByLabelText('Senha'), 'SenhaForte123!');
    await user.click(screen.getByRole('button', { name: 'Criar minha conta' }));
    expect(register).toHaveBeenCalledWith({
      name: 'Ana',
      email: account.email,
      password: 'SenhaForte123!',
    });
    expect(onLogin).toHaveBeenCalledWith(account);
  });
});
