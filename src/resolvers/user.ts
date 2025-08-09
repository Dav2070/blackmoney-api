import { User, UserRole } from "@prisma/client"
import {
	validateNameLength,
	validatePasswordLength
} from "../services/validationService.js"
import { ResolverContext } from "../types.js"
import { apiErrors } from "../errors.js"
import { throwApiError, throwValidationError } from "../utils.js"

export async function retrieveOwnUser(
	parent: any,
	args: {},
	context: ResolverContext
): Promise<User> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the user
	return context.user
}

export async function retrieveUser(
	parent: any,
	args: {
		uuid: string
	},
	context: ResolverContext
): Promise<User> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Check if the user is an owner
	if (!["OWNER", "ADMIN"].includes(context.user.role)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Retrieve the user
	const user = await context.prisma.user.findFirst({
		where: { uuid: args.uuid }
	})

	// Check if the user exists
	if (user == null) {
		throwApiError(apiErrors.userDoesNotExist)
	}

	// Check if the user belongs to the same company as the logged in user
	if (user.companyId !== context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	return user
}

export async function createOwner(
	parent: any,
	args: {
		companyUuid: string
		name: string
		password: string
	},
	context: ResolverContext
): Promise<User> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the company
	const company = await context.prisma.company.findFirst({
		where: { uuid: args.companyUuid },
		include: { restaurants: true }
	})

	if (company == null) {
		throwApiError(apiErrors.companyDoesNotExist)
	}

	// Check if the company of the restaurant belongs to the user
	if (company.userId !== BigInt(context.davUser.Id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Check if the restaurant already has an owner
	const existingOwner = await context.prisma.user.findFirst({
		where: {
			companyId: company.id,
			role: "OWNER"
		}
	})

	if (existingOwner != null) {
		throwApiError(apiErrors.restaurantAlreadyHasOwner)
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	// Validate the password
	throwValidationError(validatePasswordLength(args.password))

	// Create the user
	return await context.prisma.user.create({
		data: {
			company: {
				connect: {
					id: company.id
				}
			},
			name: args.name,
			password: args.password,
			role: "OWNER"
		}
	})
}

export async function createUser(
	parent: any,
	args: { companyUuid: string; name: string; role?: UserRole },
	context: ResolverContext
): Promise<User> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Check if the user is an owner
	if (!["OWNER", "ADMIN"].includes(context.user.role)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Get the company
	let company = await context.prisma.company.findFirst({
		where: { uuid: args.companyUuid },
		include: { restaurants: true }
	})

	if (company == null) {
		throwApiError(apiErrors.companyDoesNotExist)
	}

	// Check if the restaurant belongs to the user
	if (context.user.companyId !== company.id) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	// Create the user
	return await context.prisma.user.create({
		data: {
			company: {
				connect: {
					id: company.id
				}
			},
			name: args.name,
			role: args.role ?? "USER"
		}
	})
}
