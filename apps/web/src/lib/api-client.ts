import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: true,
});

let refreshRequestPromise: Promise<string> | null = null;

const redirectToLogin = (): void => {
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

const getRefreshRequestPromise = (): Promise<string> => {
  if (!refreshRequestPromise) {
    refreshRequestPromise = axios
      .post<{ accessToken: string }>(`${API_BASE_URL}/api/v1/auth/refresh`, {}, { withCredentials: true })
      .then((refreshResponse) => {
        const nextToken = refreshResponse.data.accessToken;
        useAuthStore.getState().setToken(nextToken);
        return nextToken;
      })
      .catch((refreshError: unknown) => {
        useAuthStore.getState().clearAuth();
        redirectToLogin();
        throw refreshError;
      })
      .finally(() => {
        refreshRequestPromise = null;
      });
  }

  return refreshRequestPromise;
};

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;

  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const isRefreshCall = originalRequest?.url?.includes('/auth/refresh') ?? false;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isRefreshCall) {
      originalRequest._retry = true;

      try {
        const nextToken = await getRefreshRequestPromise();
        const headers = AxiosHeaders.from(originalRequest.headers);
        headers.set('Authorization', `Bearer ${nextToken}`);
        originalRequest.headers = headers;
        return apiClient(originalRequest);
      } catch (refreshError: unknown) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
