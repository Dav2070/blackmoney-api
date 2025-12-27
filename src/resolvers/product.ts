import {
	Category,
	Prisma,
	Product,
	Variation,
	Offer
} from "../../prisma/generated/client.js"
import { ResolverContext, List } from "../types.js"
import { throwApiError } from "../utils.js"
import { apiErrors } from "../errors.js"

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
