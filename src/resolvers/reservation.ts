import { Reservation } from "../../prisma/generated/client.js"
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

export function date(reservation: Reservation): string {
	return reservation.date.toISOString()
}
