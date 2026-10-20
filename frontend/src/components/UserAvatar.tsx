import Avatar from '@mui/material/Avatar';
import type { User } from '../lib/types';

export function UserAvatar({ user, size = 34 }: { user: User; size?: number }) {
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <Avatar
      src={user.avatarUrl ?? undefined}
      alt={`Foto de ${user.name}`}
      sx={{
        width: size,
        height: size,
        bgcolor: '#F7E9E3',
        color: '#A85C49',
        fontSize: size >= 80 ? 30 : 11,
        fontWeight: 800,
      }}
    >
      {initials}
    </Avatar>
  );
}
