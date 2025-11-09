import crypto from "crypto"
import { RegisterClient } from "@prisma/client"
import { apiErrors } from "../errors.js"
import { createClient } from "../services/fiskalyApiService.js"
import {
	validateNameLength,
	validateSerialNumberLength
} from "../services/validationService.js"
import { ResolverContext } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"

export async function retrieveRegisterClientBySerialNumber(
	parent: any,
	args: { registerUuid: string; serialNumber: string },
	context: ResolverContext
): Promise<RegisterClient> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the register
	const register = await context.prisma.register.findFirst({
		where: {
			uuid: args.registerUuid
		},
		include: {
			restaurant: {
				include: {
					company: true
				}
			}
		}
	})

	if (register == null) {
		throwApiError(apiErrors.registerDoesNotExist)
	}

	// Check if the company of the register belongs to the user
	if (register.restaurant.companyId !== context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Get the register client
	const registerClient = await context.prisma.registerClient.findFirst({
		where: {
			registerId: register.id,
			serialNumber: args.serialNumber
		}
	})

	if (registerClient == null) {
		return null
	}

	return registerClient
}

export async function createRegisterClient(
	parent: any,
	args: {
		registerUuid: string
		name: string
		serialNumber: string
	},
	context: ResolverContext
): Promise<RegisterClient> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the register
	const register = await context.prisma.register.findFirst({
		where: {
			uuid: args.registerUuid
		},
		include: {
			restaurant: {
				include: {
					company: true
				}
			}
		}
	})

	if (register == null) {
		throwApiError(apiErrors.registerDoesNotExist)
	}

	// Check if the company of the register belongs to the user
	if (register.restaurant.company.userId !== BigInt(context.davUser.Id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	// Validate the serial number
	throwValidationError(validateSerialNumberLength(args.serialNumber))

	// Create the register client
	return await context.prisma.registerClient.create({
		data: {
			uuid: crypto.randomUUID(),
			name: args.name,
			serialNumber: args.serialNumber,
			register: {
				connect: {
					id: register.id
				}
			}
		}
	})
}
