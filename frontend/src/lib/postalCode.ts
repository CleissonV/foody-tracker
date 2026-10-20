export const brazilianStates = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];
export interface PostalAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}
export const formatPostalCode = (value: string) =>
  value
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, '$1-$2');

export async function lookupPostalCode(
  postalCode: string,
  signal: AbortSignal,
): Promise<PostalAddress> {
  const digits = postalCode.replace('-', '');
  if (!/^\d{8}$/.test(digits)) throw new Error('Informe um CEP com 8 dígitos.');
  let data: unknown;
  try {
    const response = await fetch('https://viacep.com.br/ws/' + digits + '/json/', {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error('Upstream HTTP error');
    data = await response.json();
  } catch {
    throw new Error('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
  }
  if (!data || typeof data !== 'object')
    throw new Error('Resposta inválida na consulta. Preencha o endereço manualmente.');
  const value = data as Record<string, unknown>;
  if (value.erro === true || value.erro === 'true')
    throw new Error('CEP não encontrado. Preencha o endereço manualmente.');
  if (
    typeof value.localidade !== 'string' ||
    !value.localidade ||
    typeof value.uf !== 'string' ||
    !brazilianStates.includes(value.uf)
  )
    throw new Error('Resposta inválida na consulta. Preencha o endereço manualmente.');
  return {
    street: typeof value.logradouro === 'string' ? value.logradouro : '',
    neighborhood: typeof value.bairro === 'string' ? value.bairro : '',
    city: value.localidade,
    state: value.uf,
  };
}
