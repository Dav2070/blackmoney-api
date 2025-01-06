import { Order } from "@prisma/client"
import { ResolverContext } from "../types.js"

export async function addProducts(
	parent: any,
	args: { uuid: string; products: { uuid: string; count: number }[] },
	context: ResolverContext
): Promise<Order> {
	console.log(args)
	return null
}
