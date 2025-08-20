import { Printer, Restaurant, Room, User } from "@prisma/client"
import { Country, List, ResolverContext } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { apiErrors } from "../errors.js"
import {
	validateCityLength,
	validateLine1Length,
	validateLine2Length,
	validateNameLength,
	validatePostalCode
} from "../services/validationService.js"

export async function retrieveRestaurant(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<Restaurant> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const restaurant = await context.prisma.restaurant.findFirst({
		where: {
			uuid: args.uuid
		},
		include: {
			company: true
		}
	})

	if (restaurant == null) {
		return null
	}

	// Check if the user has access to the restaurant
	if (restaurant.company.userId !== BigInt(context.davUser.Id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	return restaurant
}

export async function updateRestaurant(
	parent: any,
	args: {
		uuid: string
		name?: string
		city?: string
		country?: Country
		line1?: string
		line2?: string
		postalCode?: string
	},
	context: ResolverContext
): Promise<Restaurant> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Check if the user is an owner or admin
	if (!["ADMIN", "OWNER"].includes(context.user.role)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findFirst({
		where: { uuid: args.uuid }
	})

	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if the user can edit the restaurant
	if (context.user.role === "ADMIN") {
		const userRestaurant = await context.prisma.userToRestaurant.findFirst({
			where: {
				userId: context.user.id,
				restaurantId: restaurant.id
			}
		})

		if (userRestaurant == null) {
			throwApiError(apiErrors.actionNotAllowed)
		}
	}

	if (
		args.name == null &&
		args.city == null &&
		args.country == null &&
		args.line1 == null &&
		args.line2 == null &&
		args.postalCode == null
	) {
		return restaurant
	}

	// Validate the args
	let errors: string[] = []

	if (args.name != null) {
		errors.push(validateNameLength(args.name))
	}

	if (args.city != null) {
		errors.push(validateCityLength(args.city))
	}

	if (args.line1 != null) {
		errors.push(validateLine1Length(args.line1))
	}

	if (args.line2 != null) {
		errors.push(validateLine2Length(args.line2))
	}

	if (args.postalCode != null) {
		errors.push(validatePostalCode(args.postalCode))
	}

	throwValidationError(...errors)

	// Update the restaurant
	let data: any = {}

	if (args.name != null) {
		data.name = args.name
	}

	if (args.city != null) {
		data.city = args.city
	}

	if (args.country != null) {
		data.country = args.country
	}

	if (args.line1 != null) {
		data.line1 = args.line1
	}

	if (args.line2 != null) {
		data.line2 = args.line2
	}

	if (args.postalCode != null) {
		data.postalCode = args.postalCode
	}

	return await context.prisma.restaurant.update({
		where: { id: restaurant.id },
		data
	})
}

export async function users(
	restaurant: Restaurant,
	args: {},
	context: ResolverContext
): Promise<List<User>> {
	let where = {
		userToRestaurants: {
			some: {
				restaurantId: restaurant.id
			}
		}
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.user.count({ where }),
		context.prisma.user.findMany({
			where,
			orderBy: { name: "asc" }
		})
	])

	return {
		total,
		items
	}
}

export async function rooms(
	restaurant: Restaurant,
	args: {},
	context: ResolverContext
): Promise<List<Room>> {
	let where = { restaurantId: restaurant.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.room.count({ where }),
		context.prisma.room.findMany({
			where,
			orderBy: { name: "asc" }
		})
	])

	return {
		total,
		items
	}
}

export async function printers(
	restaurant: Restaurant,
	args: {},
	context: ResolverContext
): Promise<List<Printer>> {
	let where = { restaurantId: restaurant.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.printer.count({ where }),
		context.prisma.printer.findMany({
			where,
			orderBy: { name: "asc" }
		})
	])

	return {
		total,
		items
	}
}
