import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5007';
export const SCRAPER_BASE_URL = process.env.NEXT_PUBLIC_SCRAPER_URL || 'http://localhost:5008';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request Interceptor: Add Bearer Token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const authData = localStorage.getItem('spendlog_auth');
    if (authData) {
      try {
        const { state } = JSON.parse(authData);
        if (state?.accessToken) {
          config.headers.Authorization = `Bearer ${state.accessToken}`;
        }
      } catch (e) {
        console.error('Failed to parse auth token', e);
      }
    }
  }
  return config;
});

// Response Interceptor: Auto Refresh Token on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/api/auth/login') ||
      requestUrl.includes('/api/auth/register') ||
      requestUrl.includes('/api/auth/refresh-token') ||
      requestUrl.includes('/api/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const authData = localStorage.getItem('spendlog_auth');
      if (!authData) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const { state } = JSON.parse(authData);
        if (!state?.refreshToken || !state?.accessToken) {
          throw new Error('No refresh token available');
        }

        const res = await axios.post<any>(
          `${API_BASE_URL}/api/auth/refresh-token`,
          {
            accessToken: state.accessToken,
            refreshToken: state.refreshToken,
          },
          {
            withCredentials: true,
          }
        );

        if (res.data.success && res.data.accessToken) {
          const updatedState = {
            ...state,
            accessToken: res.data.accessToken,
            refreshToken: res.data.refreshToken,
          };
          localStorage.setItem('spendlog_auth', JSON.stringify({ state: updatedState }));

          api.defaults.headers.common.Authorization = `Bearer ${res.data.accessToken}`;
          originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`;

          processQueue(null, res.data.accessToken);
          return api(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('spendlog_auth');
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export interface ApiProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  traceId?: string;
  errors?: Record<string, string[]>;
}

export function parseApiError(error: any): { message: string; traceId?: string; errors?: Record<string, string[]> } {
  if (error?.response?.data) {
    const data: ApiProblemDetails = error.response.data;
    const traceId = data.traceId || error.response.headers?.['x-trace-id'];
    const message = data.detail || data.title || error.message || 'Bir hata oluştu.';
    return { message, traceId, errors: data.errors };
  }
  return { message: error?.message || 'Ağ bağlantı hatası oluştu.' };
}

