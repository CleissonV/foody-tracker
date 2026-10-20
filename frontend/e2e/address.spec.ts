import { expect, test } from '@playwright/test';

test('consulta CEP, altera UF e persiste o endereço no pedido', async ({ page }) => {
  await page.route('https://viacep.com.br/ws/**', (route) =>
    route.fulfill({
      json: route.request().url().includes('99999999')
        ? { erro: true }
        : { logradouro: 'Rua São José', bairro: 'Centro', localidade: 'Rio de Janeiro', uf: 'RJ' },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('Seu nome').fill('Ana Endereços');
  await page.getByLabel('E-mail', { exact: true }).fill('address-' + Date.now() + '@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('SenhaForte123!');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await page.getByRole('button', { name: 'Novo pedido', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Novo pedido', exact: true });
  await expect(form.locator('.address-fields input').first()).toHaveAttribute(
    'name',
    'deliveryAddress.postalCode',
  );
  await form.getByLabel('CEP').fill('99999999');
  await expect(
    form.getByText('CEP não encontrado. Preencha o endereço manualmente.'),
  ).toBeVisible();
  await form.getByLabel('CEP').fill('20040002');
  await expect(form.getByLabel('Rua / Avenida')).toHaveValue('Rua São José');
  await expect(form.getByLabel('Bairro')).toHaveValue('Centro');
  await expect(form.getByLabel('Cidade')).toHaveValue('Rio de Janeiro');
  await expect(form.getByRole('combobox', { name: 'UF' })).toHaveText('RJ');
  await form.getByLabel('Nome do cliente').fill('Cliente CEP');
  await form.getByRole('textbox', { name: 'Item 1', exact: true }).fill('Pizza');
  await form.getByLabel('Preço un. (R$)').fill('30');
  await form.getByLabel('Número', { exact: true }).fill('42');
  await form.getByLabel('Complemento (opcional)').fill('Apartamento 101');
  const response = page.waitForResponse(
    (response) => response.url().endsWith('/api/orders') && response.request().method() === 'POST',
  );
  await form.getByRole('button', { name: 'Criar pedido', exact: true }).click();
  const saved = await response;
  expect(saved.status()).toBe(201);
  const order = (await saved.json()) as { deliveryAddress: Record<string, string> };
  expect(order.deliveryAddress).toMatchObject({
    street: 'Rua São José',
    number: '42',
    complement: 'Apartamento 101',
    city: 'Rio de Janeiro',
    state: 'RJ',
    postalCode: '20040-002',
  });
  await expect(
    page.getByRole('dialog', { name: /^#/ }).getByText('Cliente CEP', { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
