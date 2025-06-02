import { Bill, Order, OrderItem, Table } from "@prisma/client"
import { apiErrors } from "../errors.js"
import { ResolverContext, List, PaymentMethod } from "../types.js"
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

export async function listOrders(
	parent: any,
	args: {
		completed?: boolean
	},
	context: ResolverContext
): Promise<List<Order>> {
	const completed = args.completed ?? false

	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the orders
	const where = {
		// TODO: Get only the orders of the company of the user
		paidAt: completed ? { not: null } : null
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.order.count({ where }),
		context.prisma.order.findMany({ where })
	])

	return {
		total,
		items
	}
}

export async function createOrder(
	parent: any,
	args: {
		tableUuid: string
	},
	context: ResolverContext
): Promise<Order> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Check if the table exists
	const table = await context.prisma.table.findFirst({
		where: {
			uuid: args.tableUuid
		}
	})

	if (table == null) {
		throwApiError(apiErrors.tableDoesNotExist)
	}

	// Check if the table belongs to the same company as the user
	// TODO

	// Create the order
	return await context.prisma.order.create({
		data: {
			table: {
				connect: {
					id: table.id
				}
			}
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
		},
		include: {
			orderItemVariations: {
				include: {
					orderItemVariationToVariationItems: true
				}
			}
		}
	})

	const orderItemsToDelete: (OrderItem & {
		orderItemVariations: ({
			orderItemVariationToVariationItems: {
				id: bigint
				orderItemVariationId: bigint
				variationItemId: bigint
			}[]
		} & {
			id: bigint
			uuid: string
			count: number
			orderItemId: bigint
		})[]
	})[] = []

	//Erstelle Liste mit den OrderItems, die gelöscht werden könnten
	for (let orderItem of orderItems) {
		orderItemsToDelete.push(orderItem)
	}

	for (let item of args.orderItems) {
		//Finde das OrderItem, das geupdatet werden soll
		let orderItem = orderItemsToDelete.find(
			oi => oi.productId == BigInt(item.productId)
		)

		// Check ob das OrderItem existiert und entfern es aus der potentiellen Liste der zu löschenden Items
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
		}
		//Füge das OrderItem in der Datenbank hinzu
		else if (orderItem == null || orderItem.count > 0) {
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

		// Falls Variationen vorhanden sind, diese ebenfalls aktualisieren
		if (item.orderItemVariations) {
			const orderItemVariationsToDelete: {
				id: bigint
				uuid: string
				count: number
				orderItemId: bigint
			}[] = orderItem.orderItemVariations

			for (const variation of item.orderItemVariations) {
				// Try to find the existing variation
				let existingVariation = orderItem.orderItemVariations.find(
					oiv =>
						oiv.orderItemVariationToVariationItems.length ===
							variation.variationItems.length &&
						oiv.orderItemVariationToVariationItems.every(
							(item, index) =>
								item.id === BigInt(variation.variationItems[index].id)
						)
				)

				if (existingVariation != null) {
					let i = orderItemVariationsToDelete.indexOf(existingVariation)
					if (i != -1) orderItemVariationsToDelete.splice(i, 1)

					if (existingVariation.count != variation.count) {
						// Existierende Variation aktualisieren
						await context.prisma.orderItemVariation.update({
							where: {
								id: existingVariation.id
							},
							data: {
								count: variation.count
							}
						})
					}
				} else {
					// Neue Variation hinzufügen
					const newOrderItemVariation =
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

					for (const variationItem of variation.variationItems) {
						await context.prisma.orderItemVariationToVariationItem.create(
							{
								data: {
									orderItemVariation: {
										connect: {
											id: newOrderItemVariation.id
										}
									},
									variationItem: {
										connect: {
											id: variationItem.id
										}
									}
								}
							}
						)
					}
				}
			}

			// Delete the order item variations
			const deleteOrderItemVariationsCommands = []

			for (let orderItemVariation of orderItemVariationsToDelete) {
				deleteOrderItemVariationsCommands.push(
					context.prisma.orderItemVariation.delete({
						where: {
							id: orderItemVariation.id
						}
					})
				)
			}

			await context.prisma.$transaction(deleteOrderItemVariationsCommands)
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

export async function completeOrder(
	parent: any,
	args: {
		uuid: string
		billUuid: string
		paymentMethod: PaymentMethod
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

	// Check if the order is already completed
	if (order.paidAt != null) {
		throwApiError(apiErrors.orderAlreadyCompleted)
	}

	// Get the bill
	const bill = await context.prisma.bill.findFirst({
		where: {
			uuid: args.billUuid
		}
	})

	// Check if the bill exists
	if (bill == null) {
		throwApiError(apiErrors.billDoesNotExist)
	}

	// If the order has a billId, check if it matches the bill
	if (order.billId != null && order.billId !== bill.id) {
		throwApiError(apiErrors.billNotMatchingExistingBillOfOrder)
	}

	// Update the order
	return await context.prisma.order.update({
		where: {
			id: order.id
		},
		data: {
			paidAt: new Date(),
			paymentMethod: args.paymentMethod,
			bill: {
				connect: {
					id: bill.id
				}
			},
			user: {
				connect: {
					id: context.user.id
				}
			}
		}
	})
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
