import {
	Order,
	PrismaClient,
	OrderItemType
} from "../../../prisma/generated/client.js"
import { apiErrors } from "../../errors.js"
import { throwApiError } from "../../utils.js"
import { ProductInput, ProductInputArgs } from "../../types/orderTypes.js"
import {
	createOrderItemForProductInput,
	isOrderItemMetaEqual,
	mergeProductIntoOrderItem
} from "../../utils/orderItemHelpers.js"

/**
 * Service for handling OrderItem operations
 */
export class OrderItemService {
	constructor(private readonly prisma: PrismaClient) {}

	/**
	 * Converts ProductInputArgs (received from GraphQL with UUIDs) to ProductInput (with database IDs).
	 * This resolves all UUIDs (products, offers, variations) to their corresponding database IDs.
	 */
	async convertProductInputArgs(
		products: ProductInputArgs[]
	): Promise<ProductInput[]> {
		const convertedProducts: ProductInput[] = []

		for (const productInput of products) {
			const productFromDatabase = await this.prisma.product.findFirst({
				where: { uuid: productInput.uuid }
			})

			if (productFromDatabase == null) {
				throwApiError(apiErrors.productDoesNotExist)
			}

			// Resolve offer UUID to database ID if an offer is associated with this product
			let resolvedOfferId: bigint | null = null
			if (productInput.offerUuid) {
				const offerFromDatabase = await this.prisma.offer.findFirst({
					where: { uuid: productInput.offerUuid }
				})
				if (offerFromDatabase) {
					resolvedOfferId = offerFromDatabase.id
				}
			}

			// Convert all variation UUIDs to database IDs for this product
			const resolvedVariations = []
			if (productInput.variations) {
				for (const variationFromInput of productInput.variations) {
					const resolvedVariationItemIds = []
					for (const variationItemUuid of variationFromInput.variationItemUuids) {
						const variationItemFromDatabase =
							await this.prisma.variationItem.findFirst({
								where: { uuid: variationItemUuid }
							})

						if (variationItemFromDatabase == null) {
							throwApiError(apiErrors.variationItemDoesNotExist)
						}

						resolvedVariationItemIds.push(variationItemFromDatabase.id)
					}

					resolvedVariations.push({
						variationItemIds: resolvedVariationItemIds,
						count: variationFromInput.count
					})
				}
			}

			convertedProducts.push({
				id: productFromDatabase.id,
				count: productInput.count,
				type: productFromDatabase.type,
				discount: productInput.discount ?? 0,
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
	 */
	async addProducts(order: Order, products: ProductInput[]): Promise<void> {
		for (const incomingProduct of products) {
			// Build filter criteria to find existing OrderItems that could potentially be merged
			// Important: Must filter by offerId to ensure products with different offers don't merge
			const filterCriteria: any = {
				orderId: order.id,
				productId: incomingProduct.id,
				orderItemId: null // Only top-level OrderItems, not child items
			}

			// If product has an associated offer, only find OrderItems with that same offer
			if (
				incomingProduct.offerId !== null &&
				incomingProduct.offerId !== undefined
			) {
				filterCriteria.offerId = incomingProduct.offerId
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

			// Try to find an existing OrderItem that can be merged with the incoming product
			let existingOrderItemToMerge = null
			for (const candidateOrderItem of existingOrderItemsForProduct) {
				// Convert incoming ProductInput to OrderItem structure for comparison
				const incomingProductAsOrderItem =
					await this.convertProductInputToOrderItemStructure(
						incomingProduct
					)

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
				// Merge: Increment count and add variations to existing OrderItem
				await mergeProductIntoOrderItem(
					this.prisma,
					existingOrderItemToMerge,
					incomingProduct
				)
			} else {
				// Create: No matching OrderItem found, create a new one
				let orderItemType: OrderItemType = "PRODUCT"
				if (incomingProduct.type === "MENU") {
					orderItemType = "MENU"
				} else if (incomingProduct.type === "SPECIAL") {
					orderItemType = "SPECIAL"
				}

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
	 * Converts a ProductInput to an OrderItem-like structure for comparison purposes.
	 * This allows comparing incoming products with existing OrderItems using the same comparison logic.
	 */
	private async convertProductInputToOrderItemStructure(
		incomingProduct: ProductInput
	): Promise<any> {
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
		const childOrderItems = []
		for (const childProductInput of incomingProduct.orderItems) {
			const childProductFromDatabase = await this.prisma.product.findUnique({
				where: { uuid: childProductInput.productUuid }
			})

			if (childProductFromDatabase) {
				// Convert child product variations for strict Menu comparison
				const childProductVariations = []
				if (childProductInput.variations) {
					for (const variationFromInput of childProductInput.variations) {
						const resolvedVariationItemIds = []
						for (const variationItemUuid of variationFromInput.variationItemUuids) {
							const variationItemFromDatabase =
								await this.prisma.variationItem.findFirst({
									where: { uuid: variationItemUuid }
								})
							if (variationItemFromDatabase) {
								resolvedVariationItemIds.push(
									variationItemFromDatabase.id
								)
							}
						}

						childProductVariations.push({
							count: variationFromInput.count,
							orderItemVariationToVariationItems:
								resolvedVariationItemIds.map(id => ({
									variationItemId: id
								}))
						})
					}
				}

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

		// Note: Variations are NOT included in the comparison structure.
		// They don't affect whether two OrderItems can be merged.
		// When a match is found, variations will be merged via mergeOrAddVariations.

		// Map ProductType to OrderItemType (same logic as when creating OrderItems)
		let orderItemType: OrderItemType = "PRODUCT"
		if (incomingProduct.type === "MENU") {
			orderItemType = "MENU"
		} else if (incomingProduct.type === "SPECIAL") {
			orderItemType = "SPECIAL"
		}

		return {
			product: productFromDatabase,
			count: incomingProduct.count,
			type: orderItemType,
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
	 * Price = product.price * orderItem.count for each item.
	 */
	async calculateTotalPrice(order: Order): Promise<number> {
		const orderItemsInOrder = await this.prisma.orderItem.findMany({
			where: { orderId: order.id },
			include: { product: true }
		})

		let totalPrice = 0
		for (const orderItem of orderItemsInOrder) {
			totalPrice += orderItem.product.price * orderItem.count
		}

		return totalPrice
	}
}
