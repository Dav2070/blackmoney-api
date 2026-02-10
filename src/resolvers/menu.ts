import {
	Category,
	Menu,
	Offer,
	Variation
} from "../../prisma/generated/client.js"
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

export async function variations(
	menu: Menu,
	args: {},
	context: ResolverContext
): Promise<List<Variation>> {
	const where = { menuId: menu.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.variation.count({ where }),
		context.prisma.variation.findMany({ where })
	])

	return {
		total,
		items
	}
}
