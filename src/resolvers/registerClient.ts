import crypto from "crypto"
import { RegisterClient } from "@prisma/client"
import { apiErrors } from "../errors.js"
import {
	authenticateAdmin,
	createClient,
	retrieveTss,
	setTssAdminPin,
	updateTss
} from "../services/fiskalyApiService.js"
import {
	validateNameLength,
	validateSerialNumberLength
} from "../services/validationService.js"
import { ResolverContext } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"

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

	// Get the TSS & initialize it if necessary
	let tss = await retrieveTss(register.uuid)

	if (tss == null) {
		throwApiError(apiErrors.tssDoesNotExist)
	}

	// Authenticate the TSS for admin
	const authenticateAdminResponse = await authenticateAdmin(
		register.uuid,
		"12345678"
	)

	if (!authenticateAdminResponse) {
		throwApiError(apiErrors.unexpectedError)
	}

	if (tss.state === "CREATED") {
		// Set the state to UNINITIALIZED
		tss = await updateTss(register.uuid, "UNINITIALIZED")

		if (tss == null) {
			throwApiError(apiErrors.unexpectedError)
		}
	}

	if (tss.state === "UNINITIALIZED") {
		// Set an admin pin for the TSS
		const setPinResponse = await setTssAdminPin(
			register.uuid,
			register.adminPuk,
			"12345678"
		)

		if (!setPinResponse) {
			throwApiError(apiErrors.unexpectedError)
		}

		// Set the state to INITIALIZED
		tss = await updateTss(register.uuid, "INITIALIZED")

		if (tss == null) {
			throwApiError(apiErrors.unexpectedError)
		}
	}

	// Create the fiskaly client
	const uuid = crypto.randomUUID()

	const fiskalyClient = await createClient(
		register.uuid,
		uuid,
		args.serialNumber
	)

	if (fiskalyClient == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Create the register client
	return await context.prisma.registerClient.create({
		data: {
			uuid,
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
