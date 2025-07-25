import { postalCodeRegex } from "../constants.js"
import { validationErrors } from "../errors.js"

//#region Field validations
export function validateNameLength(name: string) {
	if (name.length < 2) {
		return validationErrors.nameTooShort
	} else if (name.length > 50) {
		return validationErrors.nameTooLong
	}
}

export function validateSerialNumberLength(serialNumber: string) {
	if (serialNumber.length < 2) {
		return validationErrors.serialNumberTooShort
	} else if (serialNumber.length > 100) {
		return validationErrors.serialNumberTooLong
	}
}

export function validatePasswordLength(password: string) {
	if (password.length < 6) {
		return validationErrors.passwordTooShort
	} else if (password.length > 25) {
		return validationErrors.passwordTooLong
	}
}

export function validateCityLength(city: string) {
	if (city.length > 50) {
		return validationErrors.cityTooLong
	}
}

export function validateLine1Length(line1: string) {
	if (line1.length > 100) {
		return validationErrors.line1TooLong
	}
}

export function validateLine2Length(line2: string) {
	if (line2.length > 100) {
		return validationErrors.line2TooLong
	}
}

export function validatePostalCode(postalCode: string) {
	if (postalCode.length > 0 && !postalCodeRegex.test(postalCode)) {
		return validationErrors.postalCodeInvalid
	}
}
//#endregion
