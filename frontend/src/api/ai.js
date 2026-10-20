import axiosInstance from './axios.js';

/**
 * Generate AI trip plan (whole trip or targeted to a specific day).
 * @param {number} tripId - The trip to attach the plan to
 * @param {string} promptText - Natural language prompt from the user
 * @param {number|null} dayNumber - Optional single day to plan/re-plan
 */
export const generateTripPlan = (tripId, promptText, dayNumber = null) =>
  axiosInstance.post(
    '/ai/plan/',
    {
      trip_id: tripId,
      user_prompt: promptText,
      prompt: promptText,
      day_number: dayNumber || null,
    },
    { timeout: 60000 }
  );

/**
 * Get AI-generated itinerary suggestions for a destination.
 * @param {string} destination
 */
export const getSuggestions = (destination) =>
  axiosInstance.get('/ai/suggestions/', { params: { destination } });

/**
 * Ask the AI assistant a travel question.
 * @param {string} question
 */
export const askAssistant = (question) =>
  axiosInstance.post('/ai/ask/', { question });
