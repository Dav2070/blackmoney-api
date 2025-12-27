import { Offer, OfferItem } from "../../prisma/generated/client.js"
import { List, ResolverContext } from "../types.js"

export function id(offer: Offer): number {
	return Number(offer.id)
}

export async function offerItems(
	offer: Offer,
	args: {},
	context: ResolverContext
): Promise<List<OfferItem>> {
	const where = { offerId: offer.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.offerItem.count({ where }),
		context.prisma.offerItem.findMany({ where })
	])

	return {
		total,
		items
	}
}
