import { Restaurant, Room, User } from "@prisma/client"
import { List, ResolverContext } from "../types.js"

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
