import { Bill } from "@prisma/client"
import { ResolverContext } from "../types.js"
import { throwApiError } from "../utils.js"
import { apiErrors } from "../errors.js"

export async function createBill(
	parent: any,
	args: {
		registerClientUuid: string
	},
	context: ResolverContext
): Promise<Bill> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the register client
	const registerClient = await context.prisma.registerClient.findFirst({
		where: { uuid: args.registerClientUuid },
		include: {
			register: true
		}
	})

	if (registerClient == null) {
		throwApiError(apiErrors.registerDoesNotExist)
	}

	// Check if the user belongs to the same restaurant as the register client
	if (context.user.restaurantId !== registerClient.register.restaurantId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Create the bill
	return await context.prisma.bill.create({
		data: {
			registerClient: {
				connect: {
					id: registerClient.id
				}
			}
		}
	})
}
