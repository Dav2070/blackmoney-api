import {
	Company,
	Restaurant,
	User,
	UserRole
} from "../../prisma/generated/client.js"
import bcrypt from "bcrypt"
import {
	validateNameLength,
	validatePasswordLength
} from "../services/validationService.js"
import { ResolverContext } from "../types.js"
import { apiErrors } from "../errors.js"
import { bcryptRounds } from "../constants.js"
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
			password: await bcrypt.hash(args.password, bcryptRounds),
			role: "OWNER",
			restaurants: {
				connect: company.restaurants.map(restaurant => ({
					id: restaurant.id
				}))
			}
		}
	})
}

export async function createUser(
	parent: any,
	args: {
		companyUuid: string
		name: string
		role?: UserRole
		restaurants: string[]
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

	// Get the company
	let company = await context.prisma.company.findFirst({
		where: { uuid: args.companyUuid },
		include: { restaurants: true }
	})

	if (company == null) {
		throwApiError(apiErrors.companyDoesNotExist)
	}

	// Check if the company belongs to the user
	if (context.user.companyId !== company.id) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Get the restaurants
	const restaurants: Restaurant[] = []

	for (let restaurantUuid of args.restaurants) {
		const restaurant = await context.prisma.restaurant.findFirst({
			where: { uuid: restaurantUuid, companyId: company.id }
		})

		if (restaurant) {
			restaurants.push(restaurant)
		}
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
			role: args.role ?? "USER",
			restaurants: {
				connect: restaurants.map(restaurant => ({ id: restaurant.id }))
			}
		}
	})
}

export async function setPasswordForUser(
	parent: any,
	args: {
		uuid: string
		password: string
	},
	context: ResolverContext
): Promise<User> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the user
	const user = await context.prisma.user.findFirst({
		where: { uuid: args.uuid }
	})

	if (user == null) {
		throwApiError(apiErrors.userDoesNotExist)
	}

	// Check if the user belongs to the same company as the logged in user
	const company = await context.prisma.company.findFirst({
		where: { userId: context.davUser.Id }
	})

	if (company == null || company.id !== user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Check if the user already has a password
	if (user.password != null) {
		throwApiError(apiErrors.userAlreadyHasPassword)
	}

	// Validate the password
	throwValidationError(validatePasswordLength(args.password))

	// Set the initial password
	return await context.prisma.user.update({
		where: { id: user.id },
		data: { password: await bcrypt.hash(args.password, bcryptRounds) }
	})
}

export async function resetPasswordOfUser(
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

	// Get the user
	const user = await context.prisma.user.findFirst({
		where: { uuid: args.uuid }
	})

	if (user == null) {
		throwApiError(apiErrors.userDoesNotExist)
	}

	// Check if the user belongs to the same company as the logged in user
	if (user.companyId !== context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Reset the password
	return await context.prisma.user.update({
		where: { id: user.id },
		data: { password: null }
	})
}

export async function company(
	user: User,
	args: {},
	context: ResolverContext
): Promise<Company> {
	return await context.prisma.company.findFirst({
		where: { id: user.companyId }
	})
}
