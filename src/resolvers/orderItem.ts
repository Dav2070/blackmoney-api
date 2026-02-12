import {
	Product,
	Order,
	OrderItem,
	OrderItemVariation,
	Offer
} from "../../prisma/generated/client.js"
import { ResolverContext, List } from "../types.js"
import { apiErrors } from "../errors.js"
import { throwApiError } from "../utils.js"

export async function syncOrderItem(
	parent: any,
	args: {
		uuid: string
		count?: number
		orderItemVariations?: {
			uuid: string
			count: number
		}[]
	},
	context: ResolverContext
): Promise<OrderItem> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the order item
	let orderItem = await context.prisma.orderItem.findFirst({
		where: {
			uuid: args.uuid
		}
	})

	// Check if the order item exists
	if (orderItem == null) {
		throwApiError(apiErrors.orderItemDoesNotExist)
	}

	// If count is 0 or less, delete the order item
	if (args.count != null && args.count < 1) {
		// Delete Child OrderItems first (for Menus and Specials)
		await context.prisma.orderItem.deleteMany({
			where: {
				orderItemId: orderItem.id
			}
		})

		return await context.prisma.orderItem.delete({
			where: {
				id: orderItem.id
			}
		})
	}

	// Update count if provided and different
	if (args.count != null && orderItem.count != args.count) {
		orderItem = await context.prisma.orderItem.update({
			where: {
				id: orderItem.id
			},
			data: {
				count: args.count
			}
		})
	}

	// Sync variations if provided
	if (args.orderItemVariations != null) {
		for (let variation of args.orderItemVariations) {
			if (variation.count > 0) {
				// Update Variation
				await context.prisma.orderItemVariation.update({
					where: {
						uuid: variation.uuid
					},
					data: {
						count: variation.count
					}
				})
			} else {
				// Lösche Variation wenn count <= 0
				await context.prisma.orderItemVariation.delete({
					where: {
						uuid: variation.uuid
					}
				})
			}
		}
	}

	return orderItem
}

export async function order(
	orderItem: OrderItem,
	args: {},
	context: ResolverContext
): Promise<Order> {
	return await context.prisma.order.findFirst({
		where: {
			id: orderItem.orderId
		}
	})
}

export async function product(
	orderItem: OrderItem,
	args: {},
	context: ResolverContext
): Promise<Product> {
	// For diverse items without productId, return null
	if (orderItem.productId == null) return null

	return await context.prisma.product.findFirst({
		where: {
			id: orderItem.productId
		}
	})
}

export async function offer(
	orderItem: OrderItem,
	args: {},
	context: ResolverContext
): Promise<Offer> {
	if (orderItem.offerId == null) return null

	return await context.prisma.offer.findFirst({
		where: {
			id: orderItem.offerId
		}
	})
}

export async function orderItems(
	orderItem: OrderItem,
	args: {},
	context: ResolverContext
): Promise<List<OrderItem>> {
	const where = {
		orderItemId: orderItem.id
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.orderItem.count({ where }),
		context.prisma.orderItem.findMany({ where })
	])

	return {
		total,
		items
	}
}

export async function orderItemVariations(
	orderItem: OrderItem,
	args: {},
	context: ResolverContext
): Promise<List<OrderItemVariation>> {
	let where = { orderItemId: orderItem.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.orderItemVariation.count({ where }),
		context.prisma.orderItemVariation.findMany({ where })
	])

	return {
		total,
		items
	}
}
