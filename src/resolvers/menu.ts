import { Category, Menu, Offer } from "../../prisma/generated/client.js"
import { List, ResolverContext } from "../types.js"

export async function categories(
	menu: Menu,
	args: {},
	context: ResolverContext
): Promise<List<Category>> {
	const where = { menuId: menu.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.category.count({ where }),
		context.prisma.category.findMany({ where })
	])

	return {
		total,
		items
	}
}

export async function offers(
	menu: Menu,
	args: {},
	context: ResolverContext
): Promise<List<Offer>> {
	const where = { menuId: menu.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.offer.count({ where }),
		context.prisma.offer.findMany({ where })
	])

	return {
		total,
		items
	}
}
