import { GraphQLError } from "graphql"
import { PrismaClient, Register } from "../prisma/generated/client.js"
import { ApiError } from "./types.js"
import { apiErrors } from "./errors.js"
import {
	authenticateAdmin,
	createTss,
	logoutAdmin,
	setTssAdminPin,
	updateTss
} from "./services/fiskalyApiService.js"

export function throwApiError(error: ApiError) {
	throw new GraphQLError(error.message, {
		extensions: {
			code: error.code,
			http: {
				status: 200
			}
		}
	})
}

export function throwValidationError(...errors: string[]) {
	let filteredErrors = errors.filter(e => e != null)

	if (filteredErrors.length > 0) {
		throw new GraphQLError(apiErrors.validationFailed.message, {
			extensions: {
				code: apiErrors.validationFailed.code,
				errors: filteredErrors
			}
		})
	}
}

export function generateAdminPin(): string {
	let pin = ""

	for (let i = 0; i < 10; i++) {
		pin += Math.floor(Math.random() * 10).toString()
	}

	return pin
}
