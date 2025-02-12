import { Product, Variation } from "@prisma/client"
import { ResolverContext, List } from "../types.js"

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
