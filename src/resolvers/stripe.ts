import { apiErrors } from "../errors.js"
import { ResolverContext } from "../types.js"
import { throwApiError } from "../utils.js"

export async function createStripeSubscriptionCheckoutSession(
	parent: any,
	args: {
		successUrl: string
		cancelUrl: string
	},
	context: ResolverContext
): Promise<{ url: string }> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const company = await context.prisma.company.findFirst({
		where: {
			userId: context.davUser.Id
		}
	})

	if (company == null) {
		throwApiError(apiErrors.companyDoesNotExist)
	}

	// Create the checkout session
	const session = await context.stripe.checkout.sessions.create({
		mode: "subscription",
		line_items: [
			{
				price: process.env.STRIPE_REGISTER_PRICE_ID,
				quantity: 1
			}
		],
		customer_account: company.stripeAccountId,
		success_url: args.successUrl,
		cancel_url: args.cancelUrl
	})

	return {
		url: session.url
	}
}

export async function createStripeConnectionToken(
	parent: any,
	args: {},
	context: ResolverContext
): Promise<{
	secret: string
}> {
	const connectionToken =
		await context.stripe.terminal.connectionTokens.create()

	return {
		secret: connectionToken.secret
	}
}

export async function captureStripePaymentIntent(
	parent: any,
	args: { id: string },
	context: ResolverContext
): Promise<{ id: string }> {
	const paymentIntent = await context.stripe.paymentIntents.capture(args.id)

	return { id: paymentIntent.id }
}
