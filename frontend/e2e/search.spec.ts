import { expect, test } from '@playwright/test';

test('busca ID abreviado/completo em outras páginas, combina status e limpa', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('Seu nome').fill('Ana Busca');
  await page.getByLabel('E-mail', { exact: true }).fill('search-' + Date.now() + '@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('SenhaForte123!');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page.getByRole('heading', { name: 'Olá, Ana', exact: true })).toBeVisible();
  const csrf = (await page.request.get('/api/auth/csrf').then((r) => r.json())) as {
    headerName: string;
    token: string;
  };
  const ids: string[] = [];
  for (let i = 0; i < 13; i++) {
    const result = await page.request.post('/api/orders', {
      headers: { [csrf.headerName]: csrf.token },
      data: {
        customerName: 'Cliente busca ' + i,
        deliveryAddress: {
          street: 'Rua Um',
          number: '10',
          neighborhood: 'Centro',
          city: 'Bauru',
          state: 'SP',
          postalCode: '17010000',
        },
        items: [{ name: 'Pizza', quantity: 1, unitPrice: 30 }],
      },
    });
    expect(result.status()).toBe(201);
    ids.push(((await result.json()) as { id: string }).id);
  }
  await expect(page.getByText('13 pedidos · página 1 de 2', { exact: true })).toBeVisible();
  const visibleOrder = (name: string) =>
    page
      .getByRole('button', { name: 'Ver pedido de ' + name, exact: true })
      .filter({ visible: true });
  await expect(visibleOrder('Cliente busca 0')).toHaveCount(0);
  const search = page.getByLabel('Buscar pedido por ID');
  await search.fill('#' + ids[0].slice(0, 8).toUpperCase());
  await expect(page.getByText('1 pedido · página 1 de 1', { exact: true })).toBeVisible();
  await expect(visibleOrder('Cliente busca 0')).toBeVisible();
  await page.getByRole('button', { name: 'Limpar busca', exact: true }).click();
  await expect(page.getByText('13 pedidos · página 1 de 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await expect(page.getByText('13 pedidos · página 2 de 2', { exact: true })).toBeVisible();
  await search.fill(ids[12]);
  await expect(page.getByText('1 pedido · página 1 de 1', { exact: true })).toBeVisible();
  await expect(visibleOrder('Cliente busca 12')).toBeVisible();
  await page
    .getByRole('group', { name: 'Filtrar por status' })
    .getByRole('button', { name: /^Entregue/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Nenhum pedido encontrado.' })).toBeVisible();
  await page
    .getByRole('group', { name: 'Filtrar por status' })
    .getByRole('button', { name: /^Recebido/ })
    .click();
  await expect(visibleOrder('Cliente busca 12')).toBeVisible();
  await search.fill('00000000-0000-0000-0000-000000000000');
  await expect(page.getByRole('heading', { name: 'Nenhum pedido encontrado.' })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar busca', exact: true }).first().click();
  await expect(page.getByText('13 pedidos · página 1 de 2', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
