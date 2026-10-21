import axiosInstance from './axios.js';

/** List all trips for the authenticated user */
export const getTrips = () =>
  axiosInstance.get('/trips/');

/** Get a single trip by ID */
export const getTripById = (id) =>
  axiosInstance.get(`/trips/${id}/`);

/** Create a new trip */
export const createTrip = (data) =>
  axiosInstance.post('/trips/', data);

/** Update a trip */
export const updateTrip = (id, data) =>
  axiosInstance.patch(`/trips/${id}/`, data);

/** Delete a trip */
export const deleteTrip = (id) =>
  axiosInstance.delete(`/trips/${id}/`);

/** Get itinerary days for a trip */
export const getItinerary = (tripId) =>
  axiosInstance.get(`/trips/${tripId}/itinerary/`);

/** Get bookings for a trip */
export const getTripBookings = (tripId) =>
  axiosInstance.get(`/trips/${tripId}/bookings/`);

/** Get cost summary (v_trip_cost_summary) for a trip */
export const getTripCostSummary = (tripId) =>
  axiosInstance.get(`/trips/${tripId}/cost-summary/`);

/** Add a new day to a trip */
export const addTripDay = (tripId, data = {}) =>
  axiosInstance.post(`/trips/${tripId}/add-day/`, data);

/** Remove a day from a trip */
export const removeTripDay = (tripId, dayNumber = null, dayId = null) =>
  axiosInstance.post(`/trips/${tripId}/remove-day/`, { day_number: dayNumber, day_id: dayId });

/** Reset and clear an itinerary from scratch */
export const resetTripItinerary = (tripId) =>
  axiosInstance.post(`/trips/${tripId}/reset-itinerary/`);

/** Add an itinerary item or day cost to budget */
export const addItineraryCost = (tripId, { itemId, dayId, dayNumber } = {}) =>
  axiosInstance.post(`/trips/${tripId}/add-cost/`, {
    item_id: itemId,
    day_id: dayId,
    day_number: dayNumber,
  });

/** Remove an itinerary item or day cost from budget */
export const removeItineraryCost = (tripId, { itemId, dayId, dayNumber } = {}) =>
  axiosInstance.post(`/trips/${tripId}/remove-cost/`, {
    item_id: itemId,
    day_id: dayId,
    day_number: dayNumber,
  });

/** Query Open-Meteo atmospheric weather telemetry for a trip destination */
export const getTripWeather = (tripId) =>
  axiosInstance.get(`/trips/${tripId}/weather/`);

