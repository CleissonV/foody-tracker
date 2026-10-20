import { expect, test } from '@playwright/test';

test('cadastro, criação, entrega, persistência de sessão e logout', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('Seu nome').fill('Ana Oliveira');
  await page.getByLabel('E-mail', { exact: true }).fill(`ana-${Date.now()}@example.com`);
  await page.getByLabel('Senha', { exact: true }).fill('SenhaForte123!');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page.getByRole('heading', { name: 'Olá, Ana' })).toBeVisible();
  await expect(page.getByText('Sua próxima entrega começa aqui.', { exact: true })).toBeVisible();
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === 'FOODY_SESSION');
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe('Lax');

  await page.getByRole('button', { name: 'Novo pedido', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Novo pedido', exact: true });
  await form.getByRole('button', { name: 'Criar pedido', exact: true }).click();
  await expect(form.getByText('Campo obrigatório.').first()).toBeVisible();
  await form.getByLabel('Nome do cliente').fill('Maria Silva');
  await form.getByRole('textbox', { name: 'Item 1', exact: true }).fill('Pizza da casa');
  await form.getByLabel('Qtd.', { exact: true }).fill('2');
  await form.getByLabel('Preço un. (R$)', { exact: true }).fill('29.90');
  await form.getByLabel('Rua / Avenida').fill('Rua das Flores');
  await form.getByLabel('Número', { exact: true }).fill('42');
  await form.getByLabel('Bairro').fill('Centro');
  await form.getByLabel('Cidade').fill('Bauru');
  await form.getByLabel('CEP').fill('17010-000');
  await form.getByRole('button', { name: 'Criar pedido', exact: true }).click();
  const details = page.getByRole('dialog', { name: /^#/ });
  await expect(details.getByText('Maria Silva', { exact: true })).toBeVisible();
  await expect(details.getByText('Pizza da casa')).toBeVisible();
  await details.getByRole('button', { name: 'Iniciar preparo' }).click();
  await details.getByRole('button', { name: 'Enviar para entrega' }).click();
  await details.getByRole('button', { name: 'Confirmar entrega' }).click();
  await expect(details.getByText('Entrega concluída. Mais um pedido bem cuidado.')).toBeVisible();
  await details.getByRole('button', { name: 'Fechar detalhes' }).click();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Olá, Ana' })).toBeVisible();
  await page
    .getByRole('group', { name: 'Filtrar por status' })
    .getByRole('button', { name: /^Entregue/ })
    .click();
  await expect(
    page.getByRole('button', { name: 'Ver pedido de Maria Silva' }).filter({ visible: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Sair da conta', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole('button', { name: 'Entrar na minha conta' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('cancelamento exige confirmação e é terminal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('Seu nome').fill('Carlos Santos');
  await page.getByLabel('E-mail', { exact: true }).fill(`carlos-${Date.now()}@example.com`);
  await page.getByLabel('Senha', { exact: true }).fill('SenhaForte123!');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page.getByRole('heading', { name: 'Olá, Carlos' })).toBeVisible();
  // Prepare a real order via the authenticated browser's same-origin HTTP context.
  const csrf = (await page.request.get('/api/auth/csrf').then((response) => response.json())) as {
    headerName: string;
    token: string;
  };
  const created = await page.request.post('/api/orders', {
    headers: { [csrf.headerName]: csrf.token },
    data: {
      customerName: 'João Souza',
      deliveryAddress: {
        street: 'Rua Um',
        number: '10',
        neighborhood: 'Centro',
        city: 'Bauru',
        state: 'SP',
        postalCode: '17010000',
      },
      items: [{ name: 'Hambúrguer', quantity: 1, unitPrice: 24.9 }],
    },
  });
  expect(created.status()).toBe(201);
  await page
    .getByRole('button', { name: 'Ver pedido de João Souza' })
    .filter({ visible: true })
    .click();
  const details = page.getByRole('dialog', { name: /^#/ });
  await details.getByRole('button', { name: 'Cancelar pedido', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Cancelar este pedido?' })
    .getByRole('button', { name: 'Sim, cancelar pedido' })
    .click();
  await expect(details.getByText('Este pedido foi cancelado.')).toBeVisible();
  await expect(details.getByRole('button', { name: 'Iniciar preparo' })).toHaveCount(0);
});
