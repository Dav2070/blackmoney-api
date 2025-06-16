import { Session, User } from "@prisma/client"
import { ResolverContext } from "../types.js"
import { apiErrors } from "../errors.js"
import { throwApiError } from "../utils.js"

export async function login(
	parent: any,
	args: { restaurantUuid: string; userName: string; password: string },
	context: ResolverContext
): Promise<Session> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
	let restaurant = await context.prisma.restaurant.findFirst({
		where: { uuid: args.restaurantUuid },
		include: { company: true }
	})

	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if the company of the restaurant belongs to the user
	if (restaurant.company.userId !== BigInt(context.davUser.Id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Get the user of the company by name & password
	let user = await context.prisma.user.findFirst({
		where: {
			restaurantId: restaurant.id,
			name: args.userName,
			password: args.password
		}
	})

	if (user == null) {
		throwApiError(apiErrors.loginFailed)
	}

	// Create a session for the user
	return context.prisma.session.create({
		data: {
			userId: user.id
		}
	})
}

export async function user(
	session: Session,
	args: {},
	context: ResolverContext
): Promise<User> {
	return await context.prisma.user.findFirst({
		where: { id: session.userId }
	})
}
