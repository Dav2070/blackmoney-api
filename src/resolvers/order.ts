import {
	Bill,
	Order,
	OrderItem,
	Prisma,
	Table
} from "../../prisma/generated/client.js"
import { apiErrors } from "../errors.js"
import { ResolverContext, List, PaymentMethod } from "../types.js"
import { throwApiError } from "../utils.js"
import { OrderService } from "../services/order/orderService.js"
import { OrderCompletionService } from "../services/order/orderCompletionService.js"
import { OrderItemService } from "../services/order/orderItemService.js"
import { OrderUpdateService } from "../services/order/orderUpdateService.js"
import { ProductInputArgs } from "../types/orderTypes.js"

export async function retrieveOrder(
	parent: any,
	args: {
		uuid: string
	},
	context: ResolverContext
): Promise<Order> {
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const orderService = new OrderService(context.prisma)
	return await orderService.getOrder(args.uuid)
}

export async function listOrders(
	parent: any,
	args: {
		completed?: boolean
	},
	context: ResolverContext
): Promise<List<Order>> {
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const orderService = new OrderService(context.prisma)
	return await orderService.listOrders(args.completed ?? false)
}

export async function createOrder(
	parent: any,
	args: {
		tableUuid: string
	},
	context: ResolverContext
): Promise<Order> {
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const orderService = new OrderService(context.prisma)
	return await orderService.createOrder(args.tableUuid)
}

export async function updateOrder(
	parent: any,
	args: {
		uuid: string
		orderItems: {
			count: number
			productId: number
			orderItemVariations?: {
				count: number
				variationItems: {
					id: number
				}[]
			}[]
		}[]
	},
	context: ResolverContext
): Promise<Order> {
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const orderUpdateService = new OrderUpdateService(context.prisma)
	return await orderUpdateService.updateOrder(args.uuid, args.orderItems)
}

export async function addProductsToOrder(
	parent: any,
	args: {
		uuid: string
		products: ProductInputArgs[]
	},
	context: ResolverContext
): Promise<Order> {
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const orderService = new OrderService(context.prisma)
	return await orderService.addProductsToOrder(args.uuid, args.products)
}

export async function removeProductsFromOrder(
	parent: any,
	args: {
		uuid: string
		products: ProductInputArgs[]
	},
	context: ResolverContext
): Promise<Order> {
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const orderService = new OrderService(context.prisma)
	return await orderService.removeProductsFromOrder(args.uuid, args.products)
}

export async function completeOrder(
	parent: any,
	args: {
		uuid: string
		billUuid: string
		paymentMethod: PaymentMethod
	},
	context: ResolverContext
): Promise<Order> {
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const order = await context.prisma.order.findFirst({
		where: { uuid: args.uuid }
	})

	if (order == null) {
		throwApiError(apiErrors.orderDoesNotExist)
	}

	const orderCompletionService = new OrderCompletionService(context.prisma)
	return await orderCompletionService.completeOrder(
		order,
		args.billUuid,
		args.paymentMethod,
		context.user.id
	)
}

export async function totalPrice(
	order: Order,
	args: {},
	context: ResolverContext
): Promise<number> {
	const orderItemService = new OrderItemService(context.prisma)
	return await orderItemService.calculateTotalPrice(order)
}

export function paidAt(order: Order): string {
	return order.paidAt?.toISOString() ?? null
}

export async function table(
	order: Order,
	args: {},
	context: ResolverContext
): Promise<Table> {
	return context.prisma.table.findFirst({
		where: {
			id: order.tableId
		}
	})
}

export async function bill(
	order: Order,
	args: {},
	context: ResolverContext
): Promise<Bill> {
	if (order.billId == null) {
		return null
	}

	return context.prisma.bill.findFirst({
		where: {
			id: order.billId
		}
	})
}

export async function orderItems(
	order: Order,
	args: {},
	context: ResolverContext
): Promise<List<OrderItem>> {
	const where: Prisma.OrderItemWhereInput = {
		orderId: order.id,
		orderItemId: null
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.orderItem.count({
			where
		}),
		context.prisma.orderItem.findMany({
			where
		})
	])

	return {
		total,
		items
	}
}
