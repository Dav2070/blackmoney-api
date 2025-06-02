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
	},
	tableDoesNotExist: {
		code: "TABLE_DOES_NOT_EXIST",
		message: "Table does not exist",
		status: 404
	},
	billDoesNotExist: {
		code: "BILL_DOES_NOT_EXIST",
		message: "Bill does not exist",
		status: 404
	},
	orderDoesNotExist: {
		code: "ORDER_DOES_NOT_EXIST",
		message: "Order does not exist",
		status: 404
	},
	orderItemDoesNotExist: {
		code: "ORDER_ITEM_DOES_NOT_EXIST",
		message: "Order item does not exist",
		status: 404
	},
	productDoesNotExist: {
		code: "PRODUCT_DOES_NOT_EXIST",
		message: "Product does not exist",
		status: 404
	},
	variationItemDoesNotExist: {
		code: "VARIATION_ITEM_DOES_NOT_EXIST",
		message: "Variation item does not exist",
		status: 404
	},
	productNotInOrder: {
		code: "PRODUCT_NOT_IN_ORDER",
		message: "Product is not in the order",
		status: 400
	},
	companyAlreadyExists: {
		code: "COMPANY_ALREADY_EXISTS",
		message: "The user already has a company",
		status: 400
	},
	billNotMatchingExistingBillOfOrder: {
		code: "BILL_NOT_MATCHING_EXISTING_BILL_OF_ORDER",
		message:
			"The order already has a bill. The given bill must be the same as the existing bill.",
		status: 400
	},
	orderAlreadyCompleted: {
		code: "ORDER_ALREADY_COMPLETED",
		message: "Order already completed",
		status: 400
	}
}

export const validationErrors = {
	nameTooShort: "NAME_TOO_SHORT",
	nameTooLong: "NAME_TOO_LONG"
}
