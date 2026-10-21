import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import axios from 'axios';
import axiosInstance from '../api/axios.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshingRef = useRef(false);
  const refreshSubscribers = useRef([]);

  const apiBaseUrl = axiosInstance.defaults.baseURL || 'http://localhost:8000/api';

  // ─── Token helpers ───────────────────────────────────────────────────────────
  const getAccessToken = () => localStorage.getItem('access_token');
  const getRefreshToken = () => localStorage.getItem('refresh_token');

  const storeTokens = (access, refresh) => {
    if (access) localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
  };

  const clearStorage = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  };

  // ─── Raw Refresh token (avoids axiosInstance interceptor loop) ────────────────
  const refreshToken = useCallback(async () => {
    const refresh = getRefreshToken();
    if (!refresh) throw new Error('No refresh token available');

    // Use raw axios call to avoid response interceptor loop
    const response = await axios.post(`${apiBaseUrl}/auth/token/refresh/`, { refresh });
    const { access } = response.data;
    storeTokens(access, null);
    return access;
  }, [apiBaseUrl]);

  // ─── Axios interceptors ──────────────────────────────────────────────────────
  useEffect(() => {
    // Request: attach Bearer token
    const reqInterceptor = axiosInstance.interceptors.request.use(
      (config) => {
        const token = getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response: handle 401 with token refresh
    const resInterceptor = axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (!originalRequest) return Promise.reject(error);

        const isAuthEndpoint =
          originalRequest.url?.includes('/auth/token/refresh/') ||
          originalRequest.url?.includes('/auth/login/') ||
          originalRequest.url?.includes('/auth/register/');

        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !isAuthEndpoint &&
          getRefreshToken()
        ) {
          if (refreshingRef.current) {
            // Queue requests while a refresh is in-flight
            return new Promise((resolve, reject) => {
              refreshSubscribers.current.push({ resolve, reject, originalRequest });
            });
          }

          originalRequest._retry = true;
          refreshingRef.current = true;

          try {
            const newAccess = await refreshToken();
            // Retry queued requests
            refreshSubscribers.current.forEach(({ resolve, originalRequest: req }) => {
              req.headers.Authorization = `Bearer ${newAccess}`;
              resolve(axiosInstance(req));
            });
            refreshSubscribers.current = [];
            originalRequest.headers.Authorization = `Bearer ${newAccess}`;
            return axiosInstance(originalRequest);
          } catch (refreshError) {
            refreshSubscribers.current.forEach(({ reject }) => reject(refreshError));
            refreshSubscribers.current = [];
            clearStorage();
            setUser(null);
            return Promise.reject(refreshError);
          } finally {
            refreshingRef.current = false;
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axiosInstance.interceptors.request.eject(reqInterceptor);
      axiosInstance.interceptors.response.eject(resInterceptor);
    };
  }, [refreshToken]);

  // ─── Restore session on mount ────────────────────────────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await axiosInstance.get('/auth/me/');
        const userData = response.data;
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      } catch {
        clearStorage();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  // ─── Auth actions ────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const response = await axiosInstance.post('/auth/login/', { email, password });
    const { access, refresh } = response.data;
    storeTokens(access, refresh);

    const meResponse = await axiosInstance.get('/auth/me/', {
      headers: { Authorization: `Bearer ${access}` },
    });
    const userData = meResponse.data;
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  }, []);

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    try {
      if (refresh) {
        await axiosInstance.post('/auth/logout/', { refresh });
      }
    } catch {
      // Ignore logout errors
    } finally {
      clearStorage();
      setUser(null);
    }
  }, []);

  const register = useCallback(async (full_name, email, password, confirm_password) => {
    const p2 = confirm_password || password;
    const response = await axiosInstance.post('/auth/register/', {
      full_name,
      email,
      password,
      password2: p2,
      confirm_password: p2,
    });
    const { access, refresh, user: userData } = response.data;
    if (access && refresh) {
      storeTokens(access, refresh);
      if (userData) {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    }
    return response.data;
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    refreshToken,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role_name === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
