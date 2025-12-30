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
	 * Converts ProductInputArgs (from GraphQL) to ProductInput (with database IDs)
	 */
	async convertProductInputArgs(
		products: ProductInputArgs[]
	): Promise<ProductInput[]> {
		const result: ProductInput[] = []

		for (const item of products) {
			const product = await this.prisma.product.findFirst({
				where: { uuid: item.uuid }
			})

			if (product == null) {
				throwApiError(apiErrors.productDoesNotExist)
			}

			// Get offer if offerUuid is provided
			let offerId: bigint | null = null
			if (item.offerUuid) {
				const offer = await this.prisma.offer.findFirst({
					where: { uuid: item.offerUuid }
				})
				if (offer) {
					offerId = offer.id
				}
			}

			// Convert variation UUIDs to IDs
			const variations = []
			if (item.variations) {
				for (const variation of item.variations) {
					const variationItems = []
					for (const uuid of variation.variationItemUuids) {
						const variationItem =
							await this.prisma.variationItem.findFirst({
								where: { uuid }
							})

						if (variationItem == null) {
							throwApiError(apiErrors.variationItemDoesNotExist)
						}

						variationItems.push(variationItem.id)
					}

					variations.push({
						variationItemIds: variationItems,
						count: variation.count
					})
				}
			}

			result.push({
				id: product.id,
				count: item.count,
				type: product.type,
				discount: item.discount ?? 0,
				notes: item.notes ?? null,
				takeAway: item.takeAway ?? false,
				course: item.course ?? null,
				offerId,
				variations,
				orderItems: item.orderItems ?? []
			})
		}

		return result
	}

	/**
	 * Adds products to an order using the same merging logic as the frontend
	 */
	async addProducts(order: Order, products: ProductInput[]): Promise<void> {
		for (const product of products) {
			// Get all existing order items for this product and offer
			// Wichtig: offerId muss beim Filtern berücksichtigt werden
			const whereClause: any = {
				orderId: order.id,
				productId: product.id,
				orderItemId: null
			}

			// Wenn eine offerId angegeben ist, nur OrderItems mit dieser Offer suchen
			if (product.offerId !== null && product.offerId !== undefined) {
				whereClause.offerId = product.offerId
			} else {
				// Wenn keine offerId angegeben ist, nur OrderItems ohne Offer suchen
				whereClause.offerId = null
			}

			const existingOrderItems = await this.prisma.orderItem.findMany({
				where: whereClause,
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

			console.log("=== ADD PRODUCTS DEBUG ===")
			console.log("Product ID:", product.id)
			console.log("Product type:", product.type)
			console.log("Product notes:", product.notes)
			console.log("Product takeAway:", product.takeAway)
			console.log("Product course:", product.course)
			console.log("Product offerId:", product.offerId)
			console.log("Product discount:", product.discount)
			console.log("Existing OrderItems count:", existingOrderItems.length)

			// Find a merge target using the same logic as frontend
			let mergeTarget = null
			for (const existing of existingOrderItems) {
				console.log("---")
				console.log("Checking existing OrderItem:", existing.id)
				console.log("  existing.type:", existing.type)
				console.log("  existing.notes:", existing.notes)
				console.log("  existing.takeAway:", existing.takeAway)
				console.log("  existing.course:", existing.course)
				console.log("  existing.discount:", existing.discount)
				console.log("  existing.offer?.id:", existing.offer?.id)
				console.log("  existing.product.id:", existing.product.id)
				console.log(
					"  existing.product.shortcut:",
					existing.product.shortcut
				)
				if (existing.type === "SPECIAL" && existing.orderItems.length > 0) {
					console.log(
						"  existing.orderItems[0].product.id:",
						existing.orderItems[0].product.id
					)
				}

				// Convert ProductInput to a temporary OrderItem structure for comparison
				const incomingAsOrderItem =
					await this.convertProductInputToOrderItemStructure(product)

				console.log("  incoming.type:", incomingAsOrderItem.type)
				console.log("  incoming.notes:", incomingAsOrderItem.notes)
				console.log("  incoming.takeAway:", incomingAsOrderItem.takeAway)
				console.log("  incoming.course:", incomingAsOrderItem.course)
				console.log("  incoming.discount:", incomingAsOrderItem.discount)
				console.log("  incoming.offer?.id:", incomingAsOrderItem.offer?.id)
				console.log(
					"  incoming.product.id:",
					incomingAsOrderItem.product.id
				)
				console.log(
					"  incoming.product.shortcut:",
					incomingAsOrderItem.product.shortcut
				)
				if (
					incomingAsOrderItem.type === "SPECIAL" &&
					incomingAsOrderItem.orderItems.length > 0
				) {
					console.log(
						"  incoming.orderItems[0].product.id:",
						incomingAsOrderItem.orderItems[0].product.id
					)
				}

				const isEqual = isOrderItemMetaEqual(
					existing as any,
					incomingAsOrderItem
				)
				console.log("  - isOrderItemMetaEqual RESULT:", isEqual)

				if (isEqual) {
					mergeTarget = existing
					console.log("  ✓ MATCH FOUND! Merging...")
					break
				} else {
					console.log("  ✗ No match, checking next...")
				}
			}

			if (mergeTarget) {
				// Merge into existing order item
				console.log("Merging into existing OrderItem:", mergeTarget.id)
				await mergeProductIntoOrderItem(this.prisma, mergeTarget, product)
			} else {
				// Create new order item
				console.log("No match found. Creating new OrderItem")
				let type: OrderItemType = "PRODUCT"
				if (product.type === "MENU") {
					type = "MENU"
				} else if (product.type === "SPECIAL") {
					type = "SPECIAL"
				}

				await createOrderItemForProductInput(
					this.prisma,
					product,
					order,
					type
				)
			}
		}
	}

	/**
	 * Helper to convert ProductInput to OrderItem structure for comparison
	 */
	private async convertProductInputToOrderItemStructure(
		product: ProductInput
	): Promise<any> {
		const productData = await this.prisma.product.findUnique({
			where: { id: product.id }
		})

		if (!productData) {
			throwApiError(apiErrors.productDoesNotExist)
		}

		// Get offer if offerId is provided
		let offer = null
		if (product.offerId) {
			offer = await this.prisma.offer.findUnique({
				where: { id: product.offerId }
			})
		}

		// Build orderItems (subitems) from ProductInput
		const orderItems = []
		for (const subItem of product.orderItems) {
			const subProduct = await this.prisma.product.findUnique({
				where: { uuid: subItem.productUuid }
			})

			if (subProduct) {
				// Build orderItemVariations from subItem.variations for strict Menu matching
				const childVariations = []
				if (subItem.variations) {
					for (const variation of subItem.variations) {
						const variationItems = []
						for (const uuid of variation.variationItemUuids) {
							const variationItem =
								await this.prisma.variationItem.findFirst({
									where: { uuid }
								})
							if (variationItem) {
								variationItems.push(variationItem.id)
							}
						}

						childVariations.push({
							count: variation.count,
							orderItemVariationToVariationItems: variationItems.map(
								id => ({
									variationItemId: id
								})
							)
						})
					}
				}

				orderItems.push({
					product: subProduct,
					count: subItem.count,
					type: "PRODUCT" as OrderItemType,
					orderItems: [],
					orderItemVariations: childVariations,
					notes: null,
					takeAway: false,
					course: null,
					offer: null,
					discount: 0
				})
			}
		}

		// Don't include variations in comparison structure - they should not affect matching
		// Variations will be merged via mergeOrAddVariations when a match is found

		// Map ProductType to OrderItemType (same logic as when creating)
		let orderItemType: OrderItemType = "PRODUCT"
		if (product.type === "MENU") {
			orderItemType = "MENU"
		} else if (product.type === "SPECIAL") {
			orderItemType = "SPECIAL"
		}

		return {
			product: productData,
			count: product.count,
			type: orderItemType,
			discount: product.discount,
			notes: product.notes,
			takeAway: product.takeAway,
			course: product.course,
			offer: offer ? { id: offer.id } : null,
			orderItems,
			orderItemVariations: []
		}
	}

	/**
	 * Removes products from an order
	 */
	async removeProducts(order: Order, products: ProductInput[]): Promise<void> {
		for (const product of products) {
			// Get the existing order items for the order
			// Wichtig: offerId muss beim Filtern berücksichtigt werden
			const whereClause: any = {
				orderId: order.id,
				productId: product.id,
				orderItemId: null
			}

			// Wenn eine offerId angegeben ist, nur OrderItems mit dieser Offer suchen
			if (product.offerId !== null && product.offerId !== undefined) {
				whereClause.offerId = product.offerId
			} else {
				// Wenn keine offerId angegeben ist, nur OrderItems ohne Offer suchen
				whereClause.offerId = null
			}

			const existingOrderItems = await this.prisma.orderItem.findMany({
				where: whereClause,
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

			// Find the order item using new merging logic
			let orderItem = null
			for (const existing of existingOrderItems) {
				const incomingAsOrderItem =
					await this.convertProductInputToOrderItemStructure(product)

				if (isOrderItemMetaEqual(existing as any, incomingAsOrderItem)) {
					orderItem = existing
					break
				}
			}

			if (orderItem == null) {
				throwApiError(apiErrors.productNotInOrder)
			}

			// Remove the product from the order
			if (orderItem.count <= product.count) {
				// Delete the OrderToProduct item
				await this.prisma.orderItem.delete({
					where: { id: orderItem.id }
				})
			} else {
				// Update the OrderToProduct item
				await this.prisma.orderItem.update({
					where: { id: orderItem.id },
					data: { count: orderItem.count - product.count }
				})
			}
		}
	}

	/**
	 * Calculates the total price of an order
	 */
	async calculateTotalPrice(order: Order): Promise<number> {
		const products = await this.prisma.orderItem.findMany({
			where: { orderId: order.id },
			include: { product: true }
		})

		let totalPrice = 0
		for (const product of products) {
			totalPrice += product.product.price * product.count
		}

		return totalPrice
	}
}
