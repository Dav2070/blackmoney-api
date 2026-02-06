import {
	Category,
	Prisma,
	Product,
	Variation,
	Offer,
	ProductType
} from "../../prisma/generated/client.js"
import { ResolverContext, List } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { apiErrors } from "../errors.js"
import { validateNameLength } from "../services/validationService.js"

export async function searchProducts(
	parent: any,
	args: {
		restaurantUuid: string
		query: string
		exclude?: string[]
	},
	context: ResolverContext
): Promise<List<Product>> {
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

	// Search for products
	const where: Prisma.ProductWhereInput = {
		category: {
			menu: {
				restaurantId: restaurant.id
			}
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
		context.prisma.product.count({ where }),
		context.prisma.product.findMany({
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

export function shortcut(product: Product): number {
	return product.shortcut ?? Number(product.id)
}

export async function category(
	product: Product,
	args: {},
	context: ResolverContext
): Promise<Category> {
	return await context.prisma.category.findFirst({
		where: {
			id: product.categoryId
		}
	})
}

export async function offer(
	product: Product,
	args: {},
	context: ResolverContext
): Promise<Offer> {
	return await context.prisma.offer.findFirst({
		where: {
			productId: product.id
		}
	})
}

export async function variations(
	product: Product,
	args: {},
	context: ResolverContext
): Promise<List<Variation>> {
	let where = { productId: product.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.productToVariation.count({ where }),
		context.prisma.productToVariation.findMany({
			where,
			orderBy: { id: "asc" },
			include: {
				variation: true
			}
		})
	])

	return {
		total,
		items: items.map(item => item.variation)
	}
}

export async function createProduct(
	parent: any,
	args: {
		categoryUuid: string
		name: string
		price: number
		type: ProductType
		shortcut?: number
		variationUuids?: string[]
	},
	context: ResolverContext
): Promise<Product> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the category
	const category = await context.prisma.category.findFirst({
		where: { uuid: args.categoryUuid },
		include: { menu: { include: { restaurant: true } } }
	})

	if (category == null) {
		throwApiError(apiErrors.categoryDoesNotExist)
	}

	// Check if the user belongs to the same company and has the correct role
	if (
		context.user.companyId !== category.menu.restaurant.companyId ||
		!["ADMIN", "OWNER"].includes(context.user.role)
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	// Validate price
	if (args.price < 0) {
		throwApiError(apiErrors.priceMustBePositive)
	}

	// Create the product
	const product = await context.prisma.product.create({
		data: {
			name: args.name,
			price: args.price,
			type: args.type,
			shortcut: args.shortcut,
			categoryId: category.id
		}
	})

	// Add variations if provided
	if (args.variationUuids && args.variationUuids.length > 0) {
		for (const variationUuid of args.variationUuids) {
			const variation = await context.prisma.variation.findFirst({
				where: { uuid: variationUuid }
			})

			if (variation != null) {
				await context.prisma.productToVariation.create({
					data: {
						productId: product.id,
						variationId: variation.id
					}
				})
			}
		}
	}

	return product
}

export async function updateProduct(
	parent: any,
	args: {
		uuid: string
		name?: string
		price?: number
		shortcut?: number
		variationUuids?: string[]
	},
	context: ResolverContext
): Promise<Product> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the product
	const product = await context.prisma.product.findFirst({
		where: { uuid: args.uuid },
		include: { category: { include: { menu: { include: { restaurant: true } } } } }
	})

	if (product == null) {
		throwApiError(apiErrors.productDoesNotExist)
	}

	// Check if the user belongs to the same company and has the correct role
	if (
		context.user.companyId !== product.category.menu.restaurant.companyId ||
		!["ADMIN", "OWNER"].includes(context.user.role)
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the name if provided
	if (args.name != null) {
		throwValidationError(validateNameLength(args.name))
	}

	// Validate price if provided
	if (args.price != null && args.price < 0) {
		throwApiError(apiErrors.priceMustBePositive)
	}

	// Update the product
	const updatedProduct = await context.prisma.product.update({
		where: { id: product.id },
		data: {
			...(args.name != null && { name: args.name }),
			...(args.price != null && { price: args.price }),
			...(args.shortcut != null && { shortcut: args.shortcut })
		}
	})

	// Update variations if provided
	if (args.variationUuids != null) {
		// Remove all existing variations
		await context.prisma.productToVariation.deleteMany({
			where: { productId: product.id }
		})

		// Add new variations
		for (const variationUuid of args.variationUuids) {
			const variation = await context.prisma.variation.findFirst({
				where: { uuid: variationUuid }
			})

			if (variation != null) {
				await context.prisma.productToVariation.create({
					data: {
						productId: product.id,
						variationId: variation.id
					}
				})
			}
		}
	}

	return updatedProduct
}

export async function deleteProduct(
	parent: any,
	args: {
		uuid: string
	},
	context: ResolverContext
): Promise<Product> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the product
	const product = await context.prisma.product.findFirst({
		where: { uuid: args.uuid },
		include: { category: { include: { menu: { include: { restaurant: true } } } } }
	})

	if (product == null) {
		throwApiError(apiErrors.productDoesNotExist)
	}

	// Check if the user belongs to the same company and has the correct role
	if (
		context.user.companyId !== product.category.menu.restaurant.companyId ||
		!["ADMIN", "OWNER"].includes(context.user.role)
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Delete product-to-variation relationships first
	await context.prisma.productToVariation.deleteMany({
		where: { productId: product.id }
	})

	// Delete the offer if it exists
	await context.prisma.offer.deleteMany({
		where: { productId: product.id }
	})

	// Delete the product (cascade will handle related records)
	return await context.prisma.product.delete({
		where: { id: product.id }
	})
}
