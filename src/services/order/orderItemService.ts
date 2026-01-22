import {
	Order,
	PrismaClient,
	OrderItemType,
	ProductType
} from "../../../prisma/generated/client.js"
import { apiErrors } from "../../errors.js"
import { throwApiError } from "../../utils.js"
import {
	AddOrderItemInput,
	AddOrderItemVariationInput,
	AddChildOrderItemInput
} from "../../types/orderTypes.js"

/**
 * Service for handling OrderItem operations
 */
export class OrderItemService {
	constructor(private readonly prisma: PrismaClient) {}

	/**
	 * Converts ProductType from database to OrderItemType
	 */
	private convertProductTypeToOrderItemType(
		productType: ProductType
	): OrderItemType {
		switch (productType) {
			case "MENU":
				return "MENU"
			case "SPECIAL":
				return "SPECIAL"
			case "DRINK":
				return "PRODUCT"
			case "FOOD":
				return "PRODUCT"
			default:
				return "PRODUCT"
		}
	}

	/**
	 * Calculates the total price of an order by summing up all OrderItem prices.
	 * For diverse items, uses diversePrice instead of product.price.
	 */
	async calculateTotalPrice(order: Order): Promise<number> {
		const orderItemsInOrder = await this.prisma.orderItem.findMany({
			where: { orderId: order.id },
			include: { product: true }
		})

		let totalPrice = 0
		for (const orderItem of orderItemsInOrder) {
			// For diverse items, use diversePrice; otherwise use product.price
			const itemPrice =
				orderItem.diversePrice ?? orderItem.product?.price ?? 0
			totalPrice += itemPrice * orderItem.count
		}

		return totalPrice
	}

	/**
	 * UUID-based Add/Merge Logic for OrderItems
	 * - If uuid exists → merge (increment count, handle variations)
	 * - If uuid is null → create new
	 */
	async addOrderItems(
		order: Order,
		orderItems: AddOrderItemInput[]
	): Promise<void> {
		console.log(`📦 addOrderItems - Processing ${orderItems.length} items`)
		console.time("⏱️ addOrderItems - batch load")

		// Batch-load all required data
		const productUuids = orderItems
			.filter(item => item.productUuid)
			.map(item => item.productUuid!)
		const offerUuids = orderItems
			.filter(item => item.offerUuid)
			.map(item => item.offerUuid!)
		const variationItemUuids = orderItems
			.flatMap(item => item.variations || [])
			.flatMap(v => v.variationItemUuids)
		const childProductUuids = orderItems
			.flatMap(item => item.orderItems || [])
			.map(child => child.productUuid)
		const childVariationItemUuids = orderItems
			.flatMap(item => item.orderItems || [])
			.flatMap(child => child.variations || [])
			.flatMap(v => v.variationItemUuids)

		// Check which orderItems already exist
		const orderItemUuids = orderItems.map(item => item.uuid)
		const existingOrderItems = await this.prisma.orderItem.findMany({
			where: { uuid: { in: orderItemUuids } },
			select: { uuid: true }
		})
		const existingUuids = new Set(existingOrderItems.map(item => item.uuid))

		console.log(
			`  📊 Loading: ${productUuids.length + childProductUuids.length} products, ${offerUuids.length} offers, ${variationItemUuids.length + childVariationItemUuids.length} variation items`
		)

		const allProductUuids = [...productUuids, ...childProductUuids]
		const allVariationItemUuids = [
			...variationItemUuids,
			...childVariationItemUuids
		]

		const [products, offers, variationItems] = await Promise.all([
			allProductUuids.length > 0
				? this.prisma.product.findMany({
						where: { uuid: { in: allProductUuids } }
					})
				: Promise.resolve([]),
			offerUuids.length > 0
				? this.prisma.offer.findMany({
						where: { uuid: { in: offerUuids } }
					})
				: Promise.resolve([]),
			allVariationItemUuids.length > 0
				? this.prisma.variationItem.findMany({
						where: { uuid: { in: allVariationItemUuids } }
					})
				: Promise.resolve([])
		])
		console.timeEnd("⏱️ addOrderItems - batch load")
		console.log(
			`  ✅ Loaded: ${products.length} products, ${offers.length} offers, ${variationItems.length} variation items`
		)

		// Create lookup maps
		const productMap = new Map(products.map(p => [p.uuid, p]))
		const offerMap = new Map(offers.map(o => [o.uuid, o]))
		const variationItemMap = new Map(variationItems.map(v => [v.uuid, v]))

		// Separate items into merge and create groups
		const toMerge = orderItems.filter(item => existingUuids.has(item.uuid))
		const toCreate = orderItems.filter(item => !existingUuids.has(item.uuid))

		console.log(
			`  📊 Split: ${toMerge.length} to merge, ${toCreate.length} to create`
		)

		// OPTIMIZATION: Batch-load all existing OrderItems for merge operations
		const existingOrderItemsForMerge =
			toMerge.length > 0
				? await this.prisma.orderItem.findMany({
						where: { uuid: { in: toMerge.map(i => i.uuid) } }
					})
				: []
		const orderItemIdMap = new Map(
			existingOrderItemsForMerge.map(item => [item.uuid, item])
		)

		// OPTIMIZATION: Batch-load all child OrderItems too
		const allChildUuids = orderItems
			.flatMap(item => item.orderItems || [])
			.map(child => child.uuid)
			.filter(uuid => uuid) // Filter out undefined/null
		const existingChildOrderItems =
			allChildUuids.length > 0
				? await this.prisma.orderItem.findMany({
						where: { uuid: { in: allChildUuids } }
					})
				: []
		const childOrderItemMap = new Map(
			existingChildOrderItems.map(item => [item.uuid, item])
		)

		// OPTIMIZATION: Execute operations in parallel, but with concurrency limit
		const startTime = Date.now()
		const CONCURRENCY_LIMIT = 10 // Increased from 5 to 10

		try {
			// SUPER OPTIMIZATION: Do all count updates in one go!
			const t1 = Date.now()
			const mergeUpdates = toMerge.map(item => {
				const existingItem = orderItemIdMap.get(item.uuid)
				return {
					where: { id: existingItem.id },
					data: { count: existingItem.count + item.count }
				}
			})

			// Execute all count updates in parallel (much faster!)
			await Promise.all(
				mergeUpdates.map(update => this.prisma.orderItem.update(update))
			)
			console.log(
				`  ⚡ All ${toMerge.length} count updates done in ${Date.now() - t1}ms`
			)

			// Now handle variations and child items in parallel
			const t2 = Date.now()
			const allOperations = [
				...toMerge.map(
					item => async () =>
						this.handleMergeExtras(
							item,
							variationItemMap,
							orderItemIdMap,
							childOrderItemMap,
							productMap
						)
				),
				...toCreate.map(
					item => async () =>
						this.createOrderItem(
							order,
							item,
							productMap,
							offerMap,
							variationItemMap
						)
				)
			]

			// Execute with controlled concurrency
			for (let i = 0; i < allOperations.length; i += CONCURRENCY_LIMIT) {
				const batch = allOperations.slice(i, i + CONCURRENCY_LIMIT)
				await Promise.all(batch.map(op => op()))
			}
			console.log(`  ⚡ All extras/creates done in ${Date.now() - t2}ms`)

			console.log(
				`  ✅ Processed all ${orderItems.length} items in ${Date.now() - startTime}ms`
			)
		} catch (error) {
			console.error(`  ❌ Fatal error in parallel processing:`, error)
			throw error
		}
	}

	/**
	 * UUID-based Remove Logic for OrderItems
	 * - Requires uuid to identify which OrderItem to remove
	 * - If count is provided and less than existing count, decrements the count
	 * - Otherwise, deletes the entire OrderItem
	 */
	async removeOrderItems(
		order: Order,
		orderItems: AddOrderItemInput[]
	): Promise<void> {
		for (const orderItemInput of orderItems) {
			if (!orderItemInput.uuid) {
				throwApiError(apiErrors.orderItemDoesNotExist)
			}

			const existingOrderItem = await this.prisma.orderItem.findFirst({
				where: { uuid: orderItemInput.uuid, orderId: order.id }
			})

			if (!existingOrderItem) {
				throwApiError(apiErrors.orderItemDoesNotExist)
			}

			// If count is provided and less than existing, decrement
			if (
				orderItemInput.count &&
				orderItemInput.count < existingOrderItem.count
			) {
				await this.prisma.orderItem.update({
					where: { id: existingOrderItem.id },
					data: { count: existingOrderItem.count - orderItemInput.count }
				})
			} else {
				// Otherwise delete the entire OrderItem
				await this.prisma.orderItem.delete({
					where: { id: existingOrderItem.id }
				})
			}
		}
	}

	/**
	 * Merges an incoming orderItem with an existing one (by UUID)
	 * - Increments the count
	 * - Handles variations (merge by UUID or create new)
	 * - Handles child orderItems (merge by UUID or create new)
	 */
	private async mergeOrderItem(
		orderItemInput: AddOrderItemInput,
		productMap: Map<string, any>,
		variationItemMap: Map<string, any>,
		orderItemIdMap: Map<string, any>,
		childOrderItemMap: Map<string, any>
	): Promise<void> {
		// OPTIMIZATION: Use pre-loaded orderItem instead of querying
		const existingOrderItem = orderItemIdMap.get(orderItemInput.uuid)

		if (!existingOrderItem) {
			throwApiError(apiErrors.orderItemDoesNotExist)
		}

		// OPTIMIZATION: Batch all updates together
		const updates: Promise<any>[] = []

		// Increment count
		updates.push(
			this.prisma.orderItem.update({
				where: { id: existingOrderItem.id },
				data: { count: existingOrderItem.count + orderItemInput.count }
			})
		)

		// Handle variations in parallel
		if (orderItemInput.variations) {
			updates.push(
				this.handleVariations(
					existingOrderItem.id,
					orderItemInput.variations,
					variationItemMap
				)
			)
		}

		// Handle child orderItems in parallel
		if (orderItemInput.orderItems) {
			for (const childInput of orderItemInput.orderItems) {
				updates.push(
					this.mergeChildOrderItem(
						existingOrderItem.id,
						existingOrderItem.orderId,
						childInput,
						productMap,
						variationItemMap,
						childOrderItemMap
					)
				)
			}
		}

		// Execute all updates in parallel
		await Promise.all(updates)
	}

	/**
	 * Handles variations and child items for merge (without count update)
	 */
	private async handleMergeExtras(
		orderItemInput: AddOrderItemInput,
		variationItemMap: Map<string, any>,
		orderItemIdMap: Map<string, any>,
		childOrderItemMap: Map<string, any>,
		productMap: Map<string, any>
	): Promise<void> {
		const t1 = Date.now()
		const existingOrderItem = orderItemIdMap.get(orderItemInput.uuid)
		if (!existingOrderItem) return

		const updates: Promise<any>[] = []

		// Handle variations in parallel
		if (orderItemInput.variations) {
			updates.push(
				this.handleVariations(
					existingOrderItem.id,
					orderItemInput.variations,
					variationItemMap
				)
			)
		}

		// OPTIMIZATION: Batch all child item updates in ONE SQL query
		if (orderItemInput.orderItems) {
			// Split child items into updates and creates
			const childUpdates: { id: bigint; increment: number }[] = []
			const childCreates: any[] = []

			for (const childInput of orderItemInput.orderItems) {
				const existingChild = childOrderItemMap.get(childInput.uuid)
				if (existingChild) {
					childUpdates.push({
						id: existingChild.id,
						increment: childInput.count
					})
					// Handle child variations
					if (childInput.variations) {
						updates.push(
							this.handleVariations(
								existingChild.id,
								childInput.variations,
								variationItemMap
							)
						)
					}
				} else {
					childCreates.push(childInput)
				}
			}

			// Batch update all child counts in ONE query
			if (childUpdates.length > 0) {
				const caseStatements = childUpdates
					.map(({ id, increment }) => `WHEN ${id} THEN "count" + ${increment}`)
					.join(' ')
				const ids = childUpdates.map(({ id }) => id).join(',')

				updates.push(
					this.prisma.$executeRawUnsafe(`
						UPDATE "OrderItem" 
						SET "count" = CASE id ${caseStatements} END
						WHERE id IN (${ids})`)
				)
			}

			// Create new child items
			if (childCreates.length > 0) {
				updates.push(
					...childCreates.map(childInput =>
						this.createChildOrderItem(
							existingOrderItem.id,
							existingOrderItem.orderId,
							childInput,
							productMap,
							variationItemMap
						)
					)
				)
			}
		}

		await Promise.all(updates)
		const elapsed = Date.now() - t1
		if (elapsed > 50) {
			console.log(`  🔧 handleMergeExtras (${orderItemInput.variations?.length || 0}v + ${orderItemInput.orderItems?.length || 0}c) took ${elapsed}ms`)
		}
	}

	/**
	 * Creates a new OrderItem
	 */
	private async createOrderItem(
		order: Order,
		orderItemInput: AddOrderItemInput,
		productMap: Map<string, any>,
		offerMap: Map<string, any>,
		variationItemMap: Map<string, any>
	): Promise<void> {
		const t1 = Date.now()
		const isDiverseItem = orderItemInput.diversePrice != null
		const orderItemType = this.determineOrderItemType(orderItemInput)

		// Resolve product if not diverse
		let productId: bigint | undefined
		if (!isDiverseItem && orderItemInput.productUuid) {
			const product = productMap.get(orderItemInput.productUuid)
			if (!product) {
				throwApiError(apiErrors.productDoesNotExist)
			}
			productId = product.id
		}

		// Resolve offer if present
		let offerId: bigint | undefined
		if (orderItemInput.offerUuid) {
			const offer = offerMap.get(orderItemInput.offerUuid)
			if (offer) {
				offerId = offer.id
			}
		}

		// Create OrderItem with provided UUID
		const createStart = Date.now()
		const newOrderItem = await this.prisma.orderItem.create({
			data: {
				uuid: orderItemInput.uuid,
				order: { connect: { id: order.id } },
				...(productId ? { product: { connect: { id: productId } } } : {}),
				...(offerId ? { offer: { connect: { id: offerId } } } : {}),
				count: orderItemInput.count,
				discount: orderItemInput.discount ?? 0,
				diversePrice: orderItemInput.diversePrice ?? null,
				notes: orderItemInput.notes ?? null,
				takeAway: orderItemInput.takeAway ?? false,
				course: orderItemInput.course ?? null,
				type: orderItemType
			}
		})
		console.log(`    ✓ Created orderItem in ${Date.now() - createStart}ms`)

		// OPTIMIZATION: Handle variations and child items in parallel
		const postCreateTasks: Promise<any>[] = []

		if (orderItemInput.variations) {
			postCreateTasks.push(
				this.handleVariations(
					newOrderItem.id,
					orderItemInput.variations,
					variationItemMap
				)
			)
		}

		if (orderItemInput.orderItems) {
			for (const childInput of orderItemInput.orderItems) {
				postCreateTasks.push(
					this.createChildOrderItem(
						newOrderItem.id,
						order.id,
						childInput,
						productMap,
						variationItemMap
					)
				)
			}
		}

		// Execute all post-create tasks in parallel
		const postStart = Date.now()
		await Promise.all(postCreateTasks)
		const postElapsed = Date.now() - postStart
		if (postElapsed > 50) {
			console.log(`    ✓ Post-create tasks (${orderItemInput.variations?.length || 0}v + ${orderItemInput.orderItems?.length || 0}c) in ${postElapsed}ms`)
		}

		const elapsed = Date.now() - t1
		if (elapsed > 100) {
			console.log(`  🆕 createOrderItem took ${elapsed}ms`)
		}
	}

	/**
	 * Handles variations for an OrderItem
	 * - If variation.uuid exists AND found → merge (increment count)
	 * - Otherwise → create new with provided UUID
	 */
	private async handleVariations(
		orderItemId: bigint,
		variations: AddOrderItemVariationInput[],
		variationItemMap: Map<string, any>
	): Promise<void> {
		// OPTIMIZATION: Check all variations in one query
		const variationUuids = variations.filter(v => v.uuid).map(v => v.uuid!)
		const existingVariations =
			variationUuids.length > 0
				? await this.prisma.orderItemVariation.findMany({
						where: { uuid: { in: variationUuids } }
					})
				: []
		const existingVariationMap = new Map(
			existingVariations.map(v => [v.uuid, v])
		)

		// Split into updates and creates
		const toUpdate: { id: bigint; increment: number }[] = []
		const toCreate: AddOrderItemVariationInput[] = []

		for (const variationInput of variations) {
			if (variationInput.uuid) {
				const existingVariation = existingVariationMap.get(variationInput.uuid)
				if (existingVariation) {
					toUpdate.push({
						id: existingVariation.id,
						increment: variationInput.count
					})
					continue
				}
			}
			toCreate.push(variationInput)
		}

		// OPTIMIZATION: Batch update all counts in ONE raw SQL query
		const operations: Promise<any>[] = []

		if (toUpdate.length > 0) {
			// Use raw SQL for bulk increment - much faster than individual updates
			const caseStatements = toUpdate
				.map(({ id, increment }) => `WHEN ${id} THEN "count" + ${increment}`)
				.join(' ')
			const ids = toUpdate.map(({ id }) => id).join(',')

			operations.push(
				this.prisma.$executeRawUnsafe(`
					UPDATE "OrderItemVariation" 
					SET "count" = CASE id ${caseStatements} END
					WHERE id IN (${ids})`)
			)
		}

		// Create all new variations in parallel (already optimized with inline links)
		if (toCreate.length > 0) {
			operations.push(
				...toCreate.map(variationInput =>
					this.createVariation(orderItemId, variationInput, variationItemMap)
				)
			)
		}

		await Promise.all(operations)
	}

	/**
	 * Creates a new OrderItemVariation
	 */
	private async createVariation(
		orderItemId: bigint,
		variationInput: AddOrderItemVariationInput,
		variationItemMap: Map<string, any>
	): Promise<void> {
		// Resolve variationItems from map
		const variationItemIds: bigint[] = []
		for (const variationItemUuid of variationInput.variationItemUuids) {
			const variationItem = variationItemMap.get(variationItemUuid)
			if (variationItem) {
				variationItemIds.push(variationItem.id)
			}
		}

		// Create OrderItemVariation with provided UUID
		const newVariation = await this.prisma.orderItemVariation.create({
			data: {
				uuid: variationInput.uuid,
				orderItem: { connect: { id: orderItemId } },
				count: variationInput.count,
				// Inline create the links to avoid extra query
				orderItemVariationToVariationItems: {
					createMany: {
						data: variationItemIds.map(variationItemId => ({
							variationItemId: variationItemId
						}))
					}
				}
			}
		})
	}

	/**
	 * Merges a child OrderItem - or creates if UUID doesn't exist
	 */
	private async mergeChildOrderItem(
		parentOrderItemId: bigint,
		orderId: bigint,
		childInput: AddChildOrderItemInput,
		productMap: Map<string, any>,
		variationItemMap: Map<string, any>,
		childOrderItemMap: Map<string, any>
	): Promise<void> {
		// OPTIMIZATION: Use pre-loaded child orderItem instead of querying
		const existingChildOrderItem = childOrderItemMap.get(childInput.uuid)

		if (existingChildOrderItem) {
			// Found -> Merge (increment count and handle variations in parallel)
			const tasks: Promise<any>[] = [
				this.prisma.orderItem.update({
					where: { id: existingChildOrderItem.id },
					data: { count: existingChildOrderItem.count + childInput.count }
				})
			]

			// Handle variations in parallel
			if (childInput.variations) {
				tasks.push(
					this.handleVariations(
						existingChildOrderItem.id,
						childInput.variations,
						variationItemMap
					)
				)
			}

			await Promise.all(tasks)
		} else {
			// Not found -> Create new
			await this.createChildOrderItem(
				parentOrderItemId,
				orderId,
				childInput,
				productMap,
				variationItemMap
			)
		}
	}

	/**
	 * Creates a new child OrderItem
	 */
	private async createChildOrderItem(
		parentOrderItemId: bigint,
		orderId: bigint,
		childInput: AddChildOrderItemInput,
		productMap: Map<string, any>,
		variationItemMap: Map<string, any>
	): Promise<void> {
		// Resolve product from map
		const product = productMap.get(childInput.productUuid)

		if (!product) {
			throwApiError(apiErrors.productDoesNotExist)
		}

		// Create child OrderItem with provided UUID
		const newChildOrderItem = await this.prisma.orderItem.create({
			data: {
				uuid: childInput.uuid,
				order: { connect: { id: orderId } },
				product: { connect: { id: product.id } },
				orderItem: { connect: { id: parentOrderItemId } },
				count: childInput.count,
				type: "PRODUCT"
			}
		})

		// Handle variations
		if (childInput.variations) {
			await this.handleVariations(
				newChildOrderItem.id,
				childInput.variations,
				variationItemMap
			)
		}
	}

	/**
	 * Determines the OrderItemType based on input
	 */
	private determineOrderItemType(
		orderItemInput: AddOrderItemInput
	): OrderItemType {
		if (orderItemInput.diversePrice != null) {
			return orderItemInput.type || "DIVERSE_OTHER"
		}
		return orderItemInput.type || "PRODUCT"
	}
}
