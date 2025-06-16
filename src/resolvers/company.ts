import { Company } from "@prisma/client"
import { apiErrors } from "../errors.js"
import { ResolverContext } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { validateNameLength } from "../services/validationService.js"

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

export async function createCompany(
	parent: any,
	args: { name: string },
	context: ResolverContext
): Promise<Company> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Check if the user already has a company
	const existingCompany = await context.prisma.company.findFirst({
		where: { userId: BigInt(context.davUser.Id) }
	})

	if (existingCompany != null) {
		throwApiError(apiErrors.companyAlreadyExists)
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	return await context.prisma.company.create({
		data: {
			name: args.name,
			userId: BigInt(context.davUser.Id)
		}
	})
}
