import { CategoryType, CategoryTypePrintRule, Printer } from "@prisma/client"
import { List, ResolverContext } from "../types.js"
import { throwApiError } from "../utils.js"
import { apiErrors } from "../errors.js"

export async function createCategoryTypePrintRule(
	parent: any,
	args: {
		registerClientUuid: string
		categoryType?: CategoryType
		printerUuids: string[]
	},
	context: ResolverContext
): Promise<CategoryTypePrintRule> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the register client
	const registerClient = await context.prisma.registerClient.findFirst({
		where: {
			uuid: args.registerClientUuid
		},
		include: {
			register: {
				include: {
					restaurant: true
				}
			}
		}
	})

	if (registerClient == null) {
		throwApiError(apiErrors.registerClientDoesNotExist)
	}

	// Check if the register client belongs to the same company as the user
	if (
		registerClient.register.restaurant.companyId !== context.user.companyId
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Get the printers
	const printers: Printer[] = []

	for (const printerUuid of args.printerUuids) {
		// Get the printer
		const printer = await context.prisma.printer.findFirst({
			where: {
				uuid: printerUuid
			},
			include: {
				restaurant: true
			}
		})

		if (printer == null) {
			throwApiError(apiErrors.printerDoesNotExist)
		}

		// Check if the printer belongs to the same company
		if (printer.restaurant.companyId != context.user.companyId) {
			throwApiError(apiErrors.actionNotAllowed)
		}

		printers.push(printer)
	}

	if (printers.length === 0) {
		throwApiError(apiErrors.noPrintersSpecified)
	}

	// Create the CategoryTypePrintRule
	return await context.prisma.categoryTypePrintRule.create({
		data: {
			categoryType: args.categoryType,
			registerClient: {
				connect: {
					id: registerClient.id
				}
			},
			printers: {
				connect: printers.map(p => ({ id: p.id }))
			}
		}
	})
}

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
