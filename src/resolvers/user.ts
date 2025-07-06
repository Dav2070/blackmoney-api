import { User } from "@prisma/client"
import {
	validateNameLength,
	validatePasswordLength
} from "../services/validationService.js"
import { ResolverContext } from "../types.js"
import { apiErrors } from "../errors.js"
import { throwApiError, throwValidationError } from "../utils.js"

export async function retrieveUser(
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

export async function createOwner(
	parent: any,
	args: {
		restaurantUuid: string
		name: string
		password: string
	},
	context: ResolverContext
): Promise<User> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findFirst({
		where: { uuid: args.restaurantUuid },
		include: { company: true }
	})

	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if the company of the restaurant belongs to the user
	if (restaurant.company.userId !== BigInt(context.davUser.Id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Check if the restaurant already has an owner
	const existingOwner = await context.prisma.user.findFirst({
		where: {
			restaurantId: restaurant.id,
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
			restaurant: {
				connect: {
					id: restaurant.id
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
	args: { restaurantUuid: string; name: string },
	context: ResolverContext
): Promise<User> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Check if the user is an owner
	if (context.user.role !== "OWNER") {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Get the restaurant
	let restaurant = await context.prisma.restaurant.findFirst({
		where: { uuid: args.restaurantUuid },
		include: { company: true }
	})

	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if the restaurant belongs to the user
	if (context.user.restaurantId !== restaurant.id) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	// Create the user
	return await context.prisma.user.create({
		data: {
			restaurant: {
				connect: {
					id: restaurant.id
				}
			},
			name: args.name,
			password: "123456"
		}
	})
}
