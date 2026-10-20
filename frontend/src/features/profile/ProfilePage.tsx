import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import CameraAltOutlined from '@mui/icons-material/CameraAltOutlined';
import CheckRounded from '@mui/icons-material/CheckRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import LockOutlined from '@mui/icons-material/LockOutlined';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { api, ApiError, errorMessage } from '../../lib/api';
import type { User } from '../../lib/types';
import { UserAvatar } from '../../components/UserAvatar';

interface Details {
  name: string;
  email: string;
  currentPassword: string;
}
interface Passwords {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
}
const passwordByteLimit = (value: string) =>
  new TextEncoder().encode(value).length <= 72 || 'Use até 72 bytes na senha.';

export function ProfilePage({ user }: { user: User }) {
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<{ file: File; preview: string }>();
  const file = selected?.file;
  const preview = selected?.preview;
  const setFile = (next?: File) =>
    setSelected(next ? { file: next, preview: URL.createObjectURL(next) } : undefined);
  const [imageError, setImageError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const details = useForm<Details>({
    defaultValues: { name: user.name, email: user.email, currentPassword: '' },
  });
  const passwords = useForm<Passwords>({
    defaultValues: { currentPassword: '', newPassword: '', confirmation: '' },
  });
  const email = useWatch({ control: details.control, name: 'email' });
  const newPassword = useWatch({ control: passwords.control, name: 'newPassword' });
  const emailChanged = email.trim().toLowerCase() !== user.email;

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const cacheUser = (updated: User) => client.setQueryData(['auth'], updated);
  const profileError = (error: unknown) => {
    if (error instanceof ApiError && error.code === 'PROFILE_CONFLICT')
      setNotice('Recarregue a página para obter a versão atual do perfil.');
  };
  const update = useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (updated) => {
      cacheUser(updated);
      details.reset({ name: updated.name, email: updated.email, currentPassword: '' });
      setNotice('Seus dados foram atualizados.');
    },
    onError: profileError,
  });
  const password = useMutation({
    mutationFn: api.changePassword,
    onSuccess: (updated) => {
      cacheUser(updated);
      passwords.reset();
      setNotice('Senha atualizada. As outras sessões serão encerradas.');
    },
    onError: profileError,
  });
  const upload = useMutation({
    mutationFn: api.uploadAvatar,
    onSuccess: (updated) => {
      cacheUser(updated);
      setFile(undefined);
      setNotice('Foto de perfil atualizada.');
    },
  });
  const remove = useMutation({
    mutationFn: api.removeAvatar,
    onSuccess: (updated) => {
      cacheUser(updated);
      setFile(undefined);
      setNotice('Foto de perfil removida.');
    },
  });
  const busy = update.isPending || password.isPending || upload.isPending || remove.isPending;
  const saveDetails = details.handleSubmit((values) =>
    update.mutate({
      name: values.name.trim(),
      email: values.email.trim(),
      ...(emailChanged ? { currentPassword: values.currentPassword } : {}),
      expectedVersion: user.version,
    }),
  );
  const savePassword = passwords.handleSubmit((values) =>
    password.mutate({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      expectedVersion: user.version,
    }),
  );

  const selectFile = (selected?: File) => {
    setImageError('');
    upload.reset();
    remove.reset();
    if (!selected) return;
    if (!['image/jpeg', 'image/png'].includes(selected.type)) {
      setImageError('Escolha uma imagem PNG ou JPEG.');
      return;
    }
    if (selected.size === 0 || selected.size > 2 * 1024 * 1024) {
      setImageError('Escolha uma imagem de até 2 MB.');
      return;
    }
    setFile(selected);
  };

  return (
    <main className="profile-main" id="main-content" tabIndex={-1}>
      <section className="page-heading profile-page-heading">
        <div>
          <span className="eyebrow">SUA CONTA, DO SEU JEITO</span>
          <h1>Meu perfil</h1>
          <p>Cuide dos seus dados e da segurança da sua conta.</p>
        </div>
        <span className="profile-account-tag">
          <CheckRounded fontSize="small" /> Conta ativa
        </span>
      </section>
      <div className="profile-grid">
        <aside className="profile-identity">
          <div className="profile-identity-cover" />
          <div className="profile-identity-content">
            <UserAvatar user={user} size={88} />
            <h2>{user.name}</h2>
            <p>{user.email}</p>
            <span className="profile-role">Minha operação</span>
            <div className="profile-identity-note">
              <LockOutlined />
              <p>Seus dados ficam associados à sua conta. Apenas você pode alterá-los.</p>
            </div>
          </div>
        </aside>
        <div className="profile-settings">
          <section className="profile-card" aria-labelledby="photo-title">
            <div className="profile-card-heading">
              <span className="profile-section-icon">
                <CameraAltOutlined />
              </span>
              <div>
                <h2 id="photo-title">Foto de perfil</h2>
                <p>Deixe sua conta com a sua cara.</p>
              </div>
            </div>
            <div className="profile-photo-row">
              <div className="profile-photo-preview">
                {preview ? (
                  <Avatar src={preview} alt="Prévia da nova foto" sx={{ width: 84, height: 84 }} />
                ) : (
                  <UserAvatar user={user} size={84} />
                )}
                <span className="photo-camera-mark">
                  <CameraAltOutlined sx={{ fontSize: 13 }} />
                </span>
              </div>
              <div className="profile-photo-actions">
                <div>
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<CameraAltOutlined />}
                    disabled={busy}
                    onClick={() => fileInput.current?.click()}
                  >
                    Escolher foto
                  </Button>
                  <Button
                    color="secondary"
                    startIcon={<DeleteOutlineRounded />}
                    disabled={busy || (!user.avatarUrl && !file)}
                    onClick={() => (file ? setFile(undefined) : remove.mutate())}
                  >
                    {file ? 'Descartar' : 'Remover'}
                  </Button>
                </div>
                <small>PNG ou JPEG de até 2 MB. A foto será recortada ao centro.</small>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="visually-hidden"
                  aria-label="Selecionar foto de perfil"
                  onChange={(event) => {
                    selectFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </div>
            </div>
            {file && (
              <div className="profile-photo-confirm">
                <span>{file.name}</span>
                <Button
                  variant="contained"
                  size="small"
                  disabled={busy}
                  onClick={() => upload.mutate(file)}
                >
                  {upload.isPending ? 'Enviando...' : 'Salvar foto'}
                </Button>
              </div>
            )}
            {(imageError || upload.isError || remove.isError) && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {imageError || errorMessage(upload.error ?? remove.error)}
              </Alert>
            )}
          </section>
          <section className="profile-card" aria-labelledby="personal-title">
            <div className="profile-card-heading">
              <span className="profile-section-icon">
                <PersonOutlineRounded />
              </span>
              <div>
                <h2 id="personal-title">Dados pessoais</h2>
                <p>Mantenha suas informações atualizadas.</p>
              </div>
            </div>
            <form
              onSubmit={(event) => {
                void saveDetails(event);
              }}
              noValidate
            >
              {update.isError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errorMessage(update.error)}
                </Alert>
              )}
              <div className="profile-form-grid">
                <TextField
                  label="Nome completo"
                  autoComplete="name"
                  {...details.register('name', {
                    required: 'Informe seu nome.',
                    minLength: { value: 2, message: 'Use pelo menos 2 caracteres.' },
                    maxLength: { value: 100, message: 'Use até 100 caracteres.' },
                    validate: (value) => value.trim().length >= 2 || 'Use pelo menos 2 caracteres.',
                  })}
                  error={!!details.formState.errors.name}
                  helperText={details.formState.errors.name?.message}
                  disabled={busy}
                />
                <TextField
                  label="E-mail"
                  autoComplete="email"
                  type="email"
                  {...details.register('email', {
                    required: 'Informe seu e-mail.',
                    maxLength: 254,
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Informe um e-mail válido.',
                    },
                  })}
                  error={!!details.formState.errors.email}
                  helperText={details.formState.errors.email?.message}
                  disabled={busy}
                />
              </div>
              {emailChanged && (
                <div className="profile-email-confirm">
                  <Alert severity="info">
                    Para trocar o e-mail de acesso, confirme sua senha atual. As outras sessões
                    serão encerradas.
                  </Alert>
                  <TextField
                    label="Senha atual para alterar e-mail"
                    type="password"
                    autoComplete="current-password"
                    {...details.register('currentPassword', {
                      validate: (value) =>
                        !emailChanged ||
                        (!!value && passwordByteLimit(value)) ||
                        'Informe a senha atual.',
                    })}
                    error={!!details.formState.errors.currentPassword}
                    helperText={details.formState.errors.currentPassword?.message}
                    disabled={busy}
                  />
                </div>
              )}
              <div className="profile-form-footer">
                <small>Seu e-mail é usado para entrar na conta.</small>
                <Button
                  variant="contained"
                  type="submit"
                  startIcon={<SaveOutlined />}
                  disabled={busy || !details.formState.isDirty}
                >
                  {update.isPending ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </div>
            </form>
          </section>
          <section className="profile-card" aria-labelledby="password-title">
            <div className="profile-card-heading">
              <span className="profile-section-icon">
                <LockOutlined />
              </span>
              <div>
                <h2 id="password-title">Segurança da conta</h2>
                <p>Escolha uma senha forte e exclusiva.</p>
              </div>
            </div>
            <form
              onSubmit={(event) => {
                void savePassword(event);
              }}
              noValidate
            >
              {password.isError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errorMessage(password.error)}
                </Alert>
              )}
              <TextField
                label="Senha atual"
                type="password"
                autoComplete="current-password"
                {...passwords.register('currentPassword', {
                  required: 'Informe sua senha atual.',
                  validate: passwordByteLimit,
                })}
                error={!!passwords.formState.errors.currentPassword}
                helperText={passwords.formState.errors.currentPassword?.message}
                disabled={busy}
              />
              <div className="profile-form-grid password-fields">
                <TextField
                  label="Nova senha"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...passwords.register('newPassword', {
                    required: 'Informe a nova senha.',
                    minLength: { value: 8, message: 'Use pelo menos 8 caracteres.' },
                    validate: passwordByteLimit,
                  })}
                  error={!!passwords.formState.errors.newPassword}
                  helperText={
                    passwords.formState.errors.newPassword?.message ?? 'Pelo menos 8 caracteres.'
                  }
                  disabled={busy}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? (
                              <VisibilityOffOutlined fontSize="small" />
                            ) : (
                              <VisibilityOutlined fontSize="small" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Confirmar nova senha"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...passwords.register('confirmation', {
                    required: 'Confirme a nova senha.',
                    validate: (value) => value === newPassword || 'As senhas não coincidem.',
                  })}
                  error={!!passwords.formState.errors.confirmation}
                  helperText={passwords.formState.errors.confirmation?.message}
                  disabled={busy}
                />
              </div>
              <div className="profile-form-footer">
                <small>A senha atual é necessária para confirmar.</small>
                <Button
                  variant="contained"
                  type="submit"
                  startIcon={<LockOutlined />}
                  disabled={busy || !passwords.formState.isDirty}
                >
                  {password.isPending ? 'Atualizando...' : 'Atualizar senha'}
                </Button>
              </div>
            </form>
          </section>
          <p className="profile-bottom-note">
            <LockOutlined sx={{ fontSize: 14 }} /> Suas alterações são salvas de forma segura na sua
            conta.
          </p>
        </div>
      </div>
      <Snackbar
        open={!!notice}
        autoHideDuration={5000}
        onClose={() => setNotice('')}
        message={notice}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </main>
  );
}
