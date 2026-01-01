import { Order, PrismaClient } from "../../../prisma/generated/client.js"
import { apiErrors } from "../../errors.js"
import { PaymentMethod } from "../../types.js"
import { throwApiError } from "../../utils.js"
import { startTransaction, finishTransaction } from "../fiskalyApiService.js"

/**
 * Service for handling order completion and payment processing
 */
export class OrderCompletionService {
	constructor(private readonly prisma: PrismaClient) {}

	/**
	 * Completes an order with payment processing via Fiskaly
	 */
	async completeOrder(
		order: Order,
		billUuid: string,
		paymentMethod: PaymentMethod,
		userId: bigint
	): Promise<Order> {
		// Check if the order is already completed
		if (order.paidAt != null) {
			throwApiError(apiErrors.orderAlreadyCompleted)
		}

		// Get the bill
		const bill = await this.prisma.bill.findFirst({
			where: { uuid: billUuid },
			include: {
				registerClient: {
					include: {
						register: true
					}
				}
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

		// Start the transaction with the ordered items
		const orderItems = await this.prisma.orderItem.findMany({
			where: { orderId: order.id },
			include: { product: true }
		})

		const startTransactionResponse = await startTransaction(
			bill.registerClient.register.uuid,
			bill.registerClient.uuid,
			order.uuid,
			orderItems.map(item => ({
				quantity: item.count,
				text: item.product.name,
				pricePerUnit: item.product.price
			}))
		)

		if (startTransactionResponse == null) {
			throwApiError(apiErrors.unexpectedError)
		}

		// Finish the transaction
		const finishTransactionResponse = await finishTransaction(
			bill.registerClient.register.uuid,
			bill.registerClient.uuid,
			order.uuid,
			startTransactionResponse.schema.raw.process_type,
			startTransactionResponse.schema.raw.process_data
		)

		if (finishTransactionResponse == null) {
			throwApiError(apiErrors.unexpectedError)
		}

		// Update the order
		return await this.prisma.order.update({
			where: { id: order.id },
			data: {
				paidAt: new Date(),
				paymentMethod,
				bill: {
					connect: { id: bill.id }
				},
				user: {
					connect: { id: userId }
				}
			}
		})
	}
}
