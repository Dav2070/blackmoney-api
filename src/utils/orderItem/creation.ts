import {
	Order,
	OrderItemType,
	PrismaClient
} from "../../../prisma/generated/client.js"
import { apiErrors } from "../../errors.js"
import { throwApiError } from "../../utils.js"
import { ProductInput } from "../../types/orderTypes.js"
import { resolveVariationsFromInput } from "./resolvers.js"

/**
 * OrderItem Creation Functions
 *
 * These functions handle the creation of new OrderItems in the database,
 * including all related data like variations and child items.
 */

/**
 * Creates OrderItemVariations for a given OrderItem.
 */
async function createVariationsForOrderItem(
	prisma: PrismaClient,
	orderItemId: bigint,
	variations: Array<{ variationItemIds: bigint[]; count: number }>
): Promise<void> {
	for (const variation of variations) {
		const createdOrderItemVariation = await prisma.orderItemVariation.create({
			data: {
				orderItem: { connect: { id: orderItemId } },
				count: variation.count
			}
		})

		// Link all VariationItems to this OrderItemVariation
		for (const variationItemId of variation.variationItemIds) {
			await prisma.orderItemVariationToVariationItem.create({
				data: {
					orderItemVariation: {
						connect: { id: createdOrderItemVariation.id }
					},
					variationItem: { connect: { id: variationItemId } }
				}
			})
		}
	}
}

/**
 * Creates a new OrderItem in the database for a given ProductInput.
 * This includes creating all related data:
 * - The main OrderItem with product, count, discount, notes, etc.
 * - All OrderItemVariations with their VariationItems
 * - All child OrderItems (for Menu and Special types)
 */
export async function createOrderItemForProductInput(
	prisma: PrismaClient,
	incomingProduct: ProductInput,
	order: Order,
	orderItemType: OrderItemType
) {
	// Check if this is a diverse item (no product needed)
	const isDiverseItem =
		orderItemType === "DIVERSE_FOOD" ||
		orderItemType === "DIVERSE_DRINK" ||
		orderItemType === "DIVERSE_OTHER"

	const newOrderItem = await prisma.orderItem.create({
		data: {
			order: {
				connect: {
					id: order.id
				}
			},
			...(isDiverseItem
				? {}
				: {
						product: {
							connect: {
								id: incomingProduct.id
							}
						}
				  }),
			count: incomingProduct.count,
			discount: incomingProduct.discount,
			diversePrice: isDiverseItem ? incomingProduct.diversePrice : null,
			notes: incomingProduct.notes,
			takeAway: incomingProduct.takeAway,
			course: incomingProduct.course,
			...(incomingProduct.offerId
				? {
						offer: {
							connect: {
								id: incomingProduct.offerId
							}
						}
				  }
				: {}),
			type: orderItemType
		}
	})

	// Create all OrderItemVariations for this OrderItem
	await createVariationsForOrderItem(
		prisma,
		newOrderItem.id,
		incomingProduct.variations
	)

	// For Menu and Special types, create child OrderItems
	if (orderItemType === "MENU" || orderItemType === "SPECIAL") {
		// Create child OrderItems for each product in the Menu/Special
		for (const childProductInput of incomingProduct.orderItems) {
			// Resolve the product from the database using its UUID
			const childProductFromDatabase = await prisma.product.findFirst({
				where: {
					uuid: childProductInput.productUuid
				}
			})

			if (childProductFromDatabase == null) {
				throwApiError(apiErrors.productDoesNotExist)
			}

			// Create a child OrderItem linked to the parent OrderItem
			const childOrderItem = await prisma.orderItem.create({
				data: {
					order: {
						connect: {
							id: order.id
						}
					},
					product: {
						connect: {
							id: childProductFromDatabase.id
						}
					},
					count: childProductInput.count,
					type: "PRODUCT",
					orderItem: {
						connect: {
							id: newOrderItem.id // Link to parent OrderItem
						}
					}
				}
			})

			// Add variations to the child OrderItem if provided
			if (childProductInput.variations?.length) {
				// Resolve and create variations for child OrderItem
				const resolvedChildVariations = await resolveVariationsFromInput(
					prisma,
					childProductInput.variations
				)
				await createVariationsForOrderItem(
					prisma,
					childOrderItem.id,
					resolvedChildVariations
				)
			}
		}
	}
}
