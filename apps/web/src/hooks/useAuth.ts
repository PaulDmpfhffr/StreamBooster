import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

export function useLogin() {
  const { setTokens } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post('/auth/login', data).then((r) => r.data),
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      navigate('/dashboard');
    },
  });
}

export function useRegister() {
  const { setTokens } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post('/auth/register', data).then((r) => r.data),
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      navigate('/dashboard');
    },
  });
}
