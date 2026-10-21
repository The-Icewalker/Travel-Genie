import axiosInstance from './axios.js';

/** List all expenses for the authenticated user, optionally filtered by trip */
export const getExpenses = (tripId) =>
  axiosInstance.get('/budget/expenses/', { params: tripId ? { trip: tripId } : {} });

/** Get a single expense */
export const getExpenseById = (id) =>
  axiosInstance.get(`/budget/expenses/${id}/`);

/** Create an expense */
export const createExpense = (data) =>
  axiosInstance.post('/budget/expenses/', data);

/** Update an expense */
export const updateExpense = (id, data) =>
  axiosInstance.patch(`/budget/expenses/${id}/`, data);

/** Delete an expense */
export const deleteExpense = (id) =>
  axiosInstance.delete(`/budget/expenses/${id}/`);

/** Get aggregated spend per category */
export const getSpendByCategory = (tripId) =>
  axiosInstance.get('/budget/by-category/', {
    params: tripId ? { trip: tripId } : {},
  });

/** List budgets or get budget for a specific trip */
export const getBudgets = (tripId) =>
  axiosInstance.get('/budget/budgets/', {
    params: tripId ? { trip: tripId } : {},
  });

/** Set or update (upsert) the target budget for a trip */
export const setTripBudget = (tripId, totalAmount, currency = 'USD') =>
  axiosInstance.post('/budget/budgets/', {
    trip: tripId,
    total_amount: totalAmount,
    currency,
  });
