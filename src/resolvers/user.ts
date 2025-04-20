import { User } from "@prisma/client"
import { ResolverContext } from "../types.js"
import { apiErrors } from "../errors.js"
import { throwApiError } from "../utils.js"

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
