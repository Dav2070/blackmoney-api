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
	userDoesNotExist: {
		code: "USER_DOES_NOT_EXIST",
		message: "User does not exist",
		status: 404
	},
	restaurantDoesNotExist: {
		code: "RESTAURANT_DOES_NOT_EXIST",
		message: "Restaurant does not exist",
		status: 404
	},
	registerDoesNotExist: {
		code: "REGISTER_DOES_NOT_EXIST",
		message: "Register does not exist",
		status: 404
	},
	registerClientDoesNotExist: {
		code: "REGISTER_CLIENT_DOES_NOT_EXIST",
		message: "RegisterClient does not exist",
		status: 404
	},
	printerDoesNotExist: {
		code: "PRINTER_DOES_NOT_EXIST",
		message: "Printer does not exist",
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
	categoryDoesNotExist: {
		code: "CATEGORY_DOES_NOT_EXIST",
		message: "Category does not exist",
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
	tssDoesNotExist: {
		code: "TSS_DOES_NOT_EXIST",
		message: "Fiskaly TSS does not exist",
		status: 404
	},
	companyAlreadyExists: {
		code: "COMPANY_ALREADY_EXISTS",
		message: "The user already has a company",
		status: 400
	},
	printerAlreadyExists: {
		code: "PRINTER_ALREADY_EXISTS",
		message: "Printer with this IP address already exists",
		status: 400
	},
	tableAlreadyExists: {
		code: "TABLE_ALREADY_EXISTS",
		message: "Table with this name already exists",
		status: 400
	},
	restaurantAlreadyHasOwner: {
		code: "RESTAURANT_ALREADY_HAS_OWNER",
		message: "The restaurant already has an owner",
		status: 400
	},
	noPrintersSpecified: {
		code: "NO_PRINTERS_SPECIFIED",
		message: "Please specify at least one printer uuid for the PrintRule",
		status: 400
	},
	noCategoriesSpecified: {
		code: "NO_CATEGORIES_SPECIFIED",
		message: "Please specify at least one category uuid for the PrintRule",
		status: 400
	},
	noProductsSpecified: {
		code: "NO_PRODUCTS_SPECIFIED",
		message: "Please specify at least one product uuid for the PrintRule",
		status: 400
	},
	productNotInOrder: {
		code: "PRODUCT_NOT_IN_ORDER",
		message: "Product is not in the order",
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
	},
	userHasNoPassword: {
		code: "USER_HAS_NO_PASSWORD",
		message: "Please set a password for the user to log in",
		status: 412
	},
	userAlreadyHasPassword: {
		code: "USER_ALREADY_HAS_PASSWORD",
		message: "User already has a password",
		status: 412
	}
}

export const validationErrors = {
	nameTooShort: "NAME_TOO_SHORT",
	nameTooLong: "NAME_TOO_LONG",
	serialNumberTooShort: "SERIAL_NUMBER_TOO_SHORT",
	serialNumberTooLong: "SERIAL_NUMBER_TOO_LONG",
	passwordTooShort: "PASSWORD_TOO_SHORT",
	passwordTooLong: "PASSWORD_TOO_LONG",
	cityTooLong: "CITY_TOO_LONG",
	line1TooLong: "LINE1_TOO_LONG",
	line2TooLong: "LINE2_TOO_LONG",
	postalCodeInvalid: "POSTAL_CODE_INVALID",
	ipAddressInvalid: "IP_ADDRESS_INVALID",
	tableNameInvalid: "TABLE_NAME_INVALID",
	seatsInvalid: "SEATS_INVALID"
}
