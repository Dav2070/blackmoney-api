import { Company, Restaurant } from "@prisma/client"
import { apiErrors } from "../errors.js"
import { List, ResolverContext } from "../types.js"
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

	// Create the company and the first restaurant for the company
	return await context.prisma.company.create({
		data: {
			name: args.name,
			userId: BigInt(context.davUser.Id),
			restaurants: {
				create: {
					name: args.name
				}
			}
		}
	})
}

export async function restaurants(
	company: Company,
	args: {},
	context: ResolverContext
): Promise<List<Restaurant>> {
	let where = { companyId: company.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.restaurant.count({ where }),
		context.prisma.restaurant.findMany({
			where,
			orderBy: { name: "asc" }
		})
	])

	return {
		total,
		items
	}
}
