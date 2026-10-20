import { expect, test } from '@playwright/test';

test('sincroniza duas sessões por SSE, recupera conexão e mantém isolamento', async ({
  page,
  browser,
  baseURL,
}) => {
  const email = 'live-' + Date.now() + '@example.com';
  const password = 'SenhaForte123!';
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('Seu nome').fill('Ana Tempo Real');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page.getByText('Atualizações em tempo real', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atualizar pedidos' })).toHaveCount(0);
  const secondContext = await browser.newContext({ baseURL });
  const second = await secondContext.newPage();
  try {
    await second.goto('/');
    await second.getByLabel('E-mail', { exact: true }).fill(email);
    await second.getByLabel('Senha', { exact: true }).fill(password);
    await second.getByRole('button', { name: 'Entrar na minha conta' }).click();
    await expect(second.getByText('Atualizações em tempo real', { exact: true })).toBeVisible();
    const csrf = (await second.request.get('/api/auth/csrf').then((r) => r.json())) as {
      headerName: string;
      token: string;
    };
    const create = async (customerName: string) => {
      const response = await second.request.post('/api/orders', {
        headers: { [csrf.headerName]: csrf.token },
        data: {
          customerName,
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
      expect(response.status()).toBe(201);
      return response.json() as Promise<{ id: string; version: number }>;
    };
    const order = await create('Cliente ao vivo');
    // Under the 10 s fallback interval: no refresh click, navigation or polling needed.
    await expect(
      page.getByRole('button', { name: 'Ver pedido de Cliente ao vivo' }).filter({ visible: true }),
    ).toBeVisible({ timeout: 5000 });
    await page
      .getByRole('button', { name: 'Ver pedido de Cliente ao vivo' })
      .filter({ visible: true })
      .click();
    const details = page.getByRole('dialog', { name: /^#/ });
    await expect(details.getByRole('button', { name: 'Iniciar preparo' })).toBeVisible();
    const changed = await second.request.patch('/api/orders/' + order.id + '/status', {
      headers: { [csrf.headerName]: csrf.token },
      data: { status: 'EM_PREPARO', expectedVersion: order.version },
    });
    expect(changed.status()).toBe(200);
    await expect(details.getByRole('button', { name: 'Enviar para entrega' })).toBeVisible({
      timeout: 5000,
    });
    await details.getByRole('button', { name: 'Fechar detalhes' }).click();

    await page.context().setOffline(true);
    await expect(page.getByText('Reconectando · atualização automática ativa')).toBeVisible();
    await create('Recebido durante queda');
    await page.context().setOffline(false);
    await expect(page.getByText('Atualizações em tempo real', { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole('button', { name: 'Ver pedido de Recebido durante queda' })
        .filter({ visible: true }),
    ).toBeVisible();

    await second
      .getByRole('button', { name: 'Sair da conta', exact: true })
      .filter({ visible: true })
      .click();
    await second.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await second.getByLabel('Seu nome').fill('Outra Conta');
    await second.getByLabel('E-mail', { exact: true }).fill('outsider-' + email);
    await second.getByLabel('Senha', { exact: true }).fill(password);
    await second.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(second.getByText('Atualizações em tempo real', { exact: true })).toBeVisible();
    await expect(second.getByRole('button', { name: 'Ver pedido de Cliente ao vivo' })).toHaveCount(
      0,
    );
    let foreignEvents = 0;
    page.on('response', (response) => {
      if (response.url().includes('/api/orders?')) foreignEvents++;
    });
    const otherCsrf = (await second.request.get('/api/auth/csrf').then((r) => r.json())) as {
      headerName: string;
      token: string;
    };
    const foreign = await second.request.post('/api/orders', {
      headers: { [otherCsrf.headerName]: otherCsrf.token },
      data: {
        customerName: 'Cliente privado',
        deliveryAddress: {
          street: 'Rua Dois',
          number: '20',
          neighborhood: 'Centro',
          city: 'Bauru',
          state: 'SP',
          postalCode: '17010000',
        },
        items: [{ name: 'Pizza', quantity: 1, unitPrice: 30 }],
      },
    });
    expect(foreign.status()).toBe(201);
    await expect(
      second
        .getByRole('button', { name: 'Ver pedido de Cliente privado' })
        .filter({ visible: true }),
    ).toBeVisible();
    expect(foreignEvents).toBe(0);
    await expect(page.getByRole('button', { name: 'Ver pedido de Cliente privado' })).toHaveCount(
      0,
    );
  } finally {
    await page.context().setOffline(false);
    await secondContext.close();
  }
});
