import { Variation, VariationItem } from "../../prisma/generated/client.js"
import { ResolverContext, List } from "../types.js"

export async function variationItems(
	variation: Variation,
	args: {},
	context: ResolverContext
): Promise<List<VariationItem>> {
	let where = { variationId: variation.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.variationItem.count({ where }),
		context.prisma.variationItem.findMany({
			where,
			orderBy: { id: "asc" }
		})
	])

	return {
		total,
		items
	}
}
