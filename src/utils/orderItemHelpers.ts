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
 * Creates an OrderItem for a given ProductInput
 */
export async function createOrderItemForProductInput(
	prisma: PrismaClient,
	product: ProductInput,
	order: Order,
	type: OrderItemType
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
					id: product.id
				}
			},
			count: product.count,
			discount: product.discount,
			notes: product.notes,
			takeAway: product.takeAway,
			course: product.course,
			...(product.offerId
				? {
						offer: {
							connect: {
								id: product.offerId
							}
						}
				  }
				: {}),
			type
		}
	})

	// Add the variations to the OrderItem
	for (const variation of product.variations) {
		// For each variation in product, create an OrderItemVariation
		let orderItemVariation = await prisma.orderItemVariation.create({
			data: {
				orderItem: {
					connect: {
						id: newOrderItem.id
					}
				},
				count: variation.count
			}
		})

		for (const variationItemId of variation.variationItemIds) {
			// For each variationItemId in variation, create an OrderItemVariationToVariationItem
			await prisma.orderItemVariationToVariationItem.create({
				data: {
					orderItemVariation: {
						connect: {
							id: orderItemVariation.id
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

	if (type === "MENU" || type === "SPECIAL") {
		// Add the order items to the OrderItem
		for (const item of product.orderItems) {
			// Get the product of the order item
			const subProduct = await prisma.product.findFirst({
				where: {
					uuid: item.productUuid
				}
			})

			if (subProduct == null) {
				throwApiError(apiErrors.productDoesNotExist)
			}

			// Create a new OrderItem for each order item
			const childOrderItem = await prisma.orderItem.create({
				data: {
					order: {
						connect: {
							id: order.id
						}
					},
					product: {
						connect: {
							id: subProduct.id
						}
					},
					count: item.count,
					type: "PRODUCT",
					orderItem: {
						connect: {
							id: newOrderItem.id
						}
					}
				}
			})

			// Add variations to the child OrderItem if provided
			if (item.variations && item.variations.length > 0) {
				for (const variation of item.variations) {
					const variationItemIds = []
					for (const uuid of variation.variationItemUuids) {
						const variationItem = await prisma.variationItem.findFirst({
							where: { uuid }
						})

						if (variationItem == null) {
							throwApiError(apiErrors.variationItemDoesNotExist)
						}

						variationItemIds.push(variationItem.id)
					}

					// Create OrderItemVariation for child
					const orderItemVariation =
						await prisma.orderItemVariation.create({
							data: {
								orderItem: {
									connect: {
										id: childOrderItem.id
									}
								},
								count: variation.count
							}
						})

					for (const variationItemId of variationItemIds) {
						await prisma.orderItemVariationToVariationItem.create({
							data: {
								orderItemVariation: {
									connect: {
										id: orderItemVariation.id
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

// ========== Type definitions for merging logic ==========
type OrderItemWithRelations = OrderItem & {
	product: Product
	orderItems: OrderItemWithRelations[]
	orderItemVariations: (OrderItemVariation & {
		orderItemVariationToVariationItems: OrderItemVariationToVariationItem[]
	})[]
	offer?: { id: bigint } | null
}

// ========== Variation comparison logic ==========

/**
 * Checks if two OrderItemVariations have the same variationItems (order-insensitive)
 */
function isVariationItemEqual(
	a: OrderItemVariation & {
		orderItemVariationToVariationItems: OrderItemVariationToVariationItem[]
	},
	b: OrderItemVariation & {
		orderItemVariationToVariationItems: OrderItemVariationToVariationItem[]
	}
): boolean {
	const aItems = a.orderItemVariationToVariationItems
		.map(vi => Number(vi.variationItemId))
		.sort((a, b) => a - b)
	const bItems = b.orderItemVariationToVariationItems
		.map(vi => Number(vi.variationItemId))
		.sort((a, b) => a - b)

	if (aItems.length !== bItems.length) return false

	for (let i = 0; i < aItems.length; i++) {
		if (aItems[i] !== bItems[i]) return false
	}
	return true
}

// ========== OrderItem comparison logic (for merging) ==========

/**
 * Basic equality check: all fields except uuid, count, order, orderItemVariations, discount
 */
function isOrderItemBasicEqual(
	a: OrderItemWithRelations,
	b: OrderItemWithRelations
): boolean {
	if (a === b) return true
	if (!a || !b) return false

	if (a.type !== b.type) return false
	if (a.notes !== b.notes) return false
	if (a.takeAway !== b.takeAway) return false
	if (a.course !== b.course) return false
	if (a.offer?.id !== b.offer?.id) return false
	if (a.product.id !== b.product.id) return false

	return true
}

/**
 * Compares miscellaneous items (Diverse): price and name must match
 */
function isDiversOrderItemMetaEqual(
	existing: OrderItemWithRelations,
	incoming: OrderItemWithRelations
): boolean {
	// Note: product.id is already compared in isOrderItemBasicEqual
	// This additional check is only for diverse products (shortcut 0)
	if (existing.product.shortcut == 0 && incoming.product.shortcut == 0) {
		if (existing.product.price !== incoming.product.price) return false
		if (existing.product.name !== incoming.product.name) return false
	}
	return true
}

/**
 * Strict variation comparison including proportional count check
 */
function isOrderItemVariationsStrictEqual(
	aItem: OrderItemWithRelations,
	bItem: OrderItemWithRelations,
	parentExistingCount: number,
	parentIncomingCount: number
): boolean {
	if (!parentExistingCount || !parentIncomingCount) {
		throw new Error("Parent counts must be > 0 for strict variation matching")
	}

	const aVars = aItem.orderItemVariations ?? []
	const bVars = bItem.orderItemVariations ?? []
	if (aVars.length !== bVars.length) return false

	const bCopy = [...bVars]

	for (const aVar of aVars) {
		const aVarCount = aVar.count
		if (!aVarCount) return false

		const idx = bCopy.findIndex(bVar => {
			const bVarCount = bVar.count
			if (!bVarCount) return false

			// variation items structurally equal
			if (!isVariationItemEqual(aVar, bVar)) return false

			// proportional counts: aVar.count / parentExisting === bVar.count / parentIncoming
			return (
				aVarCount * parentIncomingCount === bVarCount * parentExistingCount
			)
		})

		if (idx === -1) return false
		bCopy.splice(idx, 1)
	}
	return bCopy.length === 0
}

/**
 * Order-insensitive deep compare for subitems (used for strict Menu matching)
 */
function areOrderItemsArrayEqualForMerge(
	aSubs: OrderItemWithRelations[],
	bSubs: OrderItemWithRelations[],
	parentExistingCount: number,
	parentIncomingCount: number
): boolean {
	if (!parentExistingCount || !parentIncomingCount) {
		throw new Error("Parent counts must be > 0 for strict menu matching")
	}

	if (aSubs.length !== bSubs.length) return false

	const used = new Array<boolean>(aSubs.length).fill(false)

	for (const bItem of bSubs) {
		let matched = false
		for (let i = 0; i < aSubs.length; i++) {
			if (used[i]) continue
			const aItem = aSubs[i]

			// Basic meta
			if (!isOrderItemBasicEqual(aItem, bItem)) continue

			const aCount = aItem.count
			const bCount = bItem.count
			if (!aCount || !bCount) continue

			// Proportional count check: aCount / parentExisting === bCount / parentIncoming
			if (aCount * parentIncomingCount !== bCount * parentExistingCount) {
				continue
			}

			// Strict variation comparison
			if (
				!isOrderItemVariationsStrictEqual(
					aItem,
					bItem,
					parentExistingCount,
					parentIncomingCount
				)
			)
				continue

			// Nested subitems (recursive check)
			const aNested = aItem.orderItems ?? []
			const bNested = bItem.orderItems ?? []
			if (aNested.length !== bNested.length) continue
			if (
				aNested.length > 0 &&
				!areOrderItemsArrayEqualForMerge(
					aNested,
					bNested,
					parentExistingCount,
					parentIncomingCount
				)
			)
				continue

			// Match found: mark and move to next incoming item
			used[i] = true
			matched = true
			break
		}

		if (!matched) return false
	}

	return true
}

/**
 * Main entry point: checks if two OrderItems can be merged
 */
export function isOrderItemMetaEqual(
	existing: OrderItemWithRelations,
	incoming: OrderItemWithRelations
): boolean {
	if (!existing || !incoming) return false

	// basic comparison (ignores uuid, count, order and orderItemVariations)
	if (!isOrderItemBasicEqual(existing, incoming)) return false

	// strict check for Specials: only product of subitem must match
	if (existing.type === "SPECIAL" && incoming.type === "SPECIAL") {
		if (
			existing.orderItems[0]?.product.id !==
			incoming.orderItems[0]?.product.id
		)
			return false
	}

	// strict subitem/variation check only for Menu types
	if (existing.type === "MENU" && incoming.type === "MENU") {
		const aSubs = existing.orderItems
		const bSubs = incoming.orderItems

		return areOrderItemsArrayEqualForMerge(
			aSubs,
			bSubs,
			existing.count,
			incoming.count
		)
	}

	// Additional comparison for miscellaneous items
	if (!isDiversOrderItemMetaEqual(existing, incoming)) {
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

// ========== Merging logic (new) ==========

/**
 * Finds a merge target in existing OrderItems for an incoming ProductInput
 */
export async function findMergeTarget(
	prisma: PrismaClient,
	orderId: bigint,
	productId: bigint
): Promise<OrderItemWithRelations | null> {
	const existingOrderItems = await prisma.orderItem.findMany({
		where: {
			orderId,
			productId,
			orderItemId: null
		},
		include: {
			product: true,
			orderItems: {
				include: {
					product: true,
					orderItems: {
						include: {
							product: true,
							orderItems: true,
							orderItemVariations: {
								include: {
									orderItemVariationToVariationItems: true
								}
							},
							offer: true
						}
					},
					orderItemVariations: {
						include: {
							orderItemVariationToVariationItems: true
						}
					},
					offer: true
				}
			},
			orderItemVariations: {
				include: {
					orderItemVariationToVariationItems: true
				}
			},
			offer: true
		}
	})

	return (existingOrderItems[0] as any) ?? null
}

/**
 * Merges variations from incoming into existing OrderItem
 */
export async function mergeOrAddVariations(
	prisma: PrismaClient,
	existingOrderItemId: bigint,
	incomingVariations: { variationItemIds: number[]; count: number }[]
): Promise<void> {
	if (!incomingVariations || incomingVariations.length === 0) return

	const existingVariations = await prisma.orderItemVariation.findMany({
		where: { orderItemId: existingOrderItemId },
		include: {
			orderItemVariationToVariationItems: true
		}
	})

	for (const incVar of incomingVariations) {
		// Find matching variation
		const match = existingVariations.find(existingVar => {
			const existingItems = existingVar.orderItemVariationToVariationItems
				.map(vi => Number(vi.variationItemId))
				.sort((a, b) => a - b)
			const incomingItems = [...incVar.variationItemIds].sort(
				(a, b) => a - b
			)

			if (existingItems.length !== incomingItems.length) return false

			for (let i = 0; i < existingItems.length; i++) {
				if (existingItems[i] !== incomingItems[i]) return false
			}
			return true
		})

		if (match) {
			// Update count
			await prisma.orderItemVariation.update({
				where: { id: match.id },
				data: { count: match.count + incVar.count }
			})
		} else {
			// Create new variation
			const newVar = await prisma.orderItemVariation.create({
				data: {
					orderItemId: existingOrderItemId,
					count: incVar.count
				}
			})

			// Add variation items
			for (const variationItemId of incVar.variationItemIds) {
				await prisma.orderItemVariationToVariationItem.create({
					data: {
						orderItemVariationId: newVar.id,
						variationItemId
					}
				})
			}
		}
	}
}

/**
 * Merges an incoming ProductInput into an existing OrderItem
 */
export async function mergeProductIntoOrderItem(
	prisma: PrismaClient,
	existingOrderItem: OrderItemWithRelations,
	incomingProduct: ProductInput
): Promise<void> {
	// Update count and discount
	await prisma.orderItem.update({
		where: { id: existingOrderItem.id },
		data: {
			count: existingOrderItem.count + incomingProduct.count,
			discount: (existingOrderItem.discount ?? 0) + incomingProduct.discount
		}
	})

	// Merge variations (convert bigint[] to number[])
	const variationsWithNumberIds = incomingProduct.variations.map(v => ({
		variationItemIds: v.variationItemIds.map(Number),
		count: v.count
	}))

	await mergeOrAddVariations(
		prisma,
		existingOrderItem.id,
		variationsWithNumberIds
	)

	// For Special: merge the single subitem and its variations
	if (incomingProduct.type === "SPECIAL") {
		if (
			existingOrderItem.orderItems.length > 0 &&
			incomingProduct.orderItems.length > 0
		) {
			const existingSubItem = existingOrderItem.orderItems[0]
			const incomingSubItem = incomingProduct.orderItems[0]

			// Update count of the subitem
			await prisma.orderItem.update({
				where: { id: existingSubItem.id },
				data: {
					count: existingSubItem.count + incomingSubItem.count
				}
			})

			// Merge variations of the subitem if provided
			if (
				incomingSubItem.variations &&
				incomingSubItem.variations.length > 0
			) {
				// Convert variation UUIDs to IDs
				const subItemVariations = []
				for (const variation of incomingSubItem.variations) {
					const variationItemIds = []
					for (const uuid of variation.variationItemUuids) {
						const variationItem = await prisma.variationItem.findFirst({
							where: { uuid }
						})
						if (variationItem) {
							variationItemIds.push(Number(variationItem.id))
						}
					}
					subItemVariations.push({
						variationItemIds,
						count: variation.count
					})
				}

				await mergeOrAddVariations(
					prisma,
					existingSubItem.id,
					subItemVariations
				)
			}
		}
	}

	// For Menu: subitems are already merged via proportional count check
	// No additional merging needed as Menu structure is strictly compared
}
