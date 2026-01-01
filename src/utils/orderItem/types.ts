import {
	OrderItem,
	OrderItemVariation,
	OrderItemVariationToVariationItem,
	Product
} from "../../../prisma/generated/client.js"

/**
 * Extended OrderItem type that includes all necessary relations for merging logic.
 * This type is used throughout the comparison and merging functions.
 */
export type OrderItemWithRelations = OrderItem & {
	product: Product
	orderItems: OrderItemWithRelations[]
	orderItemVariations: (OrderItemVariation & {
		orderItemVariationToVariationItems: OrderItemVariationToVariationItem[]
	})[]
	offer?: { id: bigint } | null
}
