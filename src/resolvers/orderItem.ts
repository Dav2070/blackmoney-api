import { Product, Order, OrderItem, OrderItemVariation } from "@prisma/client"
import { ResolverContext, List } from "../types.js"

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
