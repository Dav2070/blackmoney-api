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
//#endregion
