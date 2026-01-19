import {
	Menu,
	Printer,
	Register,
	Restaurant,
	Room,
	User,
	Address
} from "../../prisma/generated/client.js"
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
		houseNumber?: string
		line2?: string
		postalCode?: string
		owner?: string
		taxNumber?: string
		mail?: string
		phoneNumber?: string
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
	let restaurant = await context.prisma.restaurant.findFirst({
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
		args.houseNumber == null &&
		args.line2 == null &&
		args.postalCode == null &&
		args.owner == null &&
		args.taxNumber == null &&
		args.mail == null &&
		args.phoneNumber == null
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

	// Update the restaurant name if provided
	let restaurantData: any = {}
	if (args.name != null) {
		restaurantData.name = args.name
	}
	if (args.owner != null) {
		restaurantData.owner = args.owner
	}
	if (args.taxNumber != null) {
		restaurantData.taxNumber = args.taxNumber
	}
	if (args.mail != null) {
		restaurantData.mail = args.mail
	}
	if (args.phoneNumber != null) {
		restaurantData.phoneNumber = args.phoneNumber
	}

	if (Object.keys(restaurantData).length > 0) {
		restaurant = await context.prisma.restaurant.update({
			where: { id: restaurant.id },
			data: restaurantData
		})
	}

	// Update or create address if address fields are provided
	if (
		args.city != null ||
		args.country != null ||
		args.line1 != null ||
		args.houseNumber != null ||
		args.line2 != null ||
		args.postalCode != null
	) {
		const existingAddress = await context.prisma.address.findFirst({
			where: { restaurantId: restaurant.id }
		})

		let addressData: any = {}
		if (args.city != null) {
			addressData.city = args.city
		}
		if (args.country != null) {
			addressData.country = args.country
		}
		if (args.line1 != null) {
			addressData.line1 = args.line1
		}
		if (args.houseNumber != null) {
			addressData.houseNumber = args.houseNumber
		}
		if (args.line2 != null) {
			addressData.line2 = args.line2
		}
		if (args.postalCode != null) {
			addressData.postalCode = args.postalCode
		}

		if (Object.keys(addressData).length > 0) {
			if (existingAddress) {
				await context.prisma.address.update({
					where: { id: existingAddress.id },
					data: addressData
				})
			} else {
				await context.prisma.address.create({
					data: {
						restaurantId: restaurant.id,
						...addressData
					}
				})
			}
		}
	}

	return restaurant
}

export async function menu(
	restaurant: Restaurant,
	args: {},
	context: ResolverContext
): Promise<Menu> {
	return await context.prisma.menu.findFirst({
		where: { restaurantId: restaurant.id }
	})
}

export async function address(
	restaurant: Restaurant,
	args: {},
	context: ResolverContext
): Promise<Address> {
	return await context.prisma.address.findFirst({
		where: { restaurantId: restaurant.id }
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

export async function registers(
	restaurant: Restaurant,
	args: {},
	context: ResolverContext
): Promise<List<Register>> {
	let where = { restaurantId: restaurant.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.register.count({ where }),
		context.prisma.register.findMany({
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
