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
 * OPTIMIZED: Batch create all variations and their items
 */
async function createVariationsForOrderItem(
	prisma: PrismaClient,
	orderItemId: bigint,
	variations: Array<{ variationItemIds: bigint[]; count: number }>
): Promise<void> {
	if (variations.length === 0) return

	// OPTIMIZATION: Create all OrderItemVariations in a transaction batch
	const createdVariations = await prisma.$transaction(
		variations.map(variation =>
			prisma.orderItemVariation.create({
				data: {
					orderItemId,
					count: variation.count
				}
			})
		)
	)

	// OPTIMIZATION: Batch insert all VariationItems for all variations at once
	const allVariationItemsData = []
	for (let i = 0; i < variations.length; i++) {
		const variation = variations[i]
		const createdVariation = createdVariations[i]

		for (const variationItemId of variation.variationItemIds) {
			allVariationItemsData.push({
				orderItemVariationId: createdVariation.id,
				variationItemId
			})
		}
	}

	if (allVariationItemsData.length > 0) {
		await prisma.orderItemVariationToVariationItem.createMany({
			data: allVariationItemsData
		})
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
		// OPTIMIZATION: Batch load all child products at once
		const childProductUuids = incomingProduct.orderItems.map(
			cp => cp.productUuid
		)
		const childProducts = await prisma.product.findMany({
			where: { uuid: { in: childProductUuids } }
		})

		// Create a map for O(1) lookups
		const childProductMap = new Map<string, any>()
		for (const p of childProducts) {
			childProductMap.set(p.uuid, p)
		}

		// Validate all child products exist
		for (const childProductInput of incomingProduct.orderItems) {
			const childProductFromDatabase = childProductMap.get(
				childProductInput.productUuid
			)
			if (childProductFromDatabase == null) {
				throwApiError(apiErrors.productDoesNotExist)
			}
		}

		// OPTIMIZATION: Batch create all child OrderItems at once
		const childOrderItemsData = incomingProduct.orderItems.map(
			childProductInput => {
				const childProduct = childProductMap.get(
					childProductInput.productUuid
				)!
				return {
					orderId: order.id,
					productId: childProduct.id,
					count: childProductInput.count,
					type: "PRODUCT" as const,
					orderItemId: newOrderItem.id
				}
			}
		)

		// Create all child OrderItems in one query
		const createdChildOrderItems = await prisma.$transaction(
			childOrderItemsData.map(data => prisma.orderItem.create({ data }))
		)

		// OPTIMIZATION: Batch create all variations for all child OrderItems
		const allVariationCreations: Promise<any>[] = []

		for (let i = 0; i < incomingProduct.orderItems.length; i++) {
			const childProductInput = incomingProduct.orderItems[i]
			const childOrderItem = createdChildOrderItems[i]

			// Add variations to the child OrderItem if provided
			if (childProductInput.variations?.length) {
				// Resolve and create variations for child OrderItem
				const variationCreation = resolveVariationsFromInput(
					prisma,
					childProductInput.variations
				).then(resolvedChildVariations =>
					createVariationsForOrderItem(
						prisma,
						childOrderItem.id,
						resolvedChildVariations
					)
				)
				allVariationCreations.push(variationCreation)
			}
		}

		// Execute all variation creations in parallel
		if (allVariationCreations.length > 0) {
			await Promise.all(allVariationCreations)
		}
	}
}
