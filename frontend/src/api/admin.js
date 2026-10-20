import axiosInstance from './axios.js';

/** List all users (admin only) */
export const getUsers = () =>
  axiosInstance.get('/admin/users/');

/** Get a specific user */
export const getUserById = (id) =>
  axiosInstance.get(`/admin/users/${id}/`);

/** Update a user's role or status */
export const updateUser = (id, data) =>
  axiosInstance.patch(`/admin/users/${id}/`, data);

/** Delete a user */
export const deleteUser = (id) =>
  axiosInstance.delete(`/admin/users/${id}/`);

/** Get analytics: trips per user */
export const getTripsPerUser = () =>
  axiosInstance.get('/admin/analytics/trips-per-user/');

/** Get analytics: average hotel price per city */
export const getAvgHotelPricePerCity = () =>
  axiosInstance.get('/admin/analytics/avg-hotel-price/');

/** Get site-wide summary stats */
export const getSiteStats = () =>
  axiosInstance.get('/admin/analytics/stats/');
