import { Restaurant, Room, User } from "@prisma/client"
import { List, ResolverContext } from "../types.js"
import { throwApiError } from "../utils.js"
import { apiErrors } from "../errors.js"

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

export async function users(
	restaurant: Restaurant,
	args: {},
	context: ResolverContext
): Promise<List<User>> {
	let where = { restaurantId: restaurant.id }

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
