import { Reservation, Table } from "../../prisma/generated/client.js"
import { DateTime } from "luxon"
import { apiErrors } from "../errors.js"
import { List, ResolverContext } from "../types.js"
import { throwApiError } from "../utils.js"

export async function listReservations(
	parent: any,
	args: {
		restaurantUuid: string
		date: string
	},
	context: ResolverContext
): Promise<List<Reservation>> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const restaurant = await context.prisma.restaurant.findFirst({
		where: {
			uuid: args.restaurantUuid
		},
		include: {
			company: true
		}
	})

	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if the user has access to the restaurant
	if (context.user.companyId !== restaurant.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	const date = DateTime.fromJSDate(new Date(args.date))

	const [total, items] = await context.prisma.$transaction([
		context.prisma.reservation.count({ where: {} }),
		context.prisma.reservation.findMany({
			where: {
				table: {
					room: {
						restaurantId: restaurant.id
					}
				},
				date: {
					gte: date.startOf("day").toJSDate(),
					lte: date.endOf("day").toJSDate()
				}
			},
			orderBy: {
				date: "asc"
			}
		})
	])

	return {
		total,
		items
	}
}

export async function updateReservation(
	parent: any,
	args: {
		uuid: string
		checkedIn?: boolean
	},
	context: ResolverContext
): Promise<Reservation> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the reservation
	const reservation = await context.prisma.reservation.findFirst({
		where: {
			uuid: args.uuid
		},
		include: {
			table: {
				include: {
					room: {
						include: {
							restaurant: {
								include: {
									company: true
								}
							}
						}
					}
				}
			}
		}
	})

	if (reservation == null) {
		throwApiError(apiErrors.reservationDoesNotExist)
	}

	// Check if the user can access the reservation
	if (reservation.table.room.restaurant.companyId !== context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	if (args.checkedIn == null) return reservation

	// Update the reservation
	const updatedReservation = await context.prisma.reservation.update({
		where: {
			id: reservation.id
		},
		data: {
			checkedIn: args.checkedIn ?? reservation.checkedIn
		}
	})

	return updatedReservation
}

export async function table(
	reservation: Reservation,
	args: {},
	context: ResolverContext
): Promise<Table> {
	return context.prisma.table.findFirst({
		where: {
			id: reservation.tableId
		}
	})
}

export function date(reservation: Reservation): string {
	return reservation.date.toISOString()
}
