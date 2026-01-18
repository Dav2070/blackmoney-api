import { Prisma, Product, ProductType } from "../../prisma/generated/client.js"
import { apiErrors } from "../errors.js"
import { ResolverContext, List, Category } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { validateNameLength } from "../services/validationService.js"
import { randomUUID } from "crypto"

export async function retrieveCategory(
	parent: any,
	args: {
		uuid: string
	},
	context: ResolverContext
): Promise<Category> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const category = await context.prisma.category.findFirst({
		where: { uuid: args.uuid },
		include: { menu: { include: { restaurant: true } } }
	})

	if (category == null) {
		throwApiError(apiErrors.categoryDoesNotExist)
	}

	// Check if the user belongs to the same company as the category's restaurant
	if (context.user.companyId !== category.menu.restaurant.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	return category
}

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

export async function createCategory(
	parent: any,
	args: {
		restaurantUuid: string
		name: string
	},
	context: ResolverContext
): Promise<Category> {
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

	// Check if the user belongs to the same company as the restaurant and has the correct role
	if (
		context.user.companyId !== restaurant.companyId ||
		!["ADMIN", "OWNER"].includes(context.user.role)
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	// Get the menu for this restaurant
	const menu = await context.prisma.menu.findFirst({
		where: { restaurantId: restaurant.id }
	})

	if (menu == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if a category with the same name already exists in this restaurant's menu
	const existingCategory = await context.prisma.category.findFirst({
		where: {
			menuId: menu.id,
			name: {
				equals: args.name,
				mode: "insensitive"
			}
		}
	})

	if (existingCategory != null) {
		throwApiError(apiErrors.categoryNameAlreadyInUse)
	}

	// Create the category
	return await context.prisma.category.create({
		data: {
			uuid: randomUUID(),
			name: args.name,
			menuId: menu.id
		}
	})
}

export async function updateCategory(
	parent: any,
	args: {
		uuid: string
		name?: string
	},
	context: ResolverContext
): Promise<Category> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the category
	const category = await context.prisma.category.findFirst({
		where: { uuid: args.uuid },
		include: { menu: { include: { restaurant: true } } }
	})

	if (category == null) {
		throwApiError(apiErrors.categoryDoesNotExist)
	}

	// Check if the category belongs to the same company as the user and if the user has the correct role
	if (
		context.user.companyId !== category.menu.restaurant.companyId ||
		!["ADMIN", "OWNER"].includes(context.user.role)
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	if (args.name == null) {
		return category
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	// Check if a category with the same name already exists in this restaurant's menu (excluding current category)
	const existingCategory = await context.prisma.category.findFirst({
		where: {
			menuId: category.menuId,
			name: {
				equals: args.name,
				mode: "insensitive"
			},
			id: {
				not: category.id
			}
		}
	})

	if (existingCategory != null) {
		throwApiError(apiErrors.categoryNameAlreadyInUse)
	}

	// Update the category
	return await context.prisma.category.update({
		where: { id: category.id },
		data: {
			name: args.name
		}
	})
}

export async function deleteCategory(
	parent: any,
	args: {
		uuid: string
	},
	context: ResolverContext
): Promise<Category> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the category
	const category = await context.prisma.category.findFirst({
		where: { uuid: args.uuid },
		include: { menu: { include: { restaurant: true } } }
	})

	if (category == null) {
		throwApiError(apiErrors.categoryDoesNotExist)
	}

	// Check if the category belongs to the same company as the user and if the user has the correct role
	if (
		context.user.companyId !== category.menu.restaurant.companyId ||
		!["ADMIN", "OWNER"].includes(context.user.role)
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Delete the category
	return await context.prisma.category.delete({
		where: { id: category.id }
	})
}

export async function products(
	category: Category,
	args: {
		type?: ProductType
	},
	context: ResolverContext
): Promise<List<Product>> {
	const where: Prisma.ProductWhereInput = {
		categoryId: category.id
	}

	if (args.type != null) {
		where.type = args.type
	}

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
