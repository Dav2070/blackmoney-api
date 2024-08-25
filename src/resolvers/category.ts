import { apiErrors } from "../errors.js"
import { ResolverContext, List, Category, Product } from "../types.js"
import { throwApiError } from "../utils.js"

export async function listCategories(
	parent: any,
	args: {},
	context: ResolverContext
): Promise<List<Category>> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the categories
	const [total, items] = await context.prisma.$transaction([
		context.prisma.category.count(),
		context.prisma.category.findMany({
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
