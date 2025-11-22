import { Prisma, Product } from "@prisma/client"
import { apiErrors } from "../errors.js"
import { ResolverContext, List, Category } from "../types.js"
import { throwApiError } from "../utils.js"

export async function searchCategories(
	parent: any,
	args: {
		restaurantUuid: string
		query: string
		exclude?: string[]
	},
	context: ResolverContext
): Promise<List<Category>> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findFirst({
		where: { uuid: args.restaurantUuid }
	})

	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if the restaurant belongs to the same company as the user
	if (restaurant.companyId !== context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Search for categories
	const where: Prisma.CategoryWhereInput = {
		menu: {
			restaurantId: restaurant.id
		},
		name: {
			contains: args.query,
			mode: "insensitive"
		},
		uuid: {
			notIn: args.exclude ?? []
		}
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.category.count({ where }),
		context.prisma.category.findMany({
			where,
			take: 10,
			orderBy: {
				name: "asc"
			}
		})
	])

	return {
		total,
		items
	}
}

export async function listCategories(
	parent: any,
	args: {
		restaurantUuid: string
	},
	context: ResolverContext
): Promise<List<Category>> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findFirst({
		where: { uuid: args.restaurantUuid }
	})

	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if the restaurant belongs to the same company as the user
	if (restaurant.companyId !== context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	const where = {
		menu: {
			restaurantId: restaurant.id
		}
	}

	// Get the categories
	const [total, items] = await context.prisma.$transaction([
		context.prisma.category.count({ where }),
		context.prisma.category.findMany({
			where,
			orderBy: { name: "asc" }
		})
	])

	return {
		total,
		items
	}
}

export async function products(
	category: Category,
	args: {},
	context: ResolverContext
): Promise<List<Product>> {
	let where = { categoryId: category.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.product.count({ where }),
		context.prisma.product.findMany({
			where,
			orderBy: { name: "asc" }
		})
	])

	return {
		total,
		items
	}
}
