import { validationErrors } from "../errors.js"

//#region Field validations
export function validateNameLength(name: string) {
	if (name.length < 2) {
		return validationErrors.nameTooShort
	} else if (name.length > 50) {
		return validationErrors.nameTooLong
	}
}
//#endregion
