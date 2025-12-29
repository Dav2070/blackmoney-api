import {
	Order,
	PrismaClient,
	OrderItemType
} from "../../prisma/generated/client.js"
import { apiErrors } from "../errors.js"
import { throwApiError } from "../utils.js"
import { ProductInput, ProductInputArgs } from "../types/orderTypes.js"
import {
	createOrderItemForProductInput,
	productInputAndOrderItemEqual
} from "../utils/orderItemHelpers.js"

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
				variations,
				orderItems: item.orderItems ?? []
			})
		}

		return result
	}

	/**
	 * Adds products to an order
	 */
	async addProducts(order: Order, products: ProductInput[]): Promise<void> {
		for (const product of products) {
			// Get the existing order items for the order
			const existingOrderItems = await this.prisma.orderItem.findMany({
				where: {
					orderId: order.id,
					productId: product.id,
					orderItemId: null
				},
				include: {
					orderItems: {
						include: {
							product: true
						}
					},
					orderItemVariations: {
						include: {
							orderItemVariationToVariationItems: true
						}
					}
				}
			})

			// Find the order item that has the same variations and discount
			let orderItem: (typeof existingOrderItems)[0] | null = null
			for (const item of existingOrderItems) {
				if (
					await productInputAndOrderItemEqual(this.prisma, product, item)
				) {
					orderItem = item
					break
				}
			}

			// If the order item exists, update the count
			if (orderItem) {
				await this.prisma.orderItem.update({
					where: { id: orderItem.id },
					data: { count: orderItem.count + product.count }
				})
			} else {
				// Create new order item
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
	 * Removes products from an order
	 */
	async removeProducts(order: Order, products: ProductInput[]): Promise<void> {
		for (const product of products) {
			// Get the existing order items for the order
			const existingOrderItems = await this.prisma.orderItem.findMany({
				where: {
					orderId: order.id,
					productId: product.id,
					orderItemId: null
				},
				include: {
					orderItems: {
						include: {
							product: true
						}
					},
					orderItemVariations: {
						include: {
							orderItemVariationToVariationItems: true
						}
					}
				}
			})

			// Find the order item that has the same variations and discount
			let orderItem: (typeof existingOrderItems)[0] | null = null
			for (const item of existingOrderItems) {
				if (
					await productInputAndOrderItemEqual(this.prisma, product, item)
				) {
					orderItem = item
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
