import {
	OrderItemVariation,
	VariationItem
} from "../../prisma/generated/client.js"
import { ResolverContext, List } from "../types.js"

export async function variationItems(
	orderItemVariation: OrderItemVariation,
	args: {},
	context: ResolverContext
): Promise<List<VariationItem>> {
	const where = {
		orderItemVariationToVariationItems: {
			some: {
				orderItemVariationId: orderItemVariation.id
			}
		}
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.variationItem.count({ where }),
		context.prisma.variationItem.findMany({ where })
	])

	return {
		total,
		items
	}
}
