import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import AddRounded from '@mui/icons-material/AddRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import { api, errorMessage } from '../../lib/api';
import type { CreateOrder } from '../../lib/types';
import { money } from '../../lib/types';
import { DeliveryAddressFields } from './DeliveryAddressFields';

const required = (maxLength: number) => ({
  required: 'Campo obrigatório.',
  maxLength: { value: maxLength, message: `Use até ${maxLength} caracteres.` },
  validate: (value: unknown) =>
    (typeof value === 'string' && !!value.trim()) || 'Campo obrigatório.',
});

export function CreateOrderDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const client = useQueryClient();
  const form = useForm<CreateOrder>({
    defaultValues: {
      customerName: '',
      deliveryAddress: {
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: 'SP',
        postalCode: '',
      },
      items: [{ name: '', quantity: 1, unitPrice: 0 }],
    },
  });
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' });
  const totalCents = items.reduce(
    (sum, item) =>
      sum + Math.round((Number(item.unitPrice) || 0) * 100) * (Number(item.quantity) || 0),
    0,
  );
  const create = useMutation({
    mutationFn: api.create,
    onSuccess: async (order) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['orders'] }),
        client.invalidateQueries({ queryKey: ['stats'] }),
      ]);
      onCreated(order.id);
    },
  });
  const submit = handleSubmit((values) => create.mutate(values));

  return (
    <Dialog
      open
      onClose={create.isPending ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="create-order-title"
    >
      <DialogTitle id="create-order-heading" className="dialog-heading">
        <span id="create-order-title">Novo pedido</span>
        <IconButton aria-label="Fechar formulário" onClick={onClose} disabled={create.isPending}>
          <CloseRounded />
        </IconButton>
      </DialogTitle>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        noValidate
      >
        <DialogContent dividers>
          <p className="dialog-intro">Preencha os dados. A próxima boa entrega começa aqui.</p>
          {create.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage(create.error)}
            </Alert>
          )}
          <div className="form-section-title">
            <span>01</span> Quem vai receber?
          </div>
          <TextField
            label="Nome do cliente"
            autoFocus
            {...register('customerName', required(100))}
            error={!!errors.customerName}
            helperText={errors.customerName?.message}
          />
          <div className="form-section-title">
            <span>02</span> O que vai no pedido?
          </div>
          <div className="item-fields-list">
            {fields.map((field, index) => (
              <div key={field.id} className="item-fields">
                <TextField
                  label={`Item ${index + 1}`}
                  {...register(`items.${index}.name`, required(120))}
                  error={!!errors.items?.[index]?.name}
                  helperText={errors.items?.[index]?.name?.message}
                />
                <TextField
                  label="Qtd."
                  type="number"
                  slotProps={{ htmlInput: { min: 1, max: 999, step: 1 } }}
                  {...register(`items.${index}.quantity`, {
                    valueAsNumber: true,
                    required: 'Informe a quantidade.',
                    min: { value: 1, message: 'Mínimo 1.' },
                    max: { value: 999, message: 'Máximo 999.' },
                    validate: (value) => Number.isInteger(value) || 'Use um inteiro.',
                  })}
                  error={!!errors.items?.[index]?.quantity}
                  helperText={errors.items?.[index]?.quantity?.message}
                />
                <TextField
                  label="Preço un. (R$)"
                  type="number"
                  slotProps={{ htmlInput: { min: 0, max: 999999.99, step: '0.01' } }}
                  {...register(`items.${index}.unitPrice`, {
                    valueAsNumber: true,
                    required: 'Informe o preço.',
                    min: { value: 0, message: 'Mínimo zero.' },
                    max: { value: 999999.99, message: 'Valor muito alto.' },
                    validate: (value) =>
                      (Number.isFinite(value) &&
                        Math.abs(value * 100 - Math.round(value * 100)) < 0.00001) ||
                      'Use até 2 casas decimais.',
                  })}
                  error={!!errors.items?.[index]?.unitPrice}
                  helperText={errors.items?.[index]?.unitPrice?.message}
                />
                <IconButton
                  aria-label={`Remover item ${index + 1}`}
                  onClick={() => remove(index)}
                  disabled={fields.length === 1 || create.isPending}
                  size="small"
                >
                  <DeleteOutlineRounded fontSize="small" />
                </IconButton>
              </div>
            ))}
          </div>
          <Button
            startIcon={<AddRounded />}
            size="small"
            onClick={() => append({ name: '', quantity: 1, unitPrice: 0 })}
            disabled={fields.length >= 50 || create.isPending}
          >
            Adicionar item
          </Button>
          <div className="form-section-title">
            <span>03</span> Onde vamos entregar?
          </div>
          <DeliveryAddressFields form={form} disabled={create.isPending} />
        </DialogContent>
        <DialogActions className="create-actions">
          <div className="order-form-total">
            <small>Total do pedido</small>
            <strong>{money(totalCents / 100)}</strong>
          </div>
          <Button onClick={onClose} color="secondary" disabled={create.isPending}>
            Cancelar
          </Button>
          <Button variant="contained" type="submit" disabled={create.isPending}>
            {create.isPending ? 'Criando...' : 'Criar pedido'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
