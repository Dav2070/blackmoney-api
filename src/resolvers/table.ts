import { apiErrors } from "../errors.js"
import { List, ResolverContext } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { validateNameLength } from "../services/validationService.js"
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

	const order = await context.prisma.order.findFirst({
		where: { paidAt: null, tableId: table.id }
	})

	if (order == null) {
		await context.prisma.order.create({ data: { tableId: table.id } })
	}

	return table
}

export async function createTable(
	parent: any,
	args: {
		roomUuid: string
		name: string
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

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	// Create the table
	return await context.prisma.table.create({
		data: {
			name: args.name,
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
