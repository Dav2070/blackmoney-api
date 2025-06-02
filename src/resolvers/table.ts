import { apiErrors } from "../errors.js"
import { List, ResolverContext } from "../types.js"
import { throwApiError } from "../utils.js"
import { Order, Table } from "@prisma/client"

export async function retrieveTable(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<Table> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the table
	let table = await context.prisma.table.findFirst({
		where: { uuid: args.uuid },
		include: { room: true }
	})

	if (table == null) {
		return null
	}

	// Check if the room belongs to the user
	if (table.room.companyId != context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	let order = await context.prisma.order.findFirst({
		where: { paidAt: null, tableId: table.id }
	})

	if (order == null) {
		// Create a bill for the new order
		const bill = await context.prisma.bill.create({
			data: {
				uuid: crypto.randomUUID()
			}
		})

		// Create the order
		order = await context.prisma.order.create({
			data: {
				table: {
					connect: { id: table.id }
				},
				bill: {
					connect: { id: bill.id }
				}
			}
		})
	}

	return table
}

export async function createTable(
	parent: any,
	args: {
		roomUuid: string
	},
	context: ResolverContext
): Promise<Table> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the room
	let room = await context.prisma.room.findFirst({
		where: { uuid: args.roomUuid }
	})

	if (room == null) {
		throwApiError(apiErrors.roomDoesNotExist)
	}

	// Check if the room belongs to the user
	if (room.userId != BigInt(context.davUser.Id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Get the highest table number of the room
	let highestTableNumber = 0

	const tables = await context.prisma.table.findMany({
		where: { roomId: room.id }
	})

	if (tables.length > 0) {
		highestTableNumber = Math.max(...tables.map(table => table.name))
	}

	// Create the table
	return await context.prisma.table.create({
		data: {
			name: highestTableNumber + 1,
			roomId: room.id
		}
	})
}

export async function orders(
	table: Table,
	args: { paid?: boolean },
	context: ResolverContext
): Promise<List<Order>> {
	const where = {
		tableId: table.id
	}
	if (args.paid != null) {
		if (args.paid) {
			where["paidAt"] = {
				not: null
			}
		} else {
			where["paidAt"] = {
				equals: null
			}
		}
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.order.count({
			where
		}),
		context.prisma.order.findMany({
			where
		})
	])

	return {
		total,
		items
	}
}
