import {
	Order,
	OrderItem,
	OrderItemType,
	OrderItemVariation,
	OrderItemVariationToVariationItem,
	PrismaClient,
	Product
} from "../../prisma/generated/client.js"
import { apiErrors } from "../errors.js"
import { throwApiError } from "../utils.js"
import { ProductInput } from "../types/orderTypes.js"

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
	const newOrderItem = await prisma.orderItem.create({
		data: {
			order: {
				connect: {
					id: order.id
				}
			},
			product: {
				connect: {
					id: incomingProduct.id
				}
			},
			count: incomingProduct.count,
			discount: incomingProduct.discount,
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
	for (const variationFromInput of incomingProduct.variations) {
		// Create one OrderItemVariation for each variation in the product
		let createdOrderItemVariation = await prisma.orderItemVariation.create({
			data: {
				orderItem: {
					connect: {
						id: newOrderItem.id
					}
				},
				count: variationFromInput.count
			}
		})

		// Link all VariationItems to this OrderItemVariation
		for (const variationItemId of variationFromInput.variationItemIds) {
			// Create the join table entry linking OrderItemVariation to VariationItem
			await prisma.orderItemVariationToVariationItem.create({
				data: {
					orderItemVariation: {
						connect: {
							id: createdOrderItemVariation.id
						}
					},
					variationItem: {
						connect: {
							id: variationItemId
						}
					}
				}
			})
		}
	}

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
			if (
				childProductInput.variations &&
				childProductInput.variations.length > 0
			) {
				// Process each variation for the child OrderItem
				for (const childVariationFromInput of childProductInput.variations) {
					const resolvedChildVariationItemIds = []
					for (const variationItemUuid of childVariationFromInput.variationItemUuids) {
						const variationItemFromDatabase =
							await prisma.variationItem.findFirst({
								where: { uuid: variationItemUuid }
							})

						if (variationItemFromDatabase == null) {
							throwApiError(apiErrors.variationItemDoesNotExist)
						}

						resolvedChildVariationItemIds.push(
							variationItemFromDatabase.id
						)
					}

					// Create OrderItemVariation for the child OrderItem
					const childOrderItemVariation =
						await prisma.orderItemVariation.create({
							data: {
								orderItem: {
									connect: {
										id: childOrderItem.id
									}
								},
								count: childVariationFromInput.count
							}
						})

					// Link VariationItems to the child OrderItemVariation
					for (const variationItemId of resolvedChildVariationItemIds) {
						await prisma.orderItemVariationToVariationItem.create({
							data: {
								orderItemVariation: {
									connect: {
										id: childOrderItemVariation.id
									}
								},
								variationItem: {
									connect: {
										id: variationItemId
									}
								}
							}
						})
					}
				}
			}
		}
	}
}

// ========== Type Definitions ==========

/**
 * Extended OrderItem type that includes all necessary relations for merging logic.
 * This type is used throughout the comparison and merging functions.
 */
type OrderItemWithRelations = OrderItem & {
	product: Product
	orderItems: OrderItemWithRelations[]
	orderItemVariations: (OrderItemVariation & {
		orderItemVariationToVariationItems: OrderItemVariationToVariationItem[]
	})[]
	offer?: { id: bigint } | null
}

// ========== Variation Comparison Logic ==========

/**
 * Checks if two OrderItemVariations contain the same VariationItems.
 * The order of VariationItems doesn't matter - they are sorted before comparison.
 * Returns true if both variations have exactly the same set of VariationItems.
 */
function isVariationItemEqual(
	firstVariation: OrderItemVariation & {
		orderItemVariationToVariationItems: OrderItemVariationToVariationItem[]
	},
	secondVariation: OrderItemVariation & {
		orderItemVariationToVariationItems: OrderItemVariationToVariationItem[]
	}
): boolean {
	// Extract and sort all VariationItem IDs from the first variation
	const firstVariationItemIds =
		firstVariation.orderItemVariationToVariationItems
			.map(vi => Number(vi.variationItemId))
			.sort((a, b) => a - b)

	// Extract and sort all VariationItem IDs from the second variation
	const secondVariationItemIds =
		secondVariation.orderItemVariationToVariationItems
			.map(vi => Number(vi.variationItemId))
			.sort((a, b) => a - b)

	// Different number of items means they can't be equal
	if (firstVariationItemIds.length !== secondVariationItemIds.length)
		return false

	// Compare each VariationItem ID
	for (let i = 0; i < firstVariationItemIds.length; i++) {
		if (firstVariationItemIds[i] !== secondVariationItemIds[i]) return false
	}
	return true
}

// ========== OrderItem Comparison Logic ==========

/**
 * Performs basic equality check between two OrderItems.
 * Compares all fundamental properties EXCEPT:
 * - uuid (unique identifier, never the same)
 * - count (merged items have different counts)
 * - order (both items are in the same order)
 * - orderItemVariations (compared separately)
 * - discount (summed when merging, not used for comparison)
 *
 * This checks: type, notes, takeAway, course, offer, and product.
 */
function isOrderItemBasicEqual(
	firstOrderItem: OrderItemWithRelations,
	secondOrderItem: OrderItemWithRelations
): boolean {
	// Quick check: if they're the same object, they're equal
	if (firstOrderItem === secondOrderItem) return true
	if (!firstOrderItem || !secondOrderItem) return false

	// Type must match (PRODUCT, MENU, or SPECIAL)
	if (firstOrderItem.type !== secondOrderItem.type) return false

	// Notes must match (optional customer notes)
	if (firstOrderItem.notes !== secondOrderItem.notes) return false

	// TakeAway flag must match
	if (firstOrderItem.takeAway !== secondOrderItem.takeAway) return false

	// Course must match (optional course number for serving order)
	if (firstOrderItem.course !== secondOrderItem.course) return false

	// Offer ID must match (both null or both same offer)
	if (firstOrderItem.offer?.id !== secondOrderItem.offer?.id) return false

	// Product ID must match (the actual product being ordered)
	if (firstOrderItem.product.id !== secondOrderItem.product.id) return false

	return true
}

/**
 * Special comparison for miscellaneous/diverse products (shortcut 0).
 * These products can have dynamic prices and names, so they must match exactly.
 * Note: product.id is already checked in isOrderItemBasicEqual.
 * This adds an extra check for diverse products to ensure price and name also match.
 */
function isDiversOrderItemMetaEqual(
	existingOrderItem: OrderItemWithRelations,
	incomingOrderItem: OrderItemWithRelations
): boolean {
	// Only perform this check for diverse products (shortcut == 0)
	if (
		existingOrderItem.product.shortcut == 0 &&
		incomingOrderItem.product.shortcut == 0
	) {
		// Price must be identical
		if (existingOrderItem.product.price !== incomingOrderItem.product.price)
			return false
		// Name must be identical
		if (existingOrderItem.product.name !== incomingOrderItem.product.name)
			return false
	}
	return true
}

/**
 * Performs strict variation comparison including proportional count checking.
 * This is used for Menu items where the variation counts must scale proportionally
 * with the parent OrderItem count.
 *
 * Example: If an existing Menu has count=2 with a variation count=4,
 * and an incoming Menu has count=1 with variation count=2,
 * they match because 4/2 = 2/1 (proportional).
 */
function isOrderItemVariationsStrictEqual(
	existingChildItem: OrderItemWithRelations,
	incomingChildItem: OrderItemWithRelations,
	parentExistingCount: number,
	parentIncomingCount: number
): boolean {
	if (!parentExistingCount || !parentIncomingCount) {
		throw new Error("Parent counts must be > 0 for strict variation matching")
	}

	const existingVariations = existingChildItem.orderItemVariations ?? []
	const incomingVariations = incomingChildItem.orderItemVariations ?? []

	// Must have the same number of variations
	if (existingVariations.length !== incomingVariations.length) return false

	// Create a copy of incoming variations to mark matches
	const incomingVariationsCopy = [...incomingVariations]

	for (const existingVariation of existingVariations) {
		const existingVariationCount = existingVariation.count
		if (!existingVariationCount) return false

		// Find a matching variation in the incoming set
		const matchIndex = incomingVariationsCopy.findIndex(incomingVariation => {
			const incomingVariationCount = incomingVariation.count
			if (!incomingVariationCount) return false

			// Check if variation items are structurally equal
			if (!isVariationItemEqual(existingVariation, incomingVariation))
				return false

			// Check if counts are proportional:
			// existingVariation.count / parentExisting === incomingVariation.count / parentIncoming
			// Rearranged: existingVariation.count * parentIncoming === incomingVariation.count * parentExisting
			return (
				existingVariationCount * parentIncomingCount ===
				incomingVariationCount * parentExistingCount
			)
		})

		if (matchIndex === -1) return false
		incomingVariationsCopy.splice(matchIndex, 1) // Remove matched variation
	}

	// All variations must have been matched
	return incomingVariationsCopy.length === 0
}

/**
 * Performs deep comparison of child OrderItems arrays (used for strict Menu matching).
 * Compares arrays in an order-insensitive way - each item in one array must have
 * a matching item in the other array.
 *
 * This recursively checks:
 * - Basic OrderItem properties (product, notes, etc.)
 * - Proportional counts
 * - Variations with proportional counts
 * - Nested child OrderItems (recursive)
 */
function areOrderItemsArrayEqualForMerge(
	existingChildOrderItems: OrderItemWithRelations[],
	incomingChildOrderItems: OrderItemWithRelations[],
	parentExistingCount: number,
	parentIncomingCount: number
): boolean {
	if (!parentExistingCount || !parentIncomingCount) {
		throw new Error("Parent counts must be > 0 for strict menu matching")
	}

	// Must have same number of child items
	if (existingChildOrderItems.length !== incomingChildOrderItems.length)
		return false

	// Track which existing items have been matched
	const matchedExistingItems = new Array<boolean>(
		existingChildOrderItems.length
	).fill(false)

	// For each incoming child item, find a matching existing child item
	for (const incomingChild of incomingChildOrderItems) {
		let foundMatch = false
		for (let i = 0; i < existingChildOrderItems.length; i++) {
			if (matchedExistingItems[i]) continue // Already matched
			const existingChild = existingChildOrderItems[i]

			// Check if basic properties match
			if (!isOrderItemBasicEqual(existingChild, incomingChild)) continue

			const existingChildCount = existingChild.count
			const incomingChildCount = incomingChild.count
			if (!existingChildCount || !incomingChildCount) continue

			// Check if counts are proportional
			// existingChild.count / parentExisting === incomingChild.count / parentIncoming
			if (
				existingChildCount * parentIncomingCount !==
				incomingChildCount * parentExistingCount
			) {
				continue
			}

			// Check if variations match with proportional counts
			if (
				!isOrderItemVariationsStrictEqual(
					existingChild,
					incomingChild,
					parentExistingCount,
					parentIncomingCount
				)
			)
				continue

			// Recursively check nested child items
			const existingNestedChildren = existingChild.orderItems ?? []
			const incomingNestedChildren = incomingChild.orderItems ?? []
			if (existingNestedChildren.length !== incomingNestedChildren.length)
				continue
			if (
				existingNestedChildren.length > 0 &&
				!areOrderItemsArrayEqualForMerge(
					existingNestedChildren,
					incomingNestedChildren,
					parentExistingCount,
					parentIncomingCount
				)
			)
				continue

			// Match found! Mark this existing item as matched
			matchedExistingItems[i] = true
			foundMatch = true
			break
		}

		if (!foundMatch) return false // No match for this incoming item
	}

	return true // All incoming items were successfully matched
}

/**
 * Main entry point: Determines if two OrderItems can be merged.
 *
 * This function orchestrates all the comparison logic:
 * 1. Basic comparison (product, type, notes, offer, etc.)
 * 2. Special handling for SPECIAL type (only first child product must match)
 * 3. Strict deep comparison for MENU type (all children with variations must match)
 * 4. Additional check for miscellaneous/diverse products
 *
 * Returns true if the OrderItems are compatible for merging.
 */
export function isOrderItemMetaEqual(
	existingOrderItem: OrderItemWithRelations,
	incomingOrderItem: OrderItemWithRelations
): boolean {
	if (!existingOrderItem || !incomingOrderItem) return false

	// Step 1: Basic comparison (ignores uuid, count, order, and orderItemVariations)
	if (!isOrderItemBasicEqual(existingOrderItem, incomingOrderItem))
		return false

	// Step 2: For SPECIAL type, verify the child product matches
	if (
		existingOrderItem.type === "SPECIAL" &&
		incomingOrderItem.type === "SPECIAL"
	) {
		// Specials must have the same product in their first child OrderItem
		if (
			existingOrderItem.orderItems[0]?.product.id !==
			incomingOrderItem.orderItems[0]?.product.id
		)
			return false
	}

	// Step 3: For MENU type, perform strict deep comparison of all child items
	if (existingOrderItem.type === "MENU" && incomingOrderItem.type === "MENU") {
		const existingChildren = existingOrderItem.orderItems
		const incomingChildren = incomingOrderItem.orderItems

		return areOrderItemsArrayEqualForMerge(
			existingChildren,
			incomingChildren,
			existingOrderItem.count,
			incomingOrderItem.count
		)
	}

	// Step 4: Additional check for miscellaneous/diverse products
	if (!isDiversOrderItemMetaEqual(existingOrderItem, incomingOrderItem)) {
		return false
	}

	return true
}

// ========== Legacy function (kept for backward compatibility) ==========

/**
 * Checks if a ProductInput equals an existing OrderItem
 * @deprecated Use isOrderItemMetaEqual instead
 */
export async function productInputAndOrderItemEqual(
	prisma: PrismaClient,
	product: ProductInput,
	orderItem: OrderItem & {
		orderItems: (OrderItem & { product: Product })[]
		orderItemVariations: (OrderItemVariation & {
			orderItemVariationToVariationItems: OrderItemVariationToVariationItem[]
		})[]
	}
): Promise<boolean> {
	// Compare basic properties
	if (product.type !== orderItem.type) {
		return false
	}

	if (product.discount !== orderItem.discount) {
		return false
	}

	// Compare the variations
	if (product.variations.length !== orderItem.orderItemVariations.length) {
		return false
	}

	for (const variation of product.variations) {
		for (const variationItemId of variation.variationItemIds) {
			const match = orderItem.orderItemVariations.find(oiv =>
				oiv.orderItemVariationToVariationItems.some(
					oii => oii.variationItemId === variationItemId
				)
			)

			if (match == null) {
				return false
			}
		}
	}

	// Compare the sub order items
	if (product.orderItems.length !== orderItem.orderItems.length) {
		return false
	}

	for (const subOrderItem of product.orderItems) {
		const match = orderItem.orderItems.find(
			oi => oi.product.uuid === subOrderItem.productUuid
		)

		if (match == null) {
			return false
		}
	}

	return true
}

// ========== Merging Logic ==========

/**
 * Merges variations from incoming product into an existing OrderItem.
 *
 * For each incoming variation:
 * - If a matching variation exists (same VariationItems), increment its count
 * - If no match exists, create a new OrderItemVariation
 *
 * This allows multiple variations of the same product to coexist in one OrderItem.
 */
export async function mergeOrAddVariations(
	prisma: PrismaClient,
	existingOrderItemId: bigint,
	incomingVariations: { variationItemIds: number[]; count: number }[]
): Promise<void> {
	if (!incomingVariations || incomingVariations.length === 0) return

	// Load all existing variations for this OrderItem
	const existingVariations = await prisma.orderItemVariation.findMany({
		where: { orderItemId: existingOrderItemId },
		include: {
			orderItemVariationToVariationItems: true
		}
	})

	// Process each incoming variation
	for (const incomingVariation of incomingVariations) {
		// Try to find an existing variation with the same VariationItems
		const matchingVariation = existingVariations.find(existingVar => {
			const existingVariationItemIds =
				existingVar.orderItemVariationToVariationItems
					.map(vi => Number(vi.variationItemId))
					.sort((a, b) => a - b)
			const incomingVariationItemIds = [
				...incomingVariation.variationItemIds
			].sort((a, b) => a - b)

			if (
				existingVariationItemIds.length !== incomingVariationItemIds.length
			)
				return false

			for (let i = 0; i < existingVariationItemIds.length; i++) {
				if (existingVariationItemIds[i] !== incomingVariationItemIds[i])
					return false
			}
			return true
		})

		if (matchingVariation) {
			// Matching variation found - increment its count
			await prisma.orderItemVariation.update({
				where: { id: matchingVariation.id },
				data: { count: matchingVariation.count + incomingVariation.count }
			})
		} else {
			// No match - create a new variation
			const newVariation = await prisma.orderItemVariation.create({
				data: {
					orderItemId: existingOrderItemId,
					count: incomingVariation.count
				}
			})

			// Link all VariationItems to the new variation
			for (const variationItemId of incomingVariation.variationItemIds) {
				await prisma.orderItemVariationToVariationItem.create({
					data: {
						orderItemVariationId: newVariation.id,
						variationItemId
					}
				})
			}
		}
	}
}

/**
 * Merges an incoming ProductInput into an existing OrderItem.
 *
 * This function handles:
 * 1. Incrementing the count of the existing OrderItem
 * 2. Adding the discount from incoming product to existing
 * 3. Merging all variations (increment matching, create new ones)
 * 4. For SPECIAL: Merge the single child OrderItem and its variations
 * 5. For MENU: Update all child OrderItem counts and merge their variations
 */
export async function mergeProductIntoOrderItem(
	prisma: PrismaClient,
	existingOrderItem: OrderItemWithRelations,
	incomingProduct: ProductInput
): Promise<void> {
	// Step 1: Update the main OrderItem's count and discount
	await prisma.orderItem.update({
		where: { id: existingOrderItem.id },
		data: {
			count: existingOrderItem.count + incomingProduct.count,
			discount: (existingOrderItem.discount ?? 0) + incomingProduct.discount
		}
	})

	// Step 2: Merge all variations from the incoming product
	const variationsWithResolvedIds = incomingProduct.variations.map(
		variation => ({
			variationItemIds: variation.variationItemIds.map(Number),
			count: variation.count
		})
	)

	await mergeOrAddVariations(
		prisma,
		existingOrderItem.id,
		variationsWithResolvedIds
	)

	// Step 3: Handle child OrderItems based on product type
	// For SPECIAL: Merge the single child OrderItem and its variations
	if (incomingProduct.type === "SPECIAL") {
		if (
			existingOrderItem.orderItems.length > 0 &&
			incomingProduct.orderItems.length > 0
		) {
			const existingChildOrderItem = existingOrderItem.orderItems[0]
			const incomingChildProductInput = incomingProduct.orderItems[0]

			// Update the count of the child OrderItem
			await prisma.orderItem.update({
				where: { id: existingChildOrderItem.id },
				data: {
					count:
						existingChildOrderItem.count + incomingChildProductInput.count
				}
			})

			// Merge variations of the child OrderItem if provided
			if (
				incomingChildProductInput.variations &&
				incomingChildProductInput.variations.length > 0
			) {
				// Convert variation UUIDs to IDs
				const childVariationsWithResolvedIds = []
				for (const childVariation of incomingChildProductInput.variations) {
					const resolvedVariationItemIds = []
					for (const variationItemUuid of childVariation.variationItemUuids) {
						const variationItemFromDatabase =
							await prisma.variationItem.findFirst({
								where: { uuid: variationItemUuid }
							})
						if (variationItemFromDatabase) {
							resolvedVariationItemIds.push(
								Number(variationItemFromDatabase.id)
							)
						}
					}
					childVariationsWithResolvedIds.push({
						variationItemIds: resolvedVariationItemIds,
						count: childVariation.count
					})
				}

				await mergeOrAddVariations(
					prisma,
					existingChildOrderItem.id,
					childVariationsWithResolvedIds
				)
			}
		}
	}

	// For MENU: Update counts of all child OrderItems proportionally
	if (incomingProduct.type === "MENU") {
		for (let i = 0; i < existingOrderItem.orderItems.length; i++) {
			const existingChildOrderItem = existingOrderItem.orderItems[i]
			const incomingChildProductInput = incomingProduct.orderItems[i]

			if (existingChildOrderItem && incomingChildProductInput) {
				// Update count of the child OrderItem
				await prisma.orderItem.update({
					where: { id: existingChildOrderItem.id },
					data: {
						count:
							existingChildOrderItem.count +
							incomingChildProductInput.count
					}
				})

				// Merge variations of the child OrderItem if provided
				if (
					incomingChildProductInput.variations &&
					incomingChildProductInput.variations.length > 0
				) {
					// Convert variation UUIDs to IDs
					const childVariationsWithResolvedIds = []
					for (const childVariation of incomingChildProductInput.variations) {
						const resolvedVariationItemIds = []
						for (const variationItemUuid of childVariation.variationItemUuids) {
							const variationItemFromDatabase =
								await prisma.variationItem.findFirst({
									where: { uuid: variationItemUuid }
								})
							if (variationItemFromDatabase) {
								resolvedVariationItemIds.push(
									Number(variationItemFromDatabase.id)
								)
							}
						}
						childVariationsWithResolvedIds.push({
							variationItemIds: resolvedVariationItemIds,
							count: childVariation.count
						})
					}

					await mergeOrAddVariations(
						prisma,
						existingChildOrderItem.id,
						childVariationsWithResolvedIds
					)
				}
			}
		}
	}
}
