import {
	Order,
	PrismaClient,
	OrderItemType,
	ProductType,
	Product,
	Offer
} from "../../../prisma/generated/client.js"
import { apiErrors } from "../../errors.js"
import { throwApiError } from "../../utils.js"
import { ProductInput, ProductInputArgs } from "../../types/orderTypes.js"
import {
	createOrderItemForProductInput,
	isOrderItemMetaEqual,
	mergeProductIntoOrderItem,
	resolveVariationItemsByUuids
} from "../../utils/orderItem/index.js"

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
	 * Checks if a ProductInput represents a diverse item
	 */
	private isDiverseProductInput(
		productInput: ProductInputArgs | ProductInput
	): boolean {
		return productInput.diversePrice != null
	}

	/**
	 * Creates a ProductInput object for a diverse item (without product resolution)
	 */
	private createDiverseProductInput(
		productInput: ProductInputArgs
	): ProductInput {
		return {
			id: undefined,
			count: productInput.count,
			type: productInput.type,
			discount: productInput.discount ?? 0,
			diversePrice: productInput.diversePrice,
			notes: productInput.notes ?? null,
			takeAway: productInput.takeAway ?? false,
			course: productInput.course ?? null,
			offerId: null,
			variations: [],
			orderItems: []
		}
	}

	/**
	 * Converts ProductInputArgs (received from GraphQL with UUIDs) to ProductInput (with database IDs).
	 * This resolves all UUIDs (products, offers, variations) to their corresponding database IDs.
	 * OPTIMIZED: Batch loads all products, offers, and variations upfront
	 */
	async convertProductInputArgs(
		products: ProductInputArgs[]
	): Promise<ProductInput[]> {
		// Separate diverse items from regular products
		const diverseProducts = products.filter(p =>
			this.isDiverseProductInput(p)
		)
		const regularProducts = products.filter(
			p => !this.isDiverseProductInput(p)
		)

		// OPTIMIZATION: Collect all UUIDs upfront for batch loading
		const productUuids = regularProducts
			.map(p => p.uuid)
			.filter((uuid): uuid is string => uuid != null)
		const offerUuids = regularProducts
			.map(p => p.offerUuid)
			.filter((uuid): uuid is string => uuid != null)
		const allVariationUuids = [
			...new Set(
				regularProducts.flatMap(
					p => p.variations?.flatMap(v => v.variationItemUuids) || []
				)
			)
		]

		// OPTIMIZATION: Batch load all data in parallel (3 queries instead of N*3)
		const [productsFromDb, offersFromDb, variationItems] = await Promise.all([
			productUuids.length > 0
				? this.prisma.product.findMany({
						where: { uuid: { in: productUuids } }
				  })
				: [],
			offerUuids.length > 0
				? this.prisma.offer.findMany({
						where: { uuid: { in: offerUuids } }
				  })
				: [],
			allVariationUuids.length > 0
				? this.prisma.variationItem.findMany({
						where: { uuid: { in: allVariationUuids } }
				  })
				: []
		])

		// Create lookup maps for O(1) access
		const productMap = new Map<string, Product>()
		for (const p of productsFromDb) {
			productMap.set(p.uuid, p)
		}

		const offerMap = new Map<string, Offer>()
		for (const o of offersFromDb) {
			offerMap.set(o.uuid, o)
		}

		const variationItemMap = new Map<string, bigint>()
		for (const vi of variationItems) {
			variationItemMap.set(vi.uuid, vi.id)
		}

		const convertedProducts: ProductInput[] = []

		// Process diverse items first (no DB lookups needed)
		for (const productInput of diverseProducts) {
			convertedProducts.push(this.createDiverseProductInput(productInput))
		}

		// Process regular products using lookup maps
		for (const productInput of regularProducts) {
			const uuid = productInput.uuid
			if (!uuid) {
				throwApiError(apiErrors.productDoesNotExist)
			}

			const productFromDatabase = productMap.get(uuid)

			if (!productFromDatabase) {
				throwApiError(apiErrors.productDoesNotExist)
			}

			// Resolve offer using map
			const resolvedOfferId = productInput.offerUuid
				? offerMap.get(productInput.offerUuid)?.id ?? null
				: null

			// Resolve variations using map
			const resolvedVariations =
				productInput.variations?.map(variation => ({
					variationItemIds: variation.variationItemUuids.map(uuid => {
						const id = variationItemMap.get(uuid)
						if (!id) throwApiError(apiErrors.variationItemDoesNotExist)
						return id
					}),
					count: variation.count
				})) || []

			convertedProducts.push({
				id: productFromDatabase.id,
				count: productInput.count,
				type: this.convertProductTypeToOrderItemType(
					productFromDatabase.type
				),
				discount: productInput.discount ?? 0,
				diversePrice: undefined,
				notes: productInput.notes ?? null,
				takeAway: productInput.takeAway ?? false,
				course: productInput.course ?? null,
				offerId: resolvedOfferId,
				variations: resolvedVariations,
				orderItems: productInput.orderItems ?? []
			})
		}

		return convertedProducts
	}

	/**
	 * Adds products to an order using intelligent merging logic.
	 * If an existing OrderItem matches the incoming product (same product, offer, notes, variations),
	 * it will be merged (counts incremented). Otherwise, a new OrderItem is created.
	 * OPTIMIZED: Pre-load relevant OrderItems with one query instead of N queries
	 */
	async addProducts(order: Order, products: ProductInput[]): Promise<void> {
		// OPTIMIZATION: Collect all productIds upfront to load relevant OrderItems in one query
		const productIds = [
			...new Set(
				products
					.filter(p => !this.isDiverseProductInput(p) && p.id)
					.map(p => p.id)
					.filter((id): id is bigint => id !== undefined)
			)
		]
		const hasDiverseItems = products.some(p => this.isDiverseProductInput(p))

		// Build WHERE conditions to load only relevant OrderItems
		const whereConditions: any[] = []
		if (productIds.length > 0) {
			whereConditions.push({ productId: { in: productIds } })
		}
		if (hasDiverseItems) {
			whereConditions.push({ productId: null })
		}

		// OPTIMIZATION: Batch load products and offers for comparison structures
		const { productMap, offerMap } = await this.batchLoadForComparison(
			products
		)

		// Pre-load ALL relevant OrderItems in ONE query
		const allRelevantOrderItems =
			whereConditions.length > 0
				? await this.prisma.orderItem.findMany({
						where: {
							orderId: order.id,
							orderItemId: null,
							OR: whereConditions
						},
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
				  })
				: []

		// Process each product (keeping sequential to avoid race conditions)
		for (const incomingProduct of products) {
			const isDiverseItem = this.isDiverseProductInput(incomingProduct)

			// Filter the pre-loaded OrderItems for this specific product
			const existingOrderItemsForProduct = allRelevantOrderItems.filter(
				orderItem => {
					// Check productId match
					if (isDiverseItem) {
						if (orderItem.productId !== null) return false
					} else if (orderItem.productId !== incomingProduct.id) {
						return false
					}

					// Check offerId match
					if (
						incomingProduct.offerId !== null &&
						incomingProduct.offerId !== undefined
					) {
						if (orderItem.offerId !== incomingProduct.offerId)
							return false
					} else if (orderItem.offerId !== null) return false

					return true
				}
			)

			// Try to find an existing OrderItem that can be merged with the incoming product
			let existingOrderItemToMerge = null

			// OPTIMIZATION: Build comparison structure once before loop, using pre-loaded maps
			const incomingProductAsOrderItem =
				await this.convertProductInputToOrderItemStructure(
					incomingProduct,
					productMap,
					offerMap
				)

			for (const candidateOrderItem of existingOrderItemsForProduct) {
				const canBeMerged = isOrderItemMetaEqual(
					candidateOrderItem as any,
					incomingProductAsOrderItem
				)

				if (canBeMerged) {
					existingOrderItemToMerge = candidateOrderItem
					break
				}
			}

			if (existingOrderItemToMerge) {
				// Merge: Increment count (and add variations for regular products)
				await mergeProductIntoOrderItem(
					this.prisma,
					existingOrderItemToMerge,
					incomingProduct
				)
			} else {
				// Create: No matching OrderItem found, create a new one
				const orderItemType = this.determineOrderItemType(incomingProduct)

				await createOrderItemForProductInput(
					this.prisma,
					incomingProduct,
					order,
					orderItemType
				)
			}
		}
	}

	/**
	 * Determines the OrderItemType based on ProductInput
	 */
	private determineOrderItemType(
		incomingProduct: ProductInput
	): OrderItemType {
		// For diverse items, use the provided type (DIVERSE_FOOD, DIVERSE_DRINK, DIVERSE_OTHER)
		if (this.isDiverseProductInput(incomingProduct)) {
			return incomingProduct.type || "DIVERSE_OTHER" // Fallback to DIVERSE_OTHER if not specified
		}

		// For regular products, use the product type
		if (incomingProduct.type === "MENU") return "MENU"
		if (incomingProduct.type === "SPECIAL") return "SPECIAL"
		return "PRODUCT"
	}

	/**
	 * OPTIMIZED: Batch loads all products and offers needed for comparison structures
	 */
	private async batchLoadForComparison(products: ProductInput[]): Promise<{
		productMap: Map<bigint, Product>
		offerMap: Map<bigint, Offer>
	}> {
		const productIds = [
			...new Set(
				products
					.map(p => p.id)
					.filter((id): id is bigint => id !== undefined)
			)
		]
		const offerIds = [
			...new Set(
				products
					.map(p => p.offerId)
					.filter((id): id is bigint => id !== undefined && id !== null)
			)
		]

		const [productsFromDb, offersFromDb] = await Promise.all([
			productIds.length > 0
				? this.prisma.product.findMany({
						where: { id: { in: productIds } }
				  })
				: [],
			offerIds.length > 0
				? this.prisma.offer.findMany({
						where: { id: { in: offerIds } }
				  })
				: []
		])

		const productMap = new Map<bigint, Product>()
		for (const p of productsFromDb) {
			productMap.set(p.id, p)
		}

		const offerMap = new Map<bigint, Offer>()
		for (const o of offersFromDb) {
			offerMap.set(o.id, o)
		}

		return { productMap, offerMap }
	}

	/**
	 * Converts a ProductInput to an OrderItem-like structure for comparison purposes.
	 * This allows comparing incoming products with existing OrderItems using the same comparison logic.
	 * OPTIMIZED: Accepts pre-loaded maps to avoid DB queries
	 */
	private async convertProductInputToOrderItemStructure(
		incomingProduct: ProductInput,
		productMap?: Map<bigint, Product>,
		offerMap?: Map<bigint, Offer>
	): Promise<any> {
		// For diverse items without productId, return minimal structure
		if (this.isDiverseProductInput(incomingProduct)) {
			return {
				product: null,
				count: incomingProduct.count,
				type: this.determineOrderItemType(incomingProduct),
				discount: incomingProduct.discount,
				diversePrice: incomingProduct.diversePrice,
				notes: incomingProduct.notes,
				takeAway: incomingProduct.takeAway,
				course: incomingProduct.course,
				offer: null,
				orderItems: [],
				orderItemVariations: []
			}
		}

		// Use pre-loaded map if available, otherwise query DB
		let productFromDatabase: Product | null | undefined
		if (productMap && incomingProduct.id) {
			productFromDatabase = productMap.get(incomingProduct.id)
		} else {
			productFromDatabase = await this.prisma.product.findUnique({
				where: { id: incomingProduct.id }
			})
		}

		if (!productFromDatabase) {
			throwApiError(apiErrors.productDoesNotExist)
		}

		// Resolve offer from map or database if product has an associated offer
		let offerFromDatabase = null
		if (incomingProduct.offerId) {
			if (offerMap) {
				offerFromDatabase = offerMap.get(incomingProduct.offerId) || null
			} else {
				offerFromDatabase = await this.prisma.offer.findUnique({
					where: { id: incomingProduct.offerId }
				})
			}
		}

		// Build child OrderItems structure (for Menu and Special types)
		const childOrderItems = await this.resolveChildOrderItemsForComparison(
			incomingProduct.orderItems
		)

		// Note: Variations are NOT included in the comparison structure.
		// They don't affect whether two OrderItems can be merged.
		// When a match is found, variations will be merged via mergeOrAddVariations.

		return {
			product: productFromDatabase,
			count: incomingProduct.count,
			type: this.determineOrderItemType(incomingProduct),
			discount: incomingProduct.discount,
			notes: incomingProduct.notes,
			takeAway: incomingProduct.takeAway,
			course: incomingProduct.course,
			offer: offerFromDatabase ? { id: offerFromDatabase.id } : null,
			orderItems: childOrderItems,
			orderItemVariations: [] // Empty for comparison
		}
	}

	/**
	 * Removes products from an order.
	 * If the OrderItem count is greater than the removal count, only decrements the count.
	 * If the count matches, deletes the entire OrderItem.
	 * OPTIMIZED: Pre-load all relevant OrderItems and comparison structures
	 */
	async removeProducts(order: Order, products: ProductInput[]): Promise<void> {
		// OPTIMIZATION: Collect all productIds upfront
		const productIds = [
			...new Set(
				products
					.map(p => p.id)
					.filter((id): id is bigint => id !== undefined)
			)
		]

		// OPTIMIZATION: Batch load products and offers for comparison structures
		const { productMap, offerMap } = await this.batchLoadForComparison(
			products
		)

		// Pre-load ALL relevant OrderItems in ONE query
		const allRelevantOrderItems =
			productIds.length > 0
				? await this.prisma.orderItem.findMany({
						where: {
							orderId: order.id,
							orderItemId: null,
							productId: { in: productIds }
						},
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
				  })
				: []

		// Process each product removal
		for (const productToRemove of products) {
			// Filter pre-loaded OrderItems for this specific product
			const existingOrderItemsForProduct = allRelevantOrderItems.filter(
				orderItem => {
					if (orderItem.productId !== productToRemove.id) return false

					// Check offerId match
					if (
						productToRemove.offerId !== null &&
						productToRemove.offerId !== undefined
					) {
						if (orderItem.offerId !== productToRemove.offerId)
							return false
					} else if (orderItem.offerId !== null) return false

					return true
				}
			)

			// Build comparison structure once, using pre-loaded maps
			const productToRemoveAsOrderItem =
				await this.convertProductInputToOrderItemStructure(
					productToRemove,
					productMap,
					offerMap
				)

			// Find the OrderItem that matches the product to remove
			let orderItemToRemove = null
			for (const candidateOrderItem of existingOrderItemsForProduct) {
				if (
					isOrderItemMetaEqual(
						candidateOrderItem as any,
						productToRemoveAsOrderItem
					)
				) {
					orderItemToRemove = candidateOrderItem
					break
				}
			}

			if (orderItemToRemove == null) {
				throwApiError(apiErrors.productNotInOrder)
			}

			// Either delete the OrderItem entirely or decrement its count
			if (orderItemToRemove.count <= productToRemove.count) {
				// Count would be zero or negative, so delete the entire OrderItem
				await this.prisma.orderItem.delete({
					where: { id: orderItemToRemove.id }
				})
			} else {
				// Decrement the count by the removal amount
				await this.prisma.orderItem.update({
					where: { id: orderItemToRemove.id },
					data: { count: orderItemToRemove.count - productToRemove.count }
				})
			}
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
	 * Resolves child OrderItems for comparison purposes (used in Menu/Special matching).
	 * OPTIMIZED: Batch loads all child products at once
	 */
	private async resolveChildOrderItemsForComparison(
		childProductInputs: Array<{
			productUuid: string
			count: number
			variations?: Array<{ variationItemUuids: string[]; count: number }>
		}>
	): Promise<any[]> {
		if (!childProductInputs || childProductInputs.length === 0) return []

		// OPTIMIZATION: Collect all UUIDs upfront
		const childProductUuids = childProductInputs.map(
			input => input.productUuid
		)
		const allVariationUuids = [
			...new Set(
				childProductInputs.flatMap(
					input =>
						input.variations?.flatMap(v => v.variationItemUuids) || []
				)
			)
		]

		// OPTIMIZATION: Batch load all data in parallel
		const [childProducts, variationItems] = await Promise.all([
			this.prisma.product.findMany({
				where: { uuid: { in: childProductUuids } }
			}),
			allVariationUuids.length > 0
				? this.prisma.variationItem.findMany({
						where: { uuid: { in: allVariationUuids } }
				  })
				: []
		])

		// Create lookup maps
		const productMap = new Map<string, Product>()
		for (const p of childProducts) {
			productMap.set(p.uuid, p)
		}

		const variationItemMap = new Map<string, bigint>()
		for (const vi of variationItems) {
			variationItemMap.set(vi.uuid, vi.id)
		}

		// Build child OrderItems using lookup maps (no more DB queries!)
		const childOrderItems = []
		for (const childProductInput of childProductInputs) {
			const childProductFromDatabase = productMap.get(
				childProductInput.productUuid
			)

			if (childProductFromDatabase) {
				// Build variations structure using lookup map
				const childProductVariations =
					childProductInput.variations?.map(v => ({
						count: v.count,
						orderItemVariationToVariationItems: v.variationItemUuids.map(
							uuid => ({
								variationItemId: variationItemMap.get(uuid) || BigInt(0)
							})
						)
					})) || []

				childOrderItems.push({
					product: childProductFromDatabase,
					count: childProductInput.count,
					type: "PRODUCT" as OrderItemType,
					orderItems: [],
					orderItemVariations: childProductVariations,
					notes: null,
					takeAway: false,
					course: null,
					offer: null,
					discount: 0
				})
			}
		}

		return childOrderItems
	}

	/**
	 * Resolves child variations for comparison (converts UUIDs to the comparison structure).
	 */
	private async resolveChildVariationsForComparison(
		variations: Array<{ variationItemUuids: string[]; count: number }>
	): Promise<any[]> {
		const childProductVariations = []

		for (const variationFromInput of variations) {
			const resolvedVariationItemIds = await resolveVariationItemsByUuids(
				this.prisma,
				variationFromInput.variationItemUuids
			)

			childProductVariations.push({
				count: variationFromInput.count,
				orderItemVariationToVariationItems: resolvedVariationItemIds.map(
					id => ({
						variationItemId: id
					})
				)
			})
		}

		return childProductVariations
	}
}
