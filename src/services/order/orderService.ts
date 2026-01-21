import { Order, PrismaClient } from "../../../prisma/generated/client.js"
import { apiErrors } from "../../errors.js"
import { throwApiError } from "../../utils.js"
import {  AddOrderItemInput } from "../../types/orderTypes.js"
import { OrderItemService } from "./orderItemService.js"

/**
 * Service for handling order business logic
 */
export class OrderService {
	private readonly orderItemService: OrderItemService

	constructor(private readonly prisma: PrismaClient) {
		this.orderItemService = new OrderItemService(prisma)
	}

	/**
	 * Creates a new order for a table
	 */
	async createOrder(tableUuid: string): Promise<Order> {
		// Check if the table exists
		const table = await this.prisma.table.findFirst({
			where: { uuid: tableUuid }
		})

		if (table == null) {
			throwApiError(apiErrors.tableDoesNotExist)
		}

		// Create the order
		return await this.prisma.order.create({
			data: {
				table: {
					connect: { id: table.id }
				}
			}
		})
	}

	/**
	 * Retrieves an order by UUID
	 */
	async getOrder(uuid: string): Promise<Order | null> {
		return await this.prisma.order.findFirst({
			where: { uuid }
		})
	}

	/**
	 * Lists orders with optional filtering
	 */
	async listOrders(completed?: boolean) {
		const where = {
			paidAt: completed ? { not: null } : null
		}

		const [total, items] = await this.prisma.$transaction([
			this.prisma.order.count({ where }),
			this.prisma.order.findMany({ where })
		])

		return { total, items }
	}

	/**
	 * Adds products to an order using UUID-based merge logic
	 * - If orderItem.uuid exists → merge (increment count)
	 * - If orderItem.uuid is null → create new
	 * - Same logic applies to variations and child orderItems
	 */
	async addProductsToOrder(
		orderUuid: string,
		orderItems: AddOrderItemInput[]
	): Promise<Order> {
		const order = await this.getOrder(orderUuid)

		if (order == null) {
			throwApiError(apiErrors.orderDoesNotExist)
		}

		await this.orderItemService.addOrderItems(order, orderItems)

		return order
	}

	/**
	 * Removes products from an order using UUID-based deletion
	 * - Requires orderItem.uuid to identify which items to remove
	 */
	async removeProductsFromOrder(
		orderUuid: string,
		orderItems: AddOrderItemInput[]
	): Promise<Order> {
		const order = await this.getOrder(orderUuid)

		if (order == null) {
			throwApiError(apiErrors.orderDoesNotExist)
		}

		await this.orderItemService.removeOrderItems(order, orderItems)

		return order
	}
}
