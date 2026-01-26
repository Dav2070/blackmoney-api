import {
	Order,
	PrismaClient,
	OrderItemType
} from "../../../prisma/generated/client.js"
import { apiErrors } from "../../errors.js"
import { throwApiError } from "../../utils.js"
import {
	AddOrderItemInput,
	AddOrderItemVariationInput
} from "../../types/orderTypes.js"

/**
 * Service for handling OrderItem operations
 */
export class OrderItemService {
	constructor(private readonly prisma: PrismaClient) {}


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

		// Batch-load all required data
		const productUuids = orderItems
			.filter(item => item.productUuid)
			.map(item => item.productUuid)
		const offerUuids = orderItems
			.filter(item => item.offerUuid)
			.map(item => item.offerUuid)
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
		

		// Create lookup maps
		const productMap = new Map(products.map(p => [p.uuid, p]))
		const offerMap = new Map(offers.map(o => [o.uuid, o]))
		const variationItemMap = new Map(variationItems.map(v => [v.uuid, v]))

		// Separate items into merge and create groups
		const toMerge = orderItems.filter(item => existingUuids.has(item.uuid))
		const toCreate = orderItems.filter(item => !existingUuids.has(item.uuid))

		

		//Batch-load all existing OrderItems for merge operations
		const existingOrderItemsForMerge =
			toMerge.length > 0
				? await this.prisma.orderItem.findMany({
						where: { uuid: { in: toMerge.map(i => i.uuid) } }
					})
				: []
		const orderItemIdMap = new Map(
			existingOrderItemsForMerge.map(item => [item.uuid, item])
		)

		//  Batch-load all child OrderItems too
		const allChildUuids = orderItems
			.flatMap(item => item.orderItems || [])
			.map(child => child.uuid)
			.filter(Boolean)
		const existingChildOrderItems =
			allChildUuids.length > 0
				? await this.prisma.orderItem.findMany({
						where: { uuid: { in: allChildUuids } }
					})
				: []
		const childOrderItemMap = new Map(
			existingChildOrderItems.map(item => [item.uuid, item])
		)

		// Execute operations in parallel, but with concurrency limit
		const CONCURRENCY_LIMIT = 10 

		// Do all count updates in one go!
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

		// Now handle variations and child items in parallel
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
	 * Handles variations and child items for merge (without count update)
	 */
	private async handleMergeExtras(
		orderItemInput: AddOrderItemInput,
		variationItemMap: Map<string, any>,
		orderItemIdMap: Map<string, any>,
		childOrderItemMap: Map<string, any>,
		productMap: Map<string, any>
	): Promise<void> {
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

		// Batch all child item updates in ONE SQL query
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
					.map(
						({ id, increment }) =>
							`WHEN ${id} THEN "count" + ${increment}`
					)
					.join(" ")
				const ids = childUpdates.map(({ id }) => id).join(",")

				updates.push(
					this.prisma.$executeRawUnsafe(`
						UPDATE "OrderItem" 
						SET "count" = CASE id ${caseStatements} END
						WHERE id IN (${ids})`)
				)
			}

			// Use createMany for batch insert of child items
			if (childCreates.length > 0) {
				// Resolve all product IDs first
				const childDataWithIds = childCreates.map(childInput => {
					const product = productMap.get(childInput.productUuid)
					if (!product) {
						throwApiError(apiErrors.productDoesNotExist)
					}
					return {
						childInput,
						productId: product.id
					}
				})

				// Use createMany for batch insert
				await this.prisma.orderItem.createMany({
					data: childDataWithIds.map(({ childInput, productId }) => ({
						uuid: childInput.uuid,
						orderId: existingOrderItem.orderId,
						productId: productId,
						orderItemId: existingOrderItem.id,
						count: childInput.count,
						discount: 0,
						takeAway: false,
						type: "PRODUCT"
					}))
				})

				// Fetch created items to get their IDs (only if variations exist)
				if (childCreates.some(c => c.variations)) {
					const childUuids = childCreates.map(c => c.uuid)
					const createdChildren = await this.prisma.orderItem.findMany({
						where: { uuid: { in: childUuids } },
						select: { id: true, uuid: true }
					})
					const childMap = new Map(createdChildren.map(c => [c.uuid, c]))

					// Handle all child variations in parallel
					for (const childInput of childCreates) {
						if (childInput.variations) {
							const childItem = childMap.get(childInput.uuid)
							if (childItem) {
								updates.push(
									this.handleVariations(
										childItem.id,
										childInput.variations,
										variationItemMap
									)
								)
							}
						}
					}
				}
			}
		}

		await Promise.all(updates)
		
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

		// Use createMany for batch insert
		let childOrderItems: any[] = []

		if (orderItemInput.orderItems && orderItemInput.orderItems.length > 0) {
			// Resolve all product IDs first
			const childDataWithIds = orderItemInput.orderItems.map(childInput => {
				const product = productMap.get(childInput.productUuid)
				if (!product) {
					throwApiError(apiErrors.productDoesNotExist)
				}
				return {
					childInput,
					productId: product.id
				}
			})

			// Use createMany for batch insert (single query!)
			await this.prisma.orderItem.createMany({
				data: childDataWithIds.map(({ childInput, productId }) => ({
					uuid: childInput.uuid,
					orderId: order.id,
					productId: productId,
					orderItemId: newOrderItem.id,
					count: childInput.count,
					discount: 0,
					takeAway: false,
					type: "PRODUCT"
				}))
			})

			// Now fetch the created items to get their IDs (for variations)
			if (orderItemInput.orderItems.some(c => c.variations)) {
				const childUuids = orderItemInput.orderItems.map(c => c.uuid)
				childOrderItems = await this.prisma.orderItem.findMany({
					where: { uuid: { in: childUuids } },
					select: { id: true, uuid: true }
				})
			}
		}

		// Now handle ALL variations (parent + children) in parallel
		const variationTasks: Promise<any>[] = []

		// Parent variations
		if (orderItemInput.variations) {
			variationTasks.push(
				this.handleVariations(
					newOrderItem.id,
					orderItemInput.variations,
					variationItemMap
				)
			)
		}

		// Child variations
		if (orderItemInput.orderItems && childOrderItems.length > 0) {
			const childOrderItemMap = new Map(childOrderItems.map(c => [c.uuid, c]))
			orderItemInput.orderItems.forEach(childInput => {
				if (childInput.variations) {
					const childItem = childOrderItemMap.get(childInput.uuid)
					if (childItem) {
						variationTasks.push(
							this.handleVariations(
								childItem.id,
								childInput.variations,
								variationItemMap
							)
						)
					}
				}
			})
		}

		// Execute all variation tasks in parallel
		if (variationTasks.length > 0) {
			await Promise.all(variationTasks)
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
		// Check all variations in one query
		const variationUuids = variations.filter(v => v.uuid).map(v => v.uuid)
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
				const existingVariation = existingVariationMap.get(
					variationInput.uuid
				)
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

		//  Batch update all counts in ONE raw SQL query
		const operations: Promise<any>[] = []

		if (toUpdate.length > 0) {
			// Use raw SQL for bulk increment
			const caseStatements = toUpdate
				.map(
					({ id, increment }) => `WHEN ${id} THEN "count" + ${increment}`
				)
				.join(" ")
			const ids = toUpdate.map(({ id }) => id).join(",")

			operations.push(
				this.prisma.$executeRawUnsafe(`
					UPDATE "OrderItemVariation" 
					SET "count" = CASE id ${caseStatements} END
					WHERE id IN (${ids})`)
			)
		}

		//  Batch-create all variations at once
		if (toCreate.length > 0) {
			operations.push(
				Promise.all(
					toCreate.map(variationInput => {
						// Resolve variationItems from map
						const variationItemIds: bigint[] = []
						for (const variationItemUuid of variationInput.variationItemUuids) {
							const variationItem = variationItemMap.get(variationItemUuid)
							if (variationItem) {
								variationItemIds.push(variationItem.id)
							}
						}

						return this.prisma.orderItemVariation.create({
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
					})
				)
			)
		}

		await Promise.all(operations)
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
