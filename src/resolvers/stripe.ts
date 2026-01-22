import { stripe } from "../../server.js"

export async function createStripeConnectionToken(): Promise<{
	secret: string
}> {
	const connectionToken = await stripe.terminal.connectionTokens.create()

	return {
		secret: connectionToken.secret
	}
}

export async function captureStripePaymentIntent(
	parent: any,
	args: { id: string }
): Promise<{ id: string }> {
	const paymentIntent = await stripe.paymentIntents.capture(args.id)
	return { id: paymentIntent.id }
}
