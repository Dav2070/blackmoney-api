export const apiErrors = {
	unexpectedError: {
		code: "UNEXPECTED_ERROR",
		message: "Unexpected error"
	},
	notAuthenticated: {
		code: "NOT_AUTHENTICATED",
		message: "You are not authenticated",
		status: 401
	},
	validationFailed: {
		code: "VALIDATION_FAILED",
		message: "Validation failed",
		status: 400
	}
}

export const validationErrors = {
	nameTooShort: "NAME_TOO_SHORT",
	nameTooLong: "NAME_TOO_LONG"
}
