import { afterEach, expect, it, vi } from 'vitest';
import { formatPostalCode, lookupPostalCode } from './postalCode';
afterEach(() => vi.unstubAllGlobals());
it('normaliza o CEP e consulta sem cookies de autenticação', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        logradouro: 'Praça da Sé',
        bairro: 'Sé',
        localidade: 'São Paulo',
        uf: 'SP',
      }),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  expect(formatPostalCode('01001000')).toBe('01001-000');
  expect(await lookupPostalCode('01001-000', new AbortController().signal)).toEqual({
    street: 'Praça da Sé',
    neighborhood: 'Sé',
    city: 'São Paulo',
    state: 'SP',
  });
  expect(fetcher).toHaveBeenCalledWith(
    'https://viacep.com.br/ws/01001000/json/',
    expect.objectContaining({
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: expect.any(AbortSignal),
    }),
  );
});
it('rejeita formato inválido antes de chamar o serviço', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(lookupPostalCode('123', new AbortController().signal)).rejects.toThrow('8 dígitos');
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([{ erro: true }, { erro: 'true' }])('trata CEP inexistente: %j', async (data) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data))));
  await expect(lookupPostalCode('99999999', new AbortController().signal)).rejects.toThrow(
    'CEP não encontrado',
  );
});
it('aceita CEP de município sem rua e bairro', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ localidade: 'Cidade', uf: 'MG' }))),
  );
  expect(await lookupPostalCode('12345678', new AbortController().signal)).toEqual({
    street: '',
    neighborhood: '',
    city: 'Cidade',
    state: 'MG',
  });
});
it.each([null, { localidade: 'Cidade', uf: 'XX' }])(
  'rejeita retorno malformado: %j',
  async (data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data))));
    await expect(lookupPostalCode('01001000', new AbortController().signal)).rejects.toThrow(
      'Resposta inválida',
    );
  },
);
it('permite entrada manual após falha de rede ou timeout', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Timeout', 'TimeoutError')));
  await expect(lookupPostalCode('01001000', new AbortController().signal)).rejects.toThrow(
    'Preencha o endereço manualmente',
  );
});
