import Stripe from "stripe"
import { Register, RegisterClient } from "../../prisma/generated/client.js"
import { List, RegisterStatus, ResolverContext } from "../types.js"
import {
	generateAdminPin,
	throwApiError,
	throwValidationError
} from "../utils.js"
import { apiErrors } from "../errors.js"
import { validateNameLength } from "../services/validationService.js"
import {
	authenticateAdmin,
	createTss,
	logoutAdmin,
	setTssAdminPin,
	updateTss
} from "../services/fiskalyApiService.js"

export async function retrieveRegister(
	parent: any,
	args: {
		uuid: string
	},
	context: ResolverContext
): Promise<Register> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const register = await context.prisma.register.findFirst({
		where: { uuid: args.uuid },
		include: { restaurant: true }
	})

	if (register == null) {
		return null
	}

	// Check if the user has access to the restaurant of the register
	if (context.user.companyId !== register.restaurant.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	return register
}

export async function createRegister(
	parent: any,
	args: {
		restaurantUuid: string
		name: string
	},
	context: ResolverContext
): Promise<Register> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findFirst({
		where: {
			uuid: args.restaurantUuid
		},
		include: {
			company: true
		}
	})

	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if the company of the restaurant belongs to the user
	if (restaurant.company.userId !== BigInt(context.davUser.Id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	return await context.prisma.register.create({
		data: {
			name: args.name,
			restaurant: {
				connect: {
					id: restaurant.id
				}
			}
		}
	})
}

export async function activateRegister(
	parent: any,
	args: {
		uuid: string
	},
	context: ResolverContext
): Promise<Register> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the register
	const register = await context.prisma.register.findFirst({
		where: {
			uuid: args.uuid
		},
		include: {
			restaurant: {
				include: {
					company: true
				}
			}
		}
	})

	if (register == null) {
		throwApiError(apiErrors.registerDoesNotExist)
	}

	// Check if the company of the restaurant belongs to the user
	if (register.restaurant.company.userId !== BigInt(context.davUser.Id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Check if the register is already active
	if (register.adminPin != null) {
		throwApiError(apiErrors.registerAlreadyActive)
	}

	// Check if the user has an active subscription
	let customer: (Stripe.Customer | Stripe.DeletedCustomer) & {
		subscriptions: Stripe.ApiList<Stripe.Subscription>
	}

	try {
		customer = (await context.stripe.customers.retrieve(
			register.restaurant.company.stripeAccountId,
			{ expand: ["subscriptions"] }
		)) as (Stripe.Customer | Stripe.DeletedCustomer) & {
			subscriptions: Stripe.ApiList<Stripe.Subscription>
		}
	} catch (error) {
		console.error("Error retrieving customer from Stripe", error)
		throwApiError(apiErrors.unexpectedError)
	}

	if (
		customer == null ||
		customer.deleted ||
		customer.subscriptions.data.length === 0 ||
		customer.subscriptions.data[0].status !== "active"
	) {
		throwApiError(apiErrors.noActiveSubscription)
	}

	// Find the register subscription item
	const subscription = customer.subscriptions.data[0].items.data.find(
		i => i.price.id === process.env.STRIPE_REGISTER_PRICE_ID
	)

	if (subscription == null) {
		throwApiError(apiErrors.noActiveSubscription)
	}

	// Create the TSS
	let tss = await createTss(register.uuid)

	if (tss == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	const adminPuk = tss.admin_puk
	const adminPin = generateAdminPin()

	// Set the state to UNINITIALIZED
	tss = await updateTss(register.uuid, "UNINITIALIZED")

	if (tss == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Set an admin pin for the TSS
	const setPinResponse = await setTssAdminPin(
		register.uuid,
		adminPuk,
		adminPin
	)

	if (!setPinResponse) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Admin authentication
	const authenticateAdminResponse = await authenticateAdmin(
		register.uuid,
		adminPin
	)

	if (!authenticateAdminResponse) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Set the state to INITIALIZED
	tss = await updateTss(register.uuid, "INITIALIZED")

	if (tss == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Logout admin
	await logoutAdmin(register.uuid)

	// Update the subscription with the increased register quantity
	const previousQuantity = subscription.quantity ?? 1

	try {
		await context.stripe.subscriptionItems.update(subscription.id, {
			quantity: previousQuantity + 1
		})
	} catch (error) {
		console.error("Error updating subscription in Stripe", error)
		throwApiError(apiErrors.unexpectedError)
	}

	return await context.prisma.register.update({
		where: {
			uuid: register.uuid
		},
		data: {
			adminPin
		}
	})
}

export function status(register: Register): RegisterStatus {
	return register.adminPin == null ? "INACTIVE" : "ACTIVE"
}

export async function registerClients(
	register: Register,
	args: {},
	context: ResolverContext
): Promise<List<RegisterClient>> {
	let where = { registerId: register.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.registerClient.count({ where }),
		context.prisma.registerClient.findMany({ where })
	])

	return {
		total,
		items
	}
}
