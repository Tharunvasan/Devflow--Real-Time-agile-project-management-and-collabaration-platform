import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
