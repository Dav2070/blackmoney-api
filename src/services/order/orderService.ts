import { Order, PrismaClient } from "../../../prisma/generated/client.js"
import { apiErrors } from "../../errors.js"
import { throwApiError } from "../../utils.js"
import { ProductInputArgs } from "../../types/orderTypes.js"
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
	 * Adds products to an order
	 */
	async addProductsToOrder(
		orderUuid: string,
		productsArgs: ProductInputArgs[]
	): Promise<Order> {
		const order = await this.getOrder(orderUuid)

		if (order == null) {
			throwApiError(apiErrors.orderDoesNotExist)
		}

		const products = await this.orderItemService.convertProductInputArgs(
			productsArgs
		)
		await this.orderItemService.addProducts(order, products)

		return order
	}

	/**
	 * Removes products from an order
	 */
	async removeProductsFromOrder(
		orderUuid: string,
		productsArgs: ProductInputArgs[]
	): Promise<Order> {
		const order = await this.getOrder(orderUuid)

		if (order == null) {
			throwApiError(apiErrors.orderDoesNotExist)
		}

		const products = await this.orderItemService.convertProductInputArgs(
			productsArgs
		)
		await this.orderItemService.removeProducts(order, products)

		return order
	}
}
