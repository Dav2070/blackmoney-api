import { Category, Menu } from "@prisma/client"
import { List, ResolverContext } from "../types.js"

export async function categories(
	menu: Menu,
	args: {},
	context: ResolverContext
): Promise<List<Category>> {
	const where = { menuId: menu.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.category.count({ where }),
		context.prisma.category.findMany({ where }),
	])

	return {
		total,
		items
	}
}
