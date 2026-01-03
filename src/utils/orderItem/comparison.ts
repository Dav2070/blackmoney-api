import {
	OrderItem,
	OrderItemVariation,
	OrderItemVariationToVariationItem,
	PrismaClient,
	Product
} from "../../../prisma/generated/client.js"
import { ProductInput } from "../../types/orderTypes.js"
import { OrderItemWithRelations } from "./types.js"

/**
 * OrderItem Comparison Functions
 *
 * These functions determine whether two OrderItems can be merged together.
 * The comparison includes basic properties, variations, and child items.
 */

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
 * For diverse items (DIVERSE_FOOD, DIVERSE_DRINK, DIVERSE_OTHER), also checks diversePrice.
 */
function isOrderItemBasicEqual(
	firstOrderItem: OrderItemWithRelations,
	secondOrderItem: OrderItemWithRelations
): boolean {
	// Quick check: if they're the same object, they're equal
	if (firstOrderItem === secondOrderItem) return true
	if (!firstOrderItem || !secondOrderItem) return false

	// Type must match (PRODUCT, MENU, SPECIAL, or DIVERSE_*)
	if (firstOrderItem.type !== secondOrderItem.type) return false

	// Notes must match (optional customer notes)
	if (firstOrderItem.notes !== secondOrderItem.notes) return false

	// TakeAway flag must match
	if (firstOrderItem.takeAway !== secondOrderItem.takeAway) return false

	// Course must match (optional course number for serving order)
	if (firstOrderItem.course !== secondOrderItem.course) return false

	// Offer ID must match (both null or both same offer)
	if (firstOrderItem.offer?.id !== secondOrderItem.offer?.id) return false

	// For diverse items, check diversePrice instead of product
	const isDiverseType =
		firstOrderItem.type === "DIVERSE_FOOD" ||
		firstOrderItem.type === "DIVERSE_DRINK" ||
		firstOrderItem.type === "DIVERSE_OTHER"

	if (isDiverseType) {
		// For diverse items, diversePrice must match
		if (firstOrderItem.diversePrice !== secondOrderItem.diversePrice)
			return false
	} else {
		// For regular items, product ID must match (the actual product being ordered)
		if (firstOrderItem.product?.id !== secondOrderItem.product?.id)
			return false
	}

	return true
}

/**
 * Special comparison for diverse products.
 * Diverse products use the diversePrice field and are identified by null productId.
 * This function is kept for backward compatibility but diverse items are now
 * handled via diversePrice comparison in the main service logic.
 */
function isDiversOrderItemMetaEqual(
	existingOrderItem: OrderItemWithRelations,
	incomingOrderItem: OrderItemWithRelations
): boolean {
	// Diverse items are now handled via diversePrice in orderItemService
	// This function is kept for compatibility with regular products
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
 * 4. Additional check for diverse products
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

	// Step 4: Additional check for diverse products
	if (!isDiversOrderItemMetaEqual(existingOrderItem, incomingOrderItem)) {
		return false
	}

	return true
}

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
