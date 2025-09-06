import { Category, Product, Variation } from "@prisma/client"
import { ResolverContext, List } from "../types.js"

export function id(product: Product): number {
	return Number(product.id)
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
