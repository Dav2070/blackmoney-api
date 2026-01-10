import { PrismaClient } from "../../../prisma/generated/client.js"
import { ProductInput } from "../../types/orderTypes.js"
import { OrderItemWithRelations } from "./types.js"
import { resolveVariationsFromInput } from "./resolvers.js"

/**
 * OrderItem Merging Functions
 *
 * These functions handle merging incoming products into existing OrderItems,
 * including updating counts, discounts, and variations.
 */

/**
 * Resolves child variations and merges them into an existing OrderItem.
 * This is used for both SPECIAL and MENU types when merging.
 */
export async function resolveAndMergeChildVariations(
	prisma: PrismaClient,
	childOrderItemId: bigint,
	childVariationsInput: Array<{ variationItemUuids: string[]; count: number }>
): Promise<void> {
	if (!childVariationsInput || childVariationsInput.length === 0) return

	const resolvedVariations = await resolveVariationsFromInput(
		prisma,
		childVariationsInput
	)

	const variationsWithNumberIds = resolvedVariations.map(v => ({
		variationItemIds: v.variationItemIds.map(Number),
		count: v.count
	}))

	await mergeOrAddVariations(prisma, childOrderItemId, variationsWithNumberIds)
}

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

	// OPTIMIZATION: Separate updates and creates to batch them
	const variationsToUpdate: { id: bigint; newCount: number }[] = []
	const variationsToCreate: {
		variationItemIds: number[]
		count: number
	}[] = []

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
			// Matching variation found - add to update batch
			variationsToUpdate.push({
				id: matchingVariation.id,
				newCount: matchingVariation.count + incomingVariation.count
			})
		} else {
			// No match - add to create batch
			variationsToCreate.push(incomingVariation)
		}
	}

	// OPTIMIZATION: Execute all updates in parallel
	if (variationsToUpdate.length > 0) {
		await Promise.all(
			variationsToUpdate.map(({ id, newCount }) =>
				prisma.orderItemVariation.update({
					where: { id },
					data: { count: newCount }
				})
			)
		)
	}

	// Execute all creates sequentially (need IDs for relation inserts)
	for (const variationToCreate of variationsToCreate) {
		const newVariation = await prisma.orderItemVariation.create({
			data: {
				orderItemId: existingOrderItemId,
				count: variationToCreate.count
			}
		})

		// Batch insert all VariationItems at once
		if (variationToCreate.variationItemIds.length > 0) {
			await prisma.orderItemVariationToVariationItem.createMany({
				data: variationToCreate.variationItemIds.map(variationItemId => ({
					orderItemVariationId: newVariation.id,
					variationItemId
				}))
			})
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
 * OPTIMIZED: Batch all OrderItem updates in parallel
 */
export async function mergeProductIntoOrderItem(
	prisma: PrismaClient,
	existingOrderItem: OrderItemWithRelations,
	incomingProduct: ProductInput
): Promise<void> {
	// Collect all updates to batch them
	const updates: Promise<any>[] = []

	// Step 1: Update the main OrderItem's count and discount
	updates.push(
		prisma.orderItem.update({
			where: { id: existingOrderItem.id },
			data: {
				count: existingOrderItem.count + incomingProduct.count,
				discount:
					(existingOrderItem.discount ?? 0) + incomingProduct.discount
			}
		})
	)

	// Step 2: Handle child OrderItems based on product type
	// For SPECIAL: Merge the single child OrderItem and its variations
	if (incomingProduct.type === "SPECIAL") {
		if (
			existingOrderItem.orderItems.length > 0 &&
			incomingProduct.orderItems.length > 0
		) {
			const existingChildOrderItem = existingOrderItem.orderItems[0]
			const incomingChildProductInput = incomingProduct.orderItems[0]

			// Add child update to batch
			updates.push(
				prisma.orderItem.update({
					where: { id: existingChildOrderItem.id },
					data: {
						count:
							existingChildOrderItem.count +
							incomingChildProductInput.count
					}
				})
			)
		}
	}

	// For MENU: Update counts of all child OrderItems proportionally
	if (incomingProduct.type === "MENU") {
		for (let i = 0; i < existingOrderItem.orderItems.length; i++) {
			const existingChildOrderItem = existingOrderItem.orderItems[i]
			const incomingChildProductInput = incomingProduct.orderItems[i]

			if (existingChildOrderItem && incomingChildProductInput) {
				// Add child update to batch
				updates.push(
					prisma.orderItem.update({
						where: { id: existingChildOrderItem.id },
						data: {
							count:
								existingChildOrderItem.count +
								incomingChildProductInput.count
						}
					})
				)
			}
		}
	}

	// OPTIMIZATION: Execute all updates in parallel
	await Promise.all(updates)

	// Step 3: Merge all variations from the incoming product
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

	// Step 4: Handle child variations
	// For SPECIAL: Merge the single child OrderItem's variations
	if (incomingProduct.type === "SPECIAL") {
		if (
			existingOrderItem.orderItems.length > 0 &&
			incomingProduct.orderItems.length > 0
		) {
			const existingChildOrderItem = existingOrderItem.orderItems[0]
			const incomingChildProductInput = incomingProduct.orderItems[0]

			// Merge variations using helper function
			if (incomingChildProductInput.variations) {
				await resolveAndMergeChildVariations(
					prisma,
					existingChildOrderItem.id,
					incomingChildProductInput.variations
				)
			}
		}
	}

	// For MENU: Merge variations of all child OrderItems
	if (incomingProduct.type === "MENU") {
		for (let i = 0; i < existingOrderItem.orderItems.length; i++) {
			const existingChildOrderItem = existingOrderItem.orderItems[i]
			const incomingChildProductInput = incomingProduct.orderItems[i]

			if (existingChildOrderItem && incomingChildProductInput) {
				// Merge variations using helper function
				if (incomingChildProductInput.variations) {
					await resolveAndMergeChildVariations(
						prisma,
						existingChildOrderItem.id,
						incomingChildProductInput.variations
					)
				}
			}
		}
	}
}
