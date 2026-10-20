import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api';
import type { User } from '../../lib/types';
import { renderApp } from '../../test/render';
import { ProfilePage } from './ProfilePage';

const account: User = {
  id: 'user',
  name: 'Ana Oliveira',
  email: 'ana@example.com',
  version: 3,
  avatarUrl: null,
};
beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:preview'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

describe('perfil', () => {
  it('salva dados com a versão atual e atualiza o usuário da aplicação', async () => {
    const updated = { ...account, name: 'Ana Santos', version: 4 };
    const save = vi.spyOn(api, 'updateProfile').mockResolvedValue(updated);
    const user = userEvent.setup();
    const { client } = renderApp(<ProfilePage user={account} />);
    const name = screen.getByLabelText('Nome completo');
    await user.clear(name);
    await user.type(name, updated.name);
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(save.mock.calls[0][0]).toEqual({
      name: updated.name,
      email: account.email,
      expectedVersion: 3,
    });
    await waitFor(() => expect(client.getQueryData(['auth'])).toEqual(updated));
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled();
  });

  it('mostra prévia e envia a foto somente após confirmação', async () => {
    const upload = vi
      .spyOn(api, 'uploadAvatar')
      .mockResolvedValue({ ...account, avatarUrl: '/api/profile/avatar?v=1', version: 4 });
    const user = userEvent.setup();
    renderApp(<ProfilePage user={account} />);
    const file = new File(['image-content'], 'foto.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Selecionar foto de perfil'), file);
    expect(await screen.findByRole('img', { name: 'Prévia da nova foto' })).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Salvar foto' }));
    expect(upload.mock.calls[0][0]).toBe(file);
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview'));
  });

  it('rejeita arquivo com mais de 2 MB antes de enviar', async () => {
    const upload = vi.spyOn(api, 'uploadAvatar');
    const user = userEvent.setup();
    renderApp(<ProfilePage user={account} />);
    const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', {
      type: 'image/png',
    });
    await user.upload(screen.getByLabelText('Selecionar foto de perfil'), file);
    expect(await screen.findByRole('alert')).toHaveTextContent('Escolha uma imagem de até 2 MB.');
    expect(upload).not.toHaveBeenCalled();
  });

  it('impede troca de senha quando a confirmação não coincide', async () => {
    const save = vi.spyOn(api, 'changePassword');
    const user = userEvent.setup();
    renderApp(<ProfilePage user={account} />);
    const security = within(screen.getByRole('region', { name: 'Segurança da conta' }));
    await user.type(security.getByLabelText('Senha atual', { exact: true }), 'Atual123!');
    await user.type(security.getByLabelText('Nova senha', { exact: true }), 'Nova12345!');
    await user.type(security.getByLabelText('Confirmar nova senha'), 'Outra12345!');
    await user.click(security.getByRole('button', { name: 'Atualizar senha' }));
    expect(await security.findByText('As senhas não coincidem.')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
});
