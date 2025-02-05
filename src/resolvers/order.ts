import { Order } from "@prisma/client"
import { apiErrors } from "../errors.js"
import { ResolverContext, List, Product } from "../types.js"
import { throwApiError } from "../utils.js"

export async function addProductsToOrder(
	parent: any,
	args: { uuid: string; products: { uuid: string; count: number }[] },
	context: ResolverContext
): Promise<Order> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the order
	let order = await context.prisma.order.findFirst({
		where: {
			uuid: args.uuid
		}
	})

	// Check if the order exists
	if (order == null) {
		throwApiError(apiErrors.orderDoesNotExist)
	}

	// Get the products from the database
	let products: { id: bigint; count: number }[] = []

	for (let item of args.products) {
		const product = await context.prisma.product.findFirst({
			where: {
				uuid: item.uuid
			}
		})

		if (product == null) {
			throwApiError(apiErrors.productDoesNotExist)
		}

		products.push({
			id: product.id,
			count: item.count
		})
	}

	// Add the products to the order
	for (let product of products) {
		// Check if there is already a OrderToProduct item
		let orderToProduct = await context.prisma.orderToProduct.findFirst({
			where: {
				orderId: order.id,
				productId: product.id
			}
		})

		if (orderToProduct == null) {
			// Create a new OrderToProduct item
			orderToProduct = await context.prisma.orderToProduct.create({
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
					count: product.count
				}
			})
		} else {
			// Update the OrderToProduct item
			orderToProduct = await context.prisma.orderToProduct.update({
				where: {
					id: orderToProduct.id
				},
				data: {
					count: orderToProduct.count + product.count
				}
			})
		}
	}

	return order
}

export async function removeProductsFromOrder(
	parent: any,
	args: { uuid: string; products: { uuid: string; count: number }[] },
	context: ResolverContext
): Promise<Order> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the order
	let order = await context.prisma.order.findFirst({
		where: {
			uuid: args.uuid
		}
	})

	// Check if the order exists
	if (order == null) {
		throwApiError(apiErrors.orderDoesNotExist)
	}

	// Get the products from the database
	let products: { id: bigint; count: number }[] = []

	for (let item of args.products) {
		const product = await context.prisma.product.findFirst({
			where: {
				uuid: item.uuid
			}
		})

		if (product == null) {
			throwApiError(apiErrors.productDoesNotExist)
		}

		products.push({
			id: product.id,
			count: item.count
		})
	}

	// Remove the products from the order
	for (let product of products) {
		// Check if there is already a OrderToProduct item
		let orderToProduct = await context.prisma.orderToProduct.findFirst({
			where: {
				orderId: order.id,
				productId: product.id
			}
		})

		if (orderToProduct == null) {
			throwApiError(apiErrors.productNotInOrder)
		}

		if (orderToProduct.count <= product.count) {
			// Delete the OrderToProduct item
			await context.prisma.orderToProduct.delete({
				where: {
					id: orderToProduct.id
				}
			})
		} else {
			// Update the OrderToProduct item
			await context.prisma.orderToProduct.update({
				where: {
					id: orderToProduct.id
				},
				data: {
					count: orderToProduct.count - product.count
				}
			})
		}
	}

	return order
}

export async function totalPrice(
	order: Order,
	args: {},
	context: ResolverContext
): Promise<number> {
	// Get the products from the database
	let products = await context.prisma.orderToProduct.findMany({
		where: {
			orderId: order.id
		},
		include: {
			product: true
		}
	})

	// Calculate the total price
	let totalPrice = 0

	for (let product of products) {
		totalPrice += product.product.price * product.count
	}

	return totalPrice
}

export async function products(
	order: Order,
	args: {},
	context: ResolverContext
): Promise<List<Product>> {
	const where = {
		orderId: order.id
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.orderToProduct.count({
			where
		}),
		context.prisma.orderToProduct.findMany({
			where,
			include: {
				product: true
			}
		})
	])

	return {
		total,
		items: items.map(item => {
			return {
				...item.product,
				count: item.count
			}
		})
	}
}
