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
		for (const orderItemInput of orderItems) {
			if (orderItemInput.uuid) {
				// UUID exists → Merge with existing OrderItem
				await this.mergeOrderItem(orderItemInput)
			} else {
				// UUID is null → Create new OrderItem
				await this.createOrderItem(order, orderItemInput)
			}
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
		orderItemInput: AddOrderItemInput
	): Promise<void> {
		const existingOrderItem = await this.prisma.orderItem.findFirst({
			where: { uuid: orderItemInput.uuid },
			include: {
				orderItemVariations: true,
				orderItems: {
					include: {
						orderItemVariations: true
					}
				}
			}
		})

		if (!existingOrderItem) {
			throwApiError(apiErrors.orderItemDoesNotExist)
		}

		// Increment count
		await this.prisma.orderItem.update({
			where: { id: existingOrderItem.id },
			data: { count: existingOrderItem.count + orderItemInput.count }
		})

		// Handle variations
		if (orderItemInput.variations) {
			await this.handleVariations(
				existingOrderItem.id,
				orderItemInput.variations
			)
		}

		// Handle child orderItems
		if (orderItemInput.orderItems) {
			for (const childInput of orderItemInput.orderItems) {
				if (childInput.uuid) {
					await this.mergeChildOrderItem(childInput)
				} else {
					await this.createChildOrderItem(
						existingOrderItem.id,
						existingOrderItem.orderId,
						childInput
					)
				}
			}
		}
	}

	/**
	 * Creates a new OrderItem
	 */
	private async createOrderItem(
		order: Order,
		orderItemInput: AddOrderItemInput
	): Promise<void> {
		const isDiverseItem = orderItemInput.diversePrice != null
		const orderItemType = this.determineOrderItemType(orderItemInput)

		// Resolve product if not diverse
		let productId: bigint | undefined
		if (!isDiverseItem && orderItemInput.productUuid) {
			const product = await this.prisma.product.findFirst({
				where: { uuid: orderItemInput.productUuid }
			})
			if (!product) {
				throwApiError(apiErrors.productDoesNotExist)
			}
			productId = product.id
		}

		// Resolve offer if present
		let offerId: bigint | undefined
		if (orderItemInput.offerUuid) {
			const offer = await this.prisma.offer.findFirst({
				where: { uuid: orderItemInput.offerUuid }
			})
			if (offer) {
				offerId = offer.id
			}
		}

		// Create OrderItem
		const newOrderItem = await this.prisma.orderItem.create({
			data: {
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

		// Handle variations
		if (orderItemInput.variations) {
			await this.handleVariations(newOrderItem.id, orderItemInput.variations)
		}

		// Handle child orderItems
		if (orderItemInput.orderItems) {
			for (const childInput of orderItemInput.orderItems) {
				await this.createChildOrderItem(
					newOrderItem.id,
					order.id,
					childInput
				)
			}
		}
	}

	/**
	 * Handles variations for an OrderItem
	 * - If variation.uuid exists → merge (increment count)
	 * - If variation.uuid is null → create new
	 */
	private async handleVariations(
		orderItemId: bigint,
		variations: AddOrderItemVariationInput[]
	): Promise<void> {
		for (const variationInput of variations) {
			if (variationInput.uuid) {
				// UUID exists → Merge
				const existingVariation =
					await this.prisma.orderItemVariation.findFirst({
						where: { uuid: variationInput.uuid }
					})

				if (!existingVariation) {
					throwApiError(apiErrors.orderItemVariationDoesNotExist)
				}

				await this.prisma.orderItemVariation.update({
					where: { id: existingVariation.id },
					data: { count: existingVariation.count + variationInput.count }
				})
			} else {
				// UUID is null → Create new
				await this.createVariation(orderItemId, variationInput)
			}
		}
	}

	/**
	 * Creates a new OrderItemVariation
	 */
	private async createVariation(
		orderItemId: bigint,
		variationInput: AddOrderItemVariationInput
	): Promise<void> {
		// Resolve variationItems
		const variationItemIds: bigint[] = []
		for (const variationItemUuid of variationInput.variationItemUuids) {
			const variationItem = await this.prisma.variationItem.findFirst({
				where: { uuid: variationItemUuid }
			})
			if (variationItem) {
				variationItemIds.push(variationItem.id)
			}
		}

		// Create OrderItemVariation
		const newVariation = await this.prisma.orderItemVariation.create({
			data: {
				orderItem: { connect: { id: orderItemId } },
				count: variationInput.count
			}
		})

		// Link VariationItems
		for (const variationItemId of variationItemIds) {
			await this.prisma.orderItemVariationToVariationItem.create({
				data: {
					orderItemVariation: { connect: { id: newVariation.id } },
					variationItem: { connect: { id: variationItemId } }
				}
			})
		}
	}

	/**
	 * Merges a child OrderItem
	 */
	private async mergeChildOrderItem(
		childInput: AddChildOrderItemInput
	): Promise<void> {
		const existingChildOrderItem = await this.prisma.orderItem.findFirst({
			where: { uuid: childInput.uuid },
			include: { orderItemVariations: true }
		})

		if (!existingChildOrderItem) {
			throwApiError(apiErrors.orderItemDoesNotExist)
		}

		// Increment count
		await this.prisma.orderItem.update({
			where: { id: existingChildOrderItem.id },
			data: { count: existingChildOrderItem.count + childInput.count }
		})

		// Handle variations
		if (childInput.variations) {
			await this.handleVariations(
				existingChildOrderItem.id,
				childInput.variations
			)
		}
	}

	/**
	 * Creates a new child OrderItem
	 */
	private async createChildOrderItem(
		parentOrderItemId: bigint,
		orderId: bigint,
		childInput: AddChildOrderItemInput
	): Promise<void> {
		// Resolve product
		const product = await this.prisma.product.findFirst({
			where: { uuid: childInput.productUuid }
		})

		if (!product) {
			throwApiError(apiErrors.productDoesNotExist)
		}

		// Create child OrderItem
		const newChildOrderItem = await this.prisma.orderItem.create({
			data: {
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
				childInput.variations
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
