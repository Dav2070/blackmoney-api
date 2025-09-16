import { apiErrors } from "../errors.js"
import { ResolverContext, List, Room, Table } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { validateNameLength } from "../services/validationService.js"

export async function retrieveRoom(
	parent: any,
	args: {
		uuid: string
	},
	context: ResolverContext
): Promise<Room> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const room = await context.prisma.room.findFirst({
		where: { uuid: args.uuid },
		include: { restaurant: true }
	})

	if (room == null) {
		return null
	}

	// Check if the user has access to the restaurant of the room
	if (context.user.companyId !== room.restaurant.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	return room
}

export async function createRoom(
	parent: any,
	args: {
		restaurantUuid: string
		name: string
	},
	context: ResolverContext
): Promise<Room> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findUnique({
		where: { uuid: args.restaurantUuid }
	})

	// Check if the restaurant exists
	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// TODO: Check if the user can create a room in this restaurant

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	// Create the room
	return await context.prisma.room.create({
		data: {
			name: args.name,
			restaurant: {
				connect: {
					id: restaurant.id
				}
			}
		}
	})
}

export async function listRooms(
	parent: any,
	args: {
		restaurantUuid: string
	},
	context: ResolverContext
): Promise<List<Room>> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findFirst({
		where: { uuid: args.restaurantUuid }
	})

	// Check if the restaurant exists
	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Get the rooms of the restaurant
	const where = {
		restaurantId: restaurant.id
	}

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

export async function tables(
	room: Room,
	args: {},
	context: ResolverContext
): Promise<List<Table>> {
	let where = { roomId: room.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.table.count({ where }),
		context.prisma.table.findMany({
			where,
			orderBy: { name: "asc" }
		})
	])

	return {
		total,
		items
	}
}
