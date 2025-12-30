import {
	Order,
	OrderItem,
	PrismaClient
} from "../../../prisma/generated/client.js"
import { apiErrors } from "../../errors.js"
import { throwApiError } from "../../utils.js"

interface OrderItemUpdateInput {
	count: number
	productId: number
	orderItemVariations?: {
		count: number
		variationItems: {
			id: number
		}[]
	}[]
}

/**
 * Service for handling order updates with complex OrderItem and Variation logic
 */
export class OrderUpdateService {
	constructor(private readonly prisma: PrismaClient) {}

	/**
	 * Updates an order with new order items and variations
	 */
	async updateOrder(
		orderUuid: string,
		orderItemsInput: OrderItemUpdateInput[]
	): Promise<Order> {
		// Get the order
		const order = await this.prisma.order.findFirst({
			where: { uuid: orderUuid }
		})

		if (order == null) {
			throwApiError(apiErrors.orderDoesNotExist)
		}

		// Get existing order items
		const existingOrderItems = await this.prisma.orderItem.findMany({
			where: { orderId: order.id },
			include: {
				orderItemVariations: {
					include: {
						orderItemVariationToVariationItems: true
					}
				}
			}
		})

		// Track which items should be deleted (start with all, remove as we process)
		const orderItemsToDelete = [...existingOrderItems]

		// Process each order item from input
		for (const itemInput of orderItemsInput) {
			await this.processOrderItem(order, itemInput, orderItemsToDelete)
		}

		// Delete remaining order items that weren't in the input
		await this.deleteOrderItems(orderItemsToDelete)

		return order
	}

	/**
	 * Process a single order item update
	 */
	private async processOrderItem(
		order: Order,
		itemInput: OrderItemUpdateInput,
		orderItemsToDelete: (OrderItem & {
			orderItemVariations: any[]
		})[]
	): Promise<void> {
		// Find existing order item for this product
		const existingIndex = orderItemsToDelete.findIndex(
			oi => oi.productId === BigInt(itemInput.productId)
		)

		let orderItem: OrderItem & { orderItemVariations: any[] } | null = null

		if (existingIndex >= 0) {
			// Item exists, update it
			orderItem = orderItemsToDelete[existingIndex]
			orderItemsToDelete.splice(existingIndex, 1)

			if (itemInput.count !== orderItem.count) {
				orderItem = await this.prisma.orderItem.update({
					where: { id: orderItem.id },
					data: { count: itemInput.count },
					include: {
						orderItemVariations: {
							include: {
								orderItemVariationToVariationItems: true
							}
						}
					}
				})
			}
		} else {
			// Item doesn't exist, create it
			orderItem = await this.prisma.orderItem.create({
				data: {
					order: { connect: { id: order.id } },
					product: { connect: { id: BigInt(itemInput.productId) } },
					count: itemInput.count
				},
				include: {
					orderItemVariations: {
						include: {
							orderItemVariationToVariationItems: true
						}
					}
				}
			})
		}

		// Update variations if provided
		if (itemInput.orderItemVariations && orderItem) {
			await this.updateOrderItemVariations(
				orderItem,
				itemInput.orderItemVariations
			)
		}
	}

	/**
	 * Update variations for an order item
	 */
	private async updateOrderItemVariations(
		orderItem: OrderItem & { orderItemVariations: any[] },
		variationsInput: OrderItemUpdateInput["orderItemVariations"]
	): Promise<void> {
		const variationsToDelete = [...orderItem.orderItemVariations]

		for (const variationInput of variationsInput) {
			const existingVariation = this.findMatchingVariation(
				orderItem.orderItemVariations,
				variationInput
			)

			if (existingVariation) {
				// Variation exists, update count if needed
				const index = variationsToDelete.indexOf(existingVariation)
				if (index !== -1) {
					variationsToDelete.splice(index, 1)
				}

				if (existingVariation.count !== variationInput.count) {
					await this.prisma.orderItemVariation.update({
						where: { id: existingVariation.id },
						data: { count: variationInput.count }
					})
				}
			} else {
				// Variation doesn't exist, create it
				await this.createOrderItemVariation(orderItem.id, variationInput)
			}
		}

		// Delete variations that weren't in the input
		await this.deleteOrderItemVariations(variationsToDelete)
	}

	/**
	 * Find a matching variation in existing variations
	 */
	private findMatchingVariation(
		existingVariations: any[],
		variationInput: {
			count: number
			variationItems: { id: number }[]
		}
	) {
		return existingVariations.find(
			oiv =>
				oiv.orderItemVariationToVariationItems.length ===
					variationInput.variationItems.length &&
				oiv.orderItemVariationToVariationItems.every(
					(item: any, index: number) =>
						item.variationItemId ===
						BigInt(variationInput.variationItems[index].id)
				)
		)
	}

	/**
	 * Create a new order item variation
	 */
	private async createOrderItemVariation(
		orderItemId: bigint,
		variationInput: {
			count: number
			variationItems: { id: number }[]
		}
	): Promise<void> {
		const newOrderItemVariation = await this.prisma.orderItemVariation.create(
			{
				data: {
					orderItem: { connect: { id: orderItemId } },
					count: variationInput.count
				}
			}
		)

		for (const variationItem of variationInput.variationItems) {
			await this.prisma.orderItemVariationToVariationItem.create({
				data: {
					orderItemVariation: {
						connect: { id: newOrderItemVariation.id }
					},
					variationItem: { connect: { id: BigInt(variationItem.id) } }
				}
			})
		}
	}

	/**
	 * Delete order item variations
	 */
	private async deleteOrderItemVariations(variations: any[]): Promise<void> {
		if (variations.length === 0) return

		const deleteCommands = variations.map(variation =>
			this.prisma.orderItemVariation.delete({
				where: { id: variation.id }
			})
		)

		await this.prisma.$transaction(deleteCommands)
	}

	/**
	 * Delete order items
	 */
	private async deleteOrderItems(orderItems: OrderItem[]): Promise<void> {
		if (orderItems.length === 0) return

		const deleteCommands = orderItems.map(orderItem =>
			this.prisma.orderItem.delete({
				where: { uuid: orderItem.uuid }
			})
		)

		await this.prisma.$transaction(deleteCommands)
	}
}
