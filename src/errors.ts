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
	actionNotAllowed: {
		code: "ACTION_NOT_ALLOWED",
		message: "Action not allowed",
		status: 403
	},
	validationFailed: {
		code: "VALIDATION_FAILED",
		message: "Validation failed",
		status: 400
	},
	loginFailed: {
		code: "LOGIN_FAILED",
		message: "Login failed",
		status: 400
	},
	companyDoesNotExist: {
		code: "COMPANY_DOES_NOT_EXIST",
		message: "Company does not exist",
		status: 404
	},
	roomDoesNotExist: {
		code: "ROOM_DOES_NOT_EXIST",
		message: "Room does not exist",
		status: 404
	}
}

export const validationErrors = {
	nameTooShort: "NAME_TOO_SHORT",
	nameTooLong: "NAME_TOO_LONG"
}
