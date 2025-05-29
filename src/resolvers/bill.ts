import { Bill } from "@prisma/client"
import { ResolverContext } from "../types.js"
import { throwApiError } from "../utils.js"
import { apiErrors } from "../errors.js"

export async function createBill(
	parent: any,
	args: {},
	context: ResolverContext
): Promise<Bill> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Create the bill
	return await context.prisma.bill.create({})
}
