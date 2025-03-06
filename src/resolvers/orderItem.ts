import { Product, Order, OrderItem } from "@prisma/client"
import { ResolverContext } from "../types.js"

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
