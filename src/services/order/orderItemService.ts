import {
	Order,
	PrismaClient,
	OrderItemType,
	ProductType
} from "../../../prisma/generated/client.js"
import { apiErrors } from "../../errors.js"
import { throwApiError } from "../../utils.js"
import { ProductInput, ProductInputArgs } from "../../types/orderTypes.js"
import {
	createOrderItemForProductInput,
	isOrderItemMetaEqual,
	mergeProductIntoOrderItem,
	resolveProductByUuid,
	resolveOfferByUuid,
	resolveVariationsFromInput,
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
	 */
	async convertProductInputArgs(
		products: ProductInputArgs[]
	): Promise<ProductInput[]> {
		const convertedProducts: ProductInput[] = []

		for (const productInput of products) {
			// For diverse items (with diversePrice or without uuid), skip product resolution
			if (this.isDiverseProductInput(productInput)) {
				convertedProducts.push(this.createDiverseProductInput(productInput))
				continue
			}

			const productFromDatabase = await resolveProductByUuid(
				this.prisma,
				productInput.uuid
			)

			// Resolve offer UUID to database ID if present
			const resolvedOfferId = await resolveOfferByUuid(
				this.prisma,
				productInput.offerUuid
			)

			// Resolve all variation UUIDs to database IDs
			const resolvedVariations = productInput.variations
				? await resolveVariationsFromInput(
						this.prisma,
						productInput.variations
				  )
				: []

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

			// OPTIMIZATION: Build comparison structure once before loop
			const incomingProductAsOrderItem =
				await this.convertProductInputToOrderItemStructure(incomingProduct)

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
	 * Converts a ProductInput to an OrderItem-like structure for comparison purposes.
	 * This allows comparing incoming products with existing OrderItems using the same comparison logic.
	 */
	private async convertProductInputToOrderItemStructure(
		incomingProduct: ProductInput
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

		const productFromDatabase = await this.prisma.product.findUnique({
			where: { id: incomingProduct.id }
		})

		if (!productFromDatabase) {
			throwApiError(apiErrors.productDoesNotExist)
		}

		// Resolve offer from database if product has an associated offer
		let offerFromDatabase = null
		if (incomingProduct.offerId) {
			offerFromDatabase = await this.prisma.offer.findUnique({
				where: { id: incomingProduct.offerId }
			})
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
	 */
	async removeProducts(order: Order, products: ProductInput[]): Promise<void> {
		for (const productToRemove of products) {
			// Build filter criteria to find the OrderItem to remove
			// Important: Must include offerId to ensure correct OrderItem is targeted
			const filterCriteria: any = {
				orderId: order.id,
				productId: productToRemove.id,
				orderItemId: null // Only top-level OrderItems
			}

			// If product has an offer, only find OrderItems with that offer
			if (
				productToRemove.offerId !== null &&
				productToRemove.offerId !== undefined
			) {
				filterCriteria.offerId = productToRemove.offerId
			} else {
				// If product has no offer, only find OrderItems without an offer
				filterCriteria.offerId = null
			}

			const existingOrderItemsForProduct =
				await this.prisma.orderItem.findMany({
					where: filterCriteria,
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

			// Find the OrderItem that matches the product to remove
			let orderItemToRemove = null
			for (const candidateOrderItem of existingOrderItemsForProduct) {
				const productToRemoveAsOrderItem =
					await this.convertProductInputToOrderItemStructure(
						productToRemove
					)

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
		const productMap = new Map<string, any>(
			childProducts.map(p => [p.uuid, p])
		)
		const variationItemMap = new Map<string, bigint>(
			variationItems.map(vi => [vi.uuid, vi.id])
		)

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
