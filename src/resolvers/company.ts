import { Company, User } from "@prisma/client"
import { apiErrors } from "../errors.js"
import { ResolverContext, List } from "../types.js"
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

export async function users(
	company: Company,
	args: any,
	context: ResolverContext
): Promise<List<User>> {
	let where = { companyId: company.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.user.count({ where }),
		context.prisma.user.findMany({
			where,
			orderBy: { name: "asc" }
		})
	])

	return {
		total,
		items
	}
}
