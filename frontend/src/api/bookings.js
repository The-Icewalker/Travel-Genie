import axiosInstance from './axios.js';

/** List all bookings for the authenticated user */
export const getBookings = () =>
  axiosInstance.get('/bookings/');

/** Get a single booking */
export const getBookingById = (id) =>
  axiosInstance.get(`/bookings/${id}/`);

/** Create a booking */
export const createBooking = (data) =>
  axiosInstance.post('/bookings/', data);

/** Update a booking */
export const updateBooking = (id, data) =>
  axiosInstance.patch(`/bookings/${id}/`, data);

/** Delete a booking */
export const deleteBooking = (id) =>
  axiosInstance.delete(`/bookings/${id}/`);
