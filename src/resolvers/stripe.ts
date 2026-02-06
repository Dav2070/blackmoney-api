import { ResolverContext } from "../types.js"

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
