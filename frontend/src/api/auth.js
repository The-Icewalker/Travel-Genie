import axiosInstance from './axios.js';

/** Login and obtain JWT tokens */
export const login = (email, password) =>
  axiosInstance.post('/auth/login/', { email, password });

/** Register a new user */
export const register = (data) =>
  axiosInstance.post('/auth/register/', data);

/** Get current authenticated user profile */
export const getMe = () =>
  axiosInstance.get('/auth/me/');

/** Logout — blacklist refresh token */
export const logout = (refresh) =>
  axiosInstance.post('/auth/logout/', { refresh });

/** Refresh access token */
export const refreshAccessToken = (refresh) =>
  axiosInstance.post('/auth/token/refresh/', { refresh });
