import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import EastRounded from '@mui/icons-material/EastRounded';
import AlternateEmailRounded from '@mui/icons-material/AlternateEmailRounded';
import LockOutlined from '@mui/icons-material/LockOutlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import { api, errorMessage } from '../../lib/api';
import type { User } from '../../lib/types';
import { OrderIllustration } from '../../components/OrderIllustration';

interface Fields {
  name: string;
  email: string;
  password: string;
}

export function AuthPage({
  onLogin,
  sessionExpired,
}: {
  onLogin: (user: User) => void;
  sessionExpired: boolean;
}) {
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Fields>();

  const submit = handleSubmit(async (fields) => {
    setError('');
    try {
      const credentials = { email: fields.email.trim(), password: fields.password };
      if (registering) {
        await api.register({ ...credentials, name: fields.name.trim() });
        setRegistering(false);
      }
      onLogin(await api.login(credentials));
    } catch (error) {
      setError(errorMessage(error));
    }
  });

  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <img src="/brand/foody-logo.png" alt="Foody Delivery" className="auth-logo" />
        <div className="auth-story-content">
          <span className="eyebrow">
            <LocalShippingOutlined fontSize="small" /> CADA PEDIDO CONTA
          </span>
          <h1>
            Do primeiro pedido
            <br />à última entrega<span>.</span>
          </h1>
          <p>
            Mais clareza em cada etapa.
            <br />
            Mais cuidado em cada entrega.
          </p>
          <OrderIllustration large />
          <div className="auth-features">
            <span>
              <i />
              Receba
            </span>
            <b>→</b>
            <span>
              <i />
              Prepare
            </span>
            <b>→</b>
            <span>
              <i />
              Entregue
            </span>
          </div>
        </div>
        <small>Mini Rastreador de Pedidos · Desafio técnico</small>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-logo">
          <img src="/brand/foody-logo.png" alt="Foody Delivery" />
        </div>
        <div className="auth-card">
          <span className="eyebrow">SUA OPERAÇÃO, MAIS SIMPLES</span>
          <h2>{registering ? 'Vamos começar?' : 'Bom ter você por aqui.'}</h2>
          <p>
            {registering
              ? 'Crie sua conta e acompanhe seus pedidos.'
              : 'Entre na sua conta para cuidar das próximas entregas.'}
          </p>
          {sessionExpired && !error && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Sua sessão expirou. Entre novamente.
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
            noValidate
          >
            {registering && (
              <TextField
                label="Seu nome"
                autoComplete="name"
                autoFocus
                {...register('name', {
                  required: 'Informe seu nome.',
                  minLength: { value: 2, message: 'Use pelo menos 2 caracteres.' },
                  maxLength: { value: 100, message: 'Use até 100 caracteres.' },
                  validate: (value) => !!value.trim() || 'Informe seu nome.',
                })}
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            )}
            <TextField
              label="E-mail"
              type="email"
              autoComplete="email"
              autoFocus={!registering}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <AlternateEmailRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              {...register('email', {
                required: 'Informe seu e-mail.',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Informe um e-mail válido.',
                },
                maxLength: 254,
              })}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <TextField
              label="Senha"
              type="password"
              autoComplete={registering ? 'new-password' : 'current-password'}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              {...register('password', {
                required: 'Informe sua senha.',
                minLength: registering
                  ? { value: 8, message: 'Use pelo menos 8 caracteres.' }
                  : undefined,
                validate: (value) =>
                  new TextEncoder().encode(value).length <= 72 || 'Use até 72 bytes na senha.',
              })}
              error={!!errors.password}
              helperText={
                errors.password?.message || (registering ? 'Pelo menos 8 caracteres.' : undefined)
              }
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={isSubmitting}
              endIcon={
                isSubmitting ? <CircularProgress size={18} color="inherit" /> : <EastRounded />
              }
            >
              {isSubmitting
                ? 'Aguarde...'
                : registering
                  ? 'Criar minha conta'
                  : 'Entrar na minha conta'}
            </Button>
          </form>
          <div className="auth-switch">
            {registering ? 'Já tem uma conta?' : 'Primeira vez por aqui?'}{' '}
            <Button
              size="small"
              onClick={() => {
                setRegistering(!registering);
                setError('');
                reset();
              }}
            >
              {registering ? 'Entrar' : 'Criar conta'}
            </Button>
          </div>
          <div className="auth-note">
            <LockOutlined sx={{ fontSize: 14 }} /> Seus pedidos em um só lugar, com acesso seguro.
          </div>
        </div>
        <footer>Foody Delivery · Simplificando o caminho.</footer>
      </main>
    </div>
  );
}
