import { CategoryTypePrintRule, Printer } from "@prisma/client"
import { List, ResolverContext } from "../types.js"

export async function printers(
	categoryTypePrintRule: CategoryTypePrintRule,
	args: {},
	context: ResolverContext
): Promise<List<Printer>> {
	const where = {
		categoryTypePrintRules: {
			some: {
				id: categoryTypePrintRule.id
			}
		}
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.printer.count({ where }),
		context.prisma.printer.findMany({ where })
	])

	return { total, items }
}
