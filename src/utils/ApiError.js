class ApiError extends Error {
    constructor(
      statusCode,
      message = "Something went wrong",
      errors = [],
      data = null,
      stack = null
    ) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.errors = Array.isArray(errors) ? errors : [errors]; // Ensure errors is always an array
        this.data = data;
        this.success = false;

        // Handle stack trace differently for production and development
        if (stack) {
            this.stack = stack;
        } else if (process.env.NODE_ENV === 'development' && Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = null; // Avoid sending stack in production
        }
    }

    // Optional: a method to format the error in a way that it's easier to return in a response
    format() {
        return {
            success: this.success,
            statusCode: this.statusCode,
            message: this.message,
            errors: this.errors,
            data: this.data,
            stack: this.stack, // Include stack trace only in development
        };
    }
}

export { ApiError };
