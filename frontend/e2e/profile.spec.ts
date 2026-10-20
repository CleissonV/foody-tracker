import { expect, test } from '@playwright/test';

test('edita perfil, envia/remove foto e troca credenciais com persistência', async ({ page }) => {
  const originalEmail = `perfil-${Date.now()}@example.com`;
  const newEmail = `atualizado-${Date.now()}@example.com`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('Seu nome').fill('Ana Oliveira');
  await page.getByLabel('E-mail', { exact: true }).fill(originalEmail);
  await page.getByLabel('Senha', { exact: true }).fill('SenhaForte123!');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page.getByRole('heading', { name: 'Olá, Ana', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir meu perfil', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meu perfil', exact: true })).toBeVisible();
  await page.getByLabel('Nome completo').fill('Ana Santos');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Seus dados foram atualizados.')).toBeVisible();

  await page.getByLabel('Selecionar foto de perfil').setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAL0lEQVR4AaXBMQEAMAyAMIav+n/mqRVB8v7MEkgkkUQSSSSRRBJJJJFEEkkkkUQHd+4CZf9MYGAAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByRole('img', { name: 'Prévia da nova foto' })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar foto' }).click();
  await expect(page.getByText('Foto de perfil atualizada.')).toBeVisible();
  const saved = (await page.request.get('/api/auth/me').then((response) => response.json())) as {
    avatarUrl: string;
  };
  expect(saved.avatarUrl).toContain('/api/profile/avatar?v=');
  expect((await page.request.get(saved.avatarUrl)).status()).toBe(200);
  await page.reload();
  await expect(page.getByLabel('Nome completo')).toHaveValue('Ana Santos');
  const photoSection = page.getByRole('region', { name: 'Foto de perfil' });
  await expect(photoSection.getByRole('img', { name: 'Foto de Ana Santos' })).toBeVisible();
  await photoSection.getByRole('button', { name: 'Remover', exact: true }).click();
  await expect(page.getByText('Foto de perfil removida.')).toBeVisible();

  await page.getByLabel('E-mail', { exact: true }).fill(newEmail);
  await page.getByLabel('Senha atual para alterar e-mail', { exact: true }).fill('SenhaForte123!');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByLabel('Senha atual para alterar e-mail')).toHaveCount(0);
  const security = page.getByRole('region', { name: 'Segurança da conta' });
  await security.getByLabel('Senha atual', { exact: true }).fill('SenhaForte123!');
  await security.getByLabel('Nova senha', { exact: true }).fill('NovaSenha123!');
  await security.getByLabel('Confirmar nova senha', { exact: true }).fill('NovaSenha123!');
  await security.getByRole('button', { name: 'Atualizar senha' }).click();
  await expect(
    page.getByText('Senha atualizada. As outras sessões serão encerradas.'),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Sair da conta', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByLabel('E-mail', { exact: true }).fill(newEmail);
  await page.getByLabel('Senha', { exact: true }).fill('NovaSenha123!');
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(page.getByRole('heading', { name: 'Meu perfil', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nome completo')).toHaveValue('Ana Santos');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
});
