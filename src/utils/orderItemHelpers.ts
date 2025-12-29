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
			await prisma.orderItem.create({
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
		}
	}
}

/**
 * Checks if a ProductInput equals an existing OrderItem
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
