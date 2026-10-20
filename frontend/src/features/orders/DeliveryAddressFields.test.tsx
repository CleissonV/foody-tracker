import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { useForm } from 'react-hook-form';
import { renderApp } from '../../test/render';
import type { CreateOrder } from '../../lib/types';
import * as postal from '../../lib/postalCode';
import { DeliveryAddressFields } from './DeliveryAddressFields';

function Form() {
  const form = useForm<CreateOrder>({
    defaultValues: {
      customerName: '',
      items: [],
      deliveryAddress: {
        postalCode: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: 'SP',
      },
    },
  });
  return <DeliveryAddressFields form={form} />;
}
const found = {
  street: 'Rua São José',
  neighborhood: 'Centro',
  city: 'Rio de Janeiro',
  state: 'RJ',
};

it('mostra CEP primeiro, consulta somente ao completar e preenche a UF controlada', async () => {
  const lookup = vi.spyOn(postal, 'lookupPostalCode').mockResolvedValue(found);
  const user = userEvent.setup();
  const { container } = renderApp(<Form />);
  expect(container.querySelector('input')?.name).toBe('deliveryAddress.postalCode');
  await user.type(screen.getByLabelText('CEP'), '20040');
  expect(lookup).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('CEP'), '002');
  await waitFor(() => expect(screen.getByLabelText('Rua / Avenida')).toHaveValue('Rua São José'));
  expect(screen.getByLabelText('CEP')).toHaveValue('20040-002');
  expect(screen.getByLabelText('Cidade')).toHaveValue('Rio de Janeiro');
  expect(screen.getByRole('combobox', { name: 'UF' })).toHaveTextContent('RJ');
});

it('preserva edições durante a consulta e ignora uma resposta de CEP anterior', async () => {
  let finishFirst!: (address: postal.PostalAddress) => void;
  let finishSecond!: (address: postal.PostalAddress) => void;
  const lookup = vi
    .spyOn(postal, 'lookupPostalCode')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSecond = resolve;
        }),
    );
  const user = userEvent.setup();
  renderApp(<Form />);
  await user.type(screen.getByLabelText('CEP'), '01001000');
  await user.clear(screen.getByLabelText('CEP'));
  expect(lookup.mock.calls[0][1].aborted).toBe(true);
  await user.type(screen.getByLabelText('CEP'), '20040002');
  await user.type(screen.getByLabelText('Rua / Avenida'), 'Rua informada pelo cliente');
  await user.type(screen.getByLabelText('Número'), '42');
  await user.type(screen.getByLabelText('Complemento (opcional)'), 'Apartamento 101');
  await act(async () => finishSecond(found));
  expect(screen.getByLabelText('Rua / Avenida')).toHaveValue('Rua informada pelo cliente');
  expect(screen.getByLabelText('Cidade')).toHaveValue('Rio de Janeiro');
  expect(screen.getByLabelText('Número')).toHaveValue('42');
  expect(screen.getByLabelText('Complemento (opcional)')).toHaveValue('Apartamento 101');
  await act(async () =>
    finishFirst({ street: 'Praça da Sé', neighborhood: 'Sé', city: 'São Paulo', state: 'SP' }),
  );
  expect(screen.getByLabelText('Cidade')).toHaveValue('Rio de Janeiro');
  expect(screen.getByRole('combobox', { name: 'UF' })).toHaveTextContent('RJ');
});

it('limpa o preenchimento automático do CEP antigo e permite preencher manualmente na falha', async () => {
  vi.spyOn(postal, 'lookupPostalCode')
    .mockResolvedValueOnce(found)
    .mockRejectedValueOnce(new Error('CEP não encontrado. Preencha o endereço manualmente.'));
  const user = userEvent.setup();
  renderApp(<Form />);
  await user.type(screen.getByLabelText('CEP'), '20040002');
  await waitFor(() => expect(screen.getByLabelText('Cidade')).toHaveValue('Rio de Janeiro'));
  await user.clear(screen.getByLabelText('CEP'));
  expect(screen.getByLabelText('Cidade')).toHaveValue('');
  await user.type(screen.getByLabelText('CEP'), '99999999');
  expect(
    await screen.findByText('CEP não encontrado. Preencha o endereço manualmente.'),
  ).toBeInTheDocument();
  await user.type(screen.getByLabelText('Cidade'), 'Cidade informada');
  expect(screen.getByLabelText('Cidade')).toHaveValue('Cidade informada');
});
