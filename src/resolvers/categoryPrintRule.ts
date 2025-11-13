import { Category, CategoryPrintRule, Printer } from "@prisma/client"
import { List, ResolverContext } from "../types.js"

export async function printers(
	categoryPrintRule: CategoryPrintRule,
	args: {},
	context: ResolverContext
): Promise<List<Printer>> {
	const where = {
		categoryPrintRules: {
			some: {
				id: categoryPrintRule.id
			}
		}
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.printer.count({ where }),
		context.prisma.printer.findMany({ where })
	])

	return { total, items }
}

export async function categories(
	categoryPrintRule: CategoryPrintRule,
	args: {},
	context: ResolverContext
): Promise<List<Category>> {
	const where = {
		categoryPrintRules: {
			some: {
				id: categoryPrintRule.id
			}
		}
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.category.count({ where }),
		context.prisma.category.findMany({ where })
	])

	return { total, items }
}
