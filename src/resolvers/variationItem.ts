import { VariationItem } from "../../prisma/generated/client.js"

export function id(variationItem: VariationItem): number {
	return Number(variationItem.id)
}
