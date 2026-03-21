import api from './api';

export const loginRequest = async (credentials) => {
  const { data } = await api.post('/auth/login', credentials);
  return data;
};

export const meRequest = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};
