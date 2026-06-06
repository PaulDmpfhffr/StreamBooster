import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

function decodeJwtPayload(token: string): { sub: string; email: string; role: string } | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function useLogin() {
  const { setTokens, setUser } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post('/auth/login', data).then((r) => r.data),
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      const payload = decodeJwtPayload(data.accessToken);
      if (payload) setUser({ id: payload.sub, email: payload.email, role: payload.role });
      navigate('/dashboard');
    },
  });
}

export function useRegister() {
  const { setTokens, setUser } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post('/auth/register', data).then((r) => r.data),
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      const payload = decodeJwtPayload(data.accessToken);
      if (payload) setUser({ id: payload.sub, email: payload.email, role: payload.role });
      navigate('/dashboard');
    },
  });
}
