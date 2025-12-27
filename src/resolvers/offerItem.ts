import { OfferItem, Product } from "../../prisma/generated/client.js"
import { List, ResolverContext } from "../types.js"

export async function products(
	offerItem: OfferItem,
	args: {},
	context: ResolverContext
): Promise<List<Product>> {
	const offerItem2 = await context.prisma.offerItem.findFirst({
		where: { id: offerItem.id },
		include: { products: true }
	})

	return {
		total: offerItem2?.products.length ?? 0,
		items: offerItem2?.products ?? []
	}
}
