import { apiErrors } from "../errors.js"
import { ResolverContext, List, Room, Table } from "../types.js"
import { throwApiError } from "../utils.js"

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
