import { Session, User } from "@prisma/client"
import bcrypt from "bcrypt"
import { ResolverContext } from "../types.js"
import { apiErrors } from "../errors.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { validateSerialNumberLength } from "../services/validationService.js"
import {
	authenticateAdmin,
	createClient,
	logoutAdmin
} from "../services/fiskalyApiService.js"

export async function login(
	parent: any,
	args: {
		companyUuid: string
		userName: string
		password: string
		registerUuid: string
		registerClientSerialNumber: string
	},
	context: ResolverContext
): Promise<Session> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the company
	let company = await context.prisma.company.findFirst({
		where: { uuid: args.companyUuid }
	})

	if (company == null) {
		throwApiError(apiErrors.companyDoesNotExist)
	}

	// Check if the company of the restaurant belongs to the user
	if (company.userId !== BigInt(context.davUser.Id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Get the user of the company by name & password
	let user = await context.prisma.user.findFirst({
		where: {
			companyId: company.id,
			name: args.userName
		}
	})

	if (user == null) {
		throwApiError(apiErrors.loginFailed)
	} else if (user.password == null) {
		throwApiError(apiErrors.userHasNoPassword)
	} else if (!(await bcrypt.compare(args.password, user.password))) {
		throwApiError(apiErrors.loginFailed)
	}

	// Get the register
	const register = await context.prisma.register.findFirst({
		where: {
			uuid: args.registerUuid
		},
		include: {
			restaurant: true
		}
	})

	if (register == null) {
		throwApiError(apiErrors.registerDoesNotExist)
	}

	// Check if the register belongs to the company
	if (register.restaurant.companyId !== company.id) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Try to find an existing register client with the serial number
	let registerClient = await context.prisma.registerClient.findFirst({
		where: {
			serialNumber: args.registerClientSerialNumber,
			registerId: register.id
		}
	})

	if (registerClient == null) {
		// Validate the serial number
		throwValidationError(
			validateSerialNumberLength(args.registerClientSerialNumber)
		)

		// Create a new register client
		registerClient = await context.prisma.registerClient.create({
			data: {
				serialNumber: args.registerClientSerialNumber,
				registerId: register.id
			}
		})

		// Create the fiskaly client
		// TODO: Check if fiskaly can have multiple clients with the same serial number
		await authenticateAdmin(register.uuid, register.adminPin)

		const fiskalyClient = await createClient(
			register.uuid,
			registerClient.uuid,
			registerClient.serialNumber
		)

		await logoutAdmin(register.uuid)

		if (fiskalyClient == null) {
			throwApiError(apiErrors.unexpectedError)
		}
	}

	// Create a session for the user
	return context.prisma.session.create({
		data: {
			user: {
				connect: { id: user.id }
			},
			registerClient: {
				connect: { id: registerClient.id }
			}
		}
	})
}

export async function user(
	session: Session,
	args: {},
	context: ResolverContext
): Promise<User> {
	return await context.prisma.user.findFirst({
		where: { id: session.userId }
	})
}
