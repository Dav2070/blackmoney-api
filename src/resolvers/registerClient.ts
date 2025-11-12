import { RegisterClient } from "@prisma/client"
import { apiErrors } from "../errors.js"
import { validateNameLength } from "../services/validationService.js"
import { ResolverContext } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"

export async function retrieveRegisterClient(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<RegisterClient> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the register client
	const registerClient = await context.prisma.registerClient.findFirst({
		where: {
			uuid: args.uuid
		},
		include: {
			register: {
				include: {
					restaurant: true
				}
			}
		}
	})

	if (registerClient == null) {
		throwApiError(apiErrors.registerClientDoesNotExist)
	}

	// Check if the user can access the register client
	if (
		registerClient.register.restaurant.companyId !== context.user.companyId
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	return registerClient
}

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

export async function updateRegisterClient(
	parent: any,
	args: {
		uuid: string
		name?: string
	},
	context: ResolverContext
): Promise<RegisterClient> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the register client
	const registerClient = await context.prisma.registerClient.findFirst({
		where: {
			uuid: args.uuid
		},
		include: {
			register: {
				include: {
					restaurant: true
				}
			}
		}
	})

	if (registerClient == null) {
		throwApiError(apiErrors.registerClientDoesNotExist)
	}

	// Check if the user can access the register client
	if (
		registerClient.register.restaurant.companyId !== context.user.companyId
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	if (args.name == null) return registerClient

	// Validate the args
	throwValidationError(validateNameLength(args.name))

	// Update the register client
	return await context.prisma.registerClient.update({
		where: { id: registerClient.id },
		data: {
			name: args.name
		}
	})
}
