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

export async function createRegisterForRestaurant(
	prisma: PrismaClient,
	restaurantId: bigint,
	registerName: string
): Promise<Register> {
	const uuid = crypto.randomUUID()

	// Create the TSS
	let tss = await createTss(uuid)

	if (tss == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	const adminPuk = tss.admin_puk
	const adminPin = generateAdminPin()

	// Set the state to UNINITIALIZED
	tss = await updateTss(uuid, "UNINITIALIZED")

	if (tss == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Set an admin pin for the TSS
	const setPinResponse = await setTssAdminPin(uuid, adminPuk, adminPin)

	if (!setPinResponse) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Admin authentication
	const authenticateAdminResponse = await authenticateAdmin(uuid, adminPin)

	if (!authenticateAdminResponse) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Set the state to INITIALIZED
	tss = await updateTss(uuid, "INITIALIZED")

	if (tss == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Logout admin
	await logoutAdmin(uuid)

	// Create the register
	return await prisma.register.create({
		data: {
			uuid,
			name: registerName,
			adminPin,
			restaurant: {
				connect: {
					id: restaurantId
				}
			}
		}
	})
}
