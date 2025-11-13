import { ProductPrintRule, Printer, Product } from "@prisma/client"
import { List, ResolverContext } from "../types.js"

export async function printers(
	productPrintRule: ProductPrintRule,
	args: {},
	context: ResolverContext
): Promise<List<Printer>> {
	const where = {
		productPrintRules: {
			some: {
				id: productPrintRule.id
			}
		}
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.printer.count({ where }),
		context.prisma.printer.findMany({ where })
	])

	return { total, items }
}

export async function products(
	productPrintRule: ProductPrintRule,
	args: {},
	context: ResolverContext
): Promise<List<Product>> {
	const where = {
		productPrintRules: {
			some: {
				id: productPrintRule.id
			}
		}
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.product.count({ where }),
		context.prisma.product.findMany({ where })
	])

	return { total, items }
}
