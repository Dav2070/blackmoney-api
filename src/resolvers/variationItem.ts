import { VariationItem } from "@prisma/client"

export function id(variationItem: VariationItem): number {
	return Number(variationItem.id)
}
