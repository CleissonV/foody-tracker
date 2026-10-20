import { useEffect, useRef, useState } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import type { CreateOrder } from '../../lib/types';
import {
  brazilianStates,
  formatPostalCode,
  lookupPostalCode,
  type PostalAddress,
} from '../../lib/postalCode';

const addressKeys = ['street', 'neighborhood', 'city', 'state'] as const;
type AddressPath =
  | 'deliveryAddress.street'
  | 'deliveryAddress.neighborhood'
  | 'deliveryAddress.city'
  | 'deliveryAddress.state';
const addressPath = (key: keyof PostalAddress) => ('deliveryAddress.' + key) as AddressPath;
const textFields = [
  { name: 'deliveryAddress.street', label: 'Rua / Avenida', max: 150, className: 'address-street' },
  { name: 'deliveryAddress.number', label: 'Número', max: 20, className: 'address-number' },
  {
    name: 'deliveryAddress.complement',
    label: 'Complemento (opcional)',
    max: 100,
    className: 'address-complement',
  },
  {
    name: 'deliveryAddress.neighborhood',
    label: 'Bairro',
    max: 100,
    className: 'address-neighborhood',
  },
  { name: 'deliveryAddress.city', label: 'Cidade', max: 100, className: 'address-city' },
] as const;

export function DeliveryAddressFields({
  form,
  disabled = false,
}: {
  form: UseFormReturn<CreateOrder>;
  disabled?: boolean;
}) {
  const { control, getValues, setValue } = form;
  const request = useRef<AbortController | undefined>(undefined);
  const autofilled = useRef<Partial<PostalAddress>>({});
  const [lookup, setLookup] = useState<{ loading: boolean; message?: string; failed?: boolean }>({
    loading: false,
  });
  useEffect(() => () => request.current?.abort(), []);

  const search = async (postalCode: string) => {
    request.current?.abort();
    request.current = undefined;
    for (const key of addressKeys) {
      if (
        autofilled.current[key] !== undefined &&
        getValues(addressPath(key)) === autofilled.current[key]
      ) {
        setValue(addressPath(key), '', { shouldDirty: true });
      }
    }
    autofilled.current = {};
    if (postalCode.replace('-', '').length !== 8) {
      setLookup({ loading: false });
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    const before = { ...getValues('deliveryAddress') };
    setLookup({ loading: true });
    try {
      const address = await lookupPostalCode(postalCode, controller.signal);
      if (controller.signal.aborted || request.current !== controller) return;
      for (const key of addressKeys) {
        // Preserve a manual edit made while the request was in flight.
        if (getValues(addressPath(key)) === before[key]) {
          setValue(addressPath(key), address[key], { shouldDirty: true, shouldValidate: true });
          autofilled.current[key] = address[key];
        }
      }
      setLookup({
        loading: false,
        message: 'CEP localizado. Confira o endereço e complete número e complemento.',
      });
    } catch (error) {
      if (controller.signal.aborted || request.current !== controller) return;
      setLookup({
        loading: false,
        failed: true,
        message: error instanceof Error ? error.message : 'Preencha o endereço manualmente.',
      });
    }
  };

  return (
    <div className="address-fields">
      <Controller
        name="deliveryAddress.postalCode"
        control={control}
        rules={{
          required: 'Informe o CEP.',
          pattern: { value: /^\d{5}-?\d{3}$/, message: 'Use um CEP com 8 dígitos.' },
        }}
        render={({ field: { ref, ...field }, fieldState }) => (
          <TextField
            {...field}
            inputRef={ref}
            className="address-postal-code"
            label="CEP"
            placeholder="00000-000"
            disabled={disabled}
            onChange={(event) => {
              const formatted = formatPostalCode(event.target.value);
              if (formatted === field.value) return;
              field.onChange(formatted);
              void search(formatted);
            }}
            error={!!fieldState.error || !!lookup.failed}
            helperText={
              fieldState.error?.message ??
              (lookup.loading
                ? 'Buscando endereço...'
                : (lookup.message ?? 'Digite o CEP para preencher o endereço automaticamente.'))
            }
            slotProps={{
              htmlInput: {
                inputMode: 'numeric',
                autoComplete: 'postal-code',
                maxLength: 9,
                'aria-busy': lookup.loading,
              },
              input: {
                endAdornment: lookup.loading ? (
                  <InputAdornment position="end">
                    <CircularProgress size={18} aria-label="Buscando endereço pelo CEP" />
                  </InputAdornment>
                ) : undefined,
              },
              formHelperText: { role: 'status' },
            }}
          />
        )}
      />
      {textFields.map((config) => (
        <Controller
          key={config.name}
          name={config.name}
          control={control}
          rules={{
            required: config.name === 'deliveryAddress.complement' ? false : 'Campo obrigatório.',
            maxLength: { value: config.max, message: 'Use até ' + config.max + ' caracteres.' },
            validate: (value) =>
              config.name === 'deliveryAddress.complement' ||
              !!value?.trim() ||
              'Campo obrigatório.',
          }}
          render={({ field: { ref, ...field }, fieldState }) => (
            <TextField
              {...field}
              inputRef={ref}
              value={field.value ?? ''}
              className={config.className}
              label={config.label}
              disabled={disabled}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
            />
          )}
        />
      ))}
      <Controller
        name="deliveryAddress.state"
        control={control}
        rules={{ required: 'Informe a UF.' }}
        render={({ field: { ref, ...field }, fieldState }) => (
          <TextField
            {...field}
            inputRef={ref}
            className="address-state"
            label="UF"
            select
            disabled={disabled}
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
          >
            {brazilianStates.map((state) => (
              <MenuItem key={state} value={state}>
                {state}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
    </div>
  );
}
