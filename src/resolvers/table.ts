import { Order, Table } from "@prisma/client"
import { apiErrors } from "../errors.js"
import { List, ResolverContext } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import {
	validateTableName,
	validateSeats
} from "../services/validationService.js"

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
		include: {
			room: {
				include: {
					restaurant: true
				}
			}
		}
	})

	if (table == null) {
		return null
	}

	// Check if the user can access the table
	if (table.room.restaurant.companyId !== context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	let order = await context.prisma.order.findFirst({
		where: { paidAt: null, tableId: table.id }
	})

	if (order == null) {
		// Create the order
		order = await context.prisma.order.create({
			data: {
				table: {
					connect: { id: table.id }
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
		name: number
		seats: number
	},
	context: ResolverContext
): Promise<Table> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the room
	let room = await context.prisma.room.findFirst({
		where: { uuid: args.roomUuid },
		include: { restaurant: true }
	})

	if (room == null) {
		throwApiError(apiErrors.roomDoesNotExist)
	}

	// Check if the room belongs to the same restaurant as the user
	if (room.restaurant.companyId !== context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the args
	throwValidationError(validateTableName(args.name), validateSeats(args.seats))

	// Check if the table with the name already exists
	let existingTable = await context.prisma.table.findFirst({
		where: { roomId: room.id, name: args.name }
	})

	if (existingTable != null) {
		throwApiError(apiErrors.tableAlreadyExists)
	}

	// Create the table
	return await context.prisma.table.create({
		data: {
			room: {
				connect: { id: room.id }
			},
			name: args.name,
			seats: args.seats
		}
	})
}

export async function updateTable(
	parent: any,
	args: {
		uuid: string
		seats?: number
	},
	context: ResolverContext
): Promise<Table> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the table
	const table = await context.prisma.table.findFirst({
		where: { uuid: args.uuid },
		include: {
			room: {
				include: {
					restaurant: true
				}
			}
		}
	})

	if (table == null) {
		throwApiError(apiErrors.tableDoesNotExist)
	}

	// Check if the user can access the table
	if (table.room.restaurant.companyId !== context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	if (args.seats == null) return table

	// Validate the args
	throwValidationError(validateSeats(args.seats))

	// Update the table
	return await context.prisma.table.update({
		where: { id: table.id },
		data: {
			seats: args.seats
		}
	})
}

export async function deleteTable(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<Table> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the table
	const table = await context.prisma.table.findFirst({
		where: { uuid: args.uuid },
		include: {
			room: {
				include: {
					restaurant: true
				}
			}
		}
	})

	if (table == null) {
		throwApiError(apiErrors.tableDoesNotExist)
	}

	// Check if the user can access the table
	if (table.room.restaurant.companyId !== context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Delete the table
	return await context.prisma.table.delete({
		where: { id: table.id }
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
