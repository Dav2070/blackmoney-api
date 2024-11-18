import { Company } from "@prisma/client"
import { apiErrors } from "../errors.js"
import { ResolverContext } from "../types.js"
import { throwApiError } from "../utils.js"

export async function retrieveCompany(
	parent: any,
	args: any,
	context: ResolverContext
): Promise<Company> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	return await context.prisma.company.findFirst({
		where: { userId: context.davUser.Id }
	})
}
