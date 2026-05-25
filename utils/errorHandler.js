/**
 * Handles Supabase errors and returns a unified error object
 * @param {Object} error - The error object returned by Supabase
 * @returns {Object} - A structured error object with code and message
 */
export const handleSupabaseError = (error) => {
    if (!error) return null;

    console.error('Supabase Error:', error);

    let message = 'An unexpected error occurred.';
    let code = error.status || error.code || 'UNKNOWN_ERROR';

    // Map specific error codes to user-friendly messages
    // These are examples, you might need to adjust based on actual Supabase error codes
    if (error.message) {
        message = error.message;
    }

    // Common Auth Errors
    if (message.includes('Invalid login credentials')) {
        message = 'Invalid email or password. Please try again.';
    } else if (message.includes('User already registered')) {
        message = 'This email is already registered. Please log in instead.';
    } else if (message.includes('Password should be at least')) {
        message = 'Password is too weak. It should be at least 6 characters.';
    }

    return {
        error: true,
        code,
        message,
        originalError: error
    };
};
