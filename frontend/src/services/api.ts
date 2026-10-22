import axios from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost')) {
    return import.meta.env.VITE_API_URL;
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:5000/api`;
};

const API_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('devflow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Skip redirect for /auth/me — AuthContext handles that failure itself
      const url = error.config?.url || '';
      if (!url.includes('/auth/me')) {
        localStorage.removeItem('devflow_token');
        localStorage.removeItem('devflow_user');
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
