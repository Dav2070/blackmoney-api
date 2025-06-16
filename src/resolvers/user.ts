import { User } from "@prisma/client"
import { validateNameLength } from "../services/validationService.js"
import { ResolverContext } from "../types.js"
import { apiErrors } from "../errors.js"
import { throwApiError, throwValidationError } from "../utils.js"

export async function retrieveUser(
	parent: any,
	args: {},
	context: ResolverContext
): Promise<User> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the user
	return context.user
}

export async function createUser(
	parent: any,
	args: { restaurantUuid: string; name: string },
	context: ResolverContext
): Promise<User> {
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

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	// Create the user
	return await context.prisma.user.create({
		data: {
			restaurant: {
				connect: {
					id: restaurant.id
				}
			},
			name: args.name,
			password: "123456"
		}
	})
}
