import { Register } from "@prisma/client"
import crypto from "crypto"
import { ResolverContext } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { apiErrors } from "../errors.js"
import { validateNameLength } from "../services/validationService.js"
import { createTss } from "../services/fiskalyApiService.js"

export async function createRegister(
	parent: any,
	args: {
		restaurantUuid: string
		name: string
	},
	context: ResolverContext
): Promise<Register> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
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

	// Check if the company of the restaurant belongs to the user
	if (restaurant.company.userId !== BigInt(context.davUser.Id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	const uuid = crypto.randomUUID()

	// Create the TSS
	const tss = await createTss(uuid)

	// Create the register
	return await context.prisma.register.create({
		data: {
			uuid,
			name: args.name,
			adminPuk: tss.admin_puk,
			restaurant: {
				connect: {
					id: restaurant.id
				}
			}
		}
	})
}
