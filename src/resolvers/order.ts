import { Order, OrderItem } from "@prisma/client"
import { apiErrors } from "../errors.js"
import { ResolverContext, List } from "../types.js"
import { throwApiError, findCorrectVariationForOrderItem } from "../utils.js"

export async function retrieveOrder(
	parent: any,
	args: {
		uuid: string
	},
	context: ResolverContext
): Promise<Order> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the order
	return await context.prisma.order.findFirst({
		where: {
			uuid: args.uuid
		}
	})
}

export async function updateOrder(
	parent: any,
	args: {
		uuid: string
		orderItems: {
			count: number
			productId: number
			// orderItemVariations?: {
			// 	uuid: string
			// 	count: number
			// }[]
		}[]
	},
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

	let orderItems = await context.prisma.orderItem.findMany({
		where: {
			orderId: order.id
		}
	})

	const orderItemsToDelete: OrderItem[] = []

	for (let orderItem of orderItems) {
		orderItemsToDelete.push(orderItem)
	}

	for (let item of args.orderItems) {
		let orderItem = orderItemsToDelete.find(
			oi => oi.productId == BigInt(item.productId)
		)

		if (orderItem != null && orderItem.count > 0) {
			let i = orderItemsToDelete.indexOf(orderItem)
			orderItemsToDelete.splice(i, 1)

			if (item.count != orderItem.count) {
				// Update the order item
				orderItem = await context.prisma.orderItem.update({
					where: {
						id: orderItem.id
					},
					data: {
						count: item.count
					}
				})
			}
		} else if (orderItem == null || orderItem.count > 0) {
			// Create the order item
			orderItem = await context.prisma.orderItem.create({
				data: {
					order: {
						connect: {
							id: order.id
						}
					},
					product: {
						connect: {
							id: BigInt(item.productId)
						}
					},
					count: item.count
				}
			})
		}
	}

	// Delete the order items
	const deleteCommands = []

	for (let orderItem of orderItemsToDelete) {
		deleteCommands.push(
			context.prisma.orderItem.delete({
				where: {
					uuid: orderItem.uuid
				}
			})
		)
	}

	await context.prisma.$transaction(deleteCommands)

	return order
}

export async function addProductsToOrder(
	parent: any,
	args: {
		uuid: string
		products: {
			uuid: string
			count: number
			variations?: {
				variationItemUuids: string[]
				count: number
			}[]
		}[]
	},
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
	let products: {
		id: bigint
		count: number
		variations: {
			variationItemIds: bigint[]
			count: number
		}[]
	}[] = []

	for (let item of args.products) {
		const product = await context.prisma.product.findFirst({
			where: {
				uuid: item.uuid
			}
		})

		if (product == null) {
			throwApiError(apiErrors.productDoesNotExist)
		}

		const variations: {
			variationItemIds: bigint[]
			count: number
		}[] = []

		if (item.variations != null) {
			for (let variationItem of item.variations) {
				const variationItemIds: bigint[] = []

				for (let variationItemUuid of variationItem.variationItemUuids) {
					const variationItem =
						await context.prisma.variationItem.findFirst({
							where: {
								uuid: variationItemUuid
							}
						})

					if (variationItem == null) {
						throwApiError(apiErrors.variationItemDoesNotExist)
					}

					// TODO: Check if the variation item belongs to the product

					variationItemIds.push(variationItem.id)
				}

				variations.push({
					variationItemIds,
					count: variationItem.count
				})
			}
		}

		products.push({
			id: product.id,
			count: item.count,
			variations
		})
	}

	// Add the products to the order
	for (let product of products) {
		// Check if there is already a OrderItem
		let orderItem = await context.prisma.orderItem.findFirst({
			where: {
				orderId: order.id,
				productId: product.id
			}
		})

		if (orderItem == null) {
			// Create a new OrderItem
			orderItem = await context.prisma.orderItem.create({
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

			// Add the variations to the OrderItem
			for (let variation of product.variations) {
				// For each variation in product, create an OrderItemVariation
				let orderItemVariation =
					await context.prisma.orderItemVariation.create({
						data: {
							orderItem: {
								connect: {
									id: orderItem.id
								}
							},
							count: variation.count
						}
					})

				for (let variationItemId of variation.variationItemIds) {
					// For each variationItemId in variation, create an OrderItemVariationToVariationItem
					await context.prisma.orderItemVariationToVariationItem.create({
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
		} else {
			for (let variation of product.variations) {
				// Check if there is already a OrderItemVariation
				let orderVariationItem = await findCorrectVariationForOrderItem(
					context.prisma,
					orderItem,
					variation.variationItemIds
				)

				if (orderVariationItem == null) {
					// Create a new OrderItemVariation
					orderVariationItem =
						await context.prisma.orderItemVariation.create({
							data: {
								orderItem: {
									connect: {
										id: orderItem.id
									}
								},
								count: variation.count
							}
						})

					for (let variationItemId of variation.variationItemIds) {
						// For each variationItemId in variation, create an OrderItemVariationToVariationItem
						await context.prisma.orderItemVariationToVariationItem.create(
							{
								data: {
									orderItemVariation: {
										connect: {
											id: orderVariationItem.id
										}
									},
									variationItem: {
										connect: {
											id: variationItemId
										}
									}
								}
							}
						)
					}
				} else {
					// Update the OrderItemVariation
					await context.prisma.orderItemVariation.update({
						where: {
							id: orderVariationItem.id
						},
						data: {
							count: orderVariationItem.count + variation.count
						}
					})
				}
			}

			// Update the OrderItem
			orderItem = await context.prisma.orderItem.update({
				where: {
					id: orderItem.id
				},
				data: {
					count: orderItem.count + product.count
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
		let orderItem = await context.prisma.orderItem.findFirst({
			where: {
				orderId: order.id,
				productId: product.id
			}
		})

		if (orderItem == null) {
			throwApiError(apiErrors.productNotInOrder)
		}

		if (orderItem.count <= product.count) {
			// Delete the OrderToProduct item
			await context.prisma.orderItem.delete({
				where: {
					id: orderItem.id
				}
			})
		} else {
			// Update the OrderToProduct item
			await context.prisma.orderItem.update({
				where: {
					id: orderItem.id
				},
				data: {
					count: orderItem.count - product.count
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
	let products = await context.prisma.orderItem.findMany({
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

export async function orderItems(
	order: Order,
	args: {},
	context: ResolverContext
): Promise<List<OrderItem>> {
	const where = {
		orderId: order.id
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
