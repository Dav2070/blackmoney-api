import {
	Product,
	Order,
	OrderItem,
	OrderItemVariation,
	Offer
} from "@prisma/client"
import { ResolverContext, List } from "../types.js"
import { apiErrors } from "../errors.js"
import { throwApiError } from "../utils.js"

export async function updateOrderItem(
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

	if (args.count != null && args.count < 1) {
		// Remove the order item
		return await context.prisma.orderItem.delete({
			where: {
				id: orderItem.id
			}
		})
	}

	if (args.count != null && orderItem.count != args.count) {
		// Update the count of the order item
		orderItem = await context.prisma.orderItem.update({
			where: {
				id: orderItem.id
			},
			data: {
				count: args.count
			}
		})
	}

	if (args.orderItemVariations != null) {
		// Get the variations for the order item
		const orderItemVariations =
			await context.prisma.orderItemVariation.findMany({
				where: {
					orderItemId: orderItem.id
				}
			})

		const orderItemVariationUuids: string[] = []

		for (let variation of orderItemVariations) {
			orderItemVariationUuids.push(variation.uuid)
		}

		for (let variation of args.orderItemVariations) {
			if (variation.count > 0) {
				let i = orderItemVariationUuids.indexOf(variation.uuid)
				if (i != -1) orderItemVariationUuids.splice(i, 1)

				// Update the count of the order item variation
				await context.prisma.orderItemVariation.update({
					where: {
						uuid: variation.uuid
					},
					data: {
						count: variation.count
					}
				})
			}
		}

		// Delete the order item variations
		const deleteCommands = []

		for (let variation of orderItemVariationUuids) {
			deleteCommands.push(
				context.prisma.orderItemVariation.delete({
					where: { uuid: variation }
				})
			)
		}

		await context.prisma.$transaction(deleteCommands)
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
