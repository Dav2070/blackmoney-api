import { Register, RegisterClient } from "@prisma/client"
import crypto from "crypto"
import { List, ResolverContext } from "../types.js"
import {
	throwApiError,
	throwValidationError,
	generateAdminPin
} from "../utils.js"
import { apiErrors } from "../errors.js"
import { validateNameLength } from "../services/validationService.js"
import {
	createTss,
	updateTss,
	setTssAdminPin,
	authenticateAdmin,
	logoutAdmin
} from "../services/fiskalyApiService.js"

export async function retrieveRegister(
	parent: any,
	args: {
		uuid: string
	},
	context: ResolverContext
): Promise<Register> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const register = await context.prisma.register.findFirst({
		where: { uuid: args.uuid },
		include: { restaurant: true }
	})

	if (register == null) {
		return null
	}

	// Check if the user has access to the restaurant of the register
	if (context.user.companyId !== register.restaurant.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	return register
}

export async function createRegister(
	parent: any,
	args: {
		restaurantUuid: string
		name: string
	},
	context: ResolverContext
): Promise<Register> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findFirst({
		where: {
			uuid: args.restaurantUuid
		},
		include: {
			company: true
		}
	})

	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if the company of the restaurant belongs to the user
	if (restaurant.company.userId !== BigInt(context.davUser.Id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

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
	return await context.prisma.register.create({
		data: {
			uuid,
			name: args.name,
			adminPin,
			restaurant: {
				connect: {
					id: restaurant.id
				}
			}
		}
	})
}

export async function registerClients(
	register: Register,
	args: {},
	context: ResolverContext
): Promise<List<RegisterClient>> {
	let where = { registerId: register.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.registerClient.count({ where }),
		context.prisma.registerClient.findMany({ where })
	])

	return {
		total,
		items
	}
}
