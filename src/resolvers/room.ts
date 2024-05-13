import { apiErrors } from "../errors.js"
import { ResolverContext, List, Room, Table } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { validateNameLength } from "../services/validationService.js"

export async function createRoom(
	parent: any,
	args: {
		name: string
	},
	context: ResolverContext
): Promise<Room> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	// Create the room
	return await context.prisma.room.create({
		data: {
			name: args.name,
			userId: context.user.id
		}
	})
}

export async function listRooms(
	parent: any,
	args: {},
	context: ResolverContext
): Promise<List<Room>> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the rooms of the user
	const where = {
		userId: context.user.id
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
