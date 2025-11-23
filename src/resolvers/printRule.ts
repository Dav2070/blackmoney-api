import {
	Category,
	ProductType,
	Printer,
	PrintRule,
	PrintRuleType,
	Product
} from "@prisma/client"
import { List, ResolverContext } from "../types.js"
import { throwApiError } from "../utils.js"
import { apiErrors } from "../errors.js"

export async function createPrintRule(
	parent: any,
	args: {
		registerClientUuid: string
		type: PrintRuleType
		productType?: ProductType
		printerUuids: string[]
		categoryUuids?: string[]
		productUuids?: string[]
	},
	context: ResolverContext
): Promise<PrintRule> {
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

	const printers: Printer[] = []
	const categories: Category[] = []
	const products: Product[] = []

	// Get the printers
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

	// Validate additional arguments based on PrintRuleType
	if (args.type === PrintRuleType.CATEGORIES) {
		for (const categoryUuid of args.categoryUuids || []) {
			// Get the category
			const category = await context.prisma.category.findFirst({
				where: {
					uuid: categoryUuid
				},
				include: {
					menu: {
						include: {
							restaurant: true
						}
					}
				}
			})

			if (category == null) {
				throwApiError(apiErrors.categoryDoesNotExist)
			}

			// Check if the category belongs to the same company
			if (category.menu.restaurant.companyId !== context.user.companyId) {
				throwApiError(apiErrors.actionNotAllowed)
			}

			categories.push(category)
		}

		if (categories.length === 0) {
			throwApiError(apiErrors.noCategoriesSpecified)
		}
	} else if (args.type === PrintRuleType.PRODUCTS) {
		for (const productUuid of args.productUuids || []) {
			// Get the product
			const product = await context.prisma.product.findFirst({
				where: {
					uuid: productUuid
				},
				include: {
					category: {
						include: {
							menu: {
								include: {
									restaurant: true
								}
							}
						}
					}
				}
			})

			if (product == null) {
				throwApiError(apiErrors.productDoesNotExist)
			}

			// Check if the product belongs to the same company
			if (
				product.category.menu.restaurant.companyId !==
				context.user.companyId
			) {
				throwApiError(apiErrors.actionNotAllowed)
			}

			products.push(product)
		}

		if (products.length === 0) {
			throwApiError(apiErrors.noProductsSpecified)
		}
	}

	// Create the PrintRule
	return await context.prisma.printRule.create({
		data: {
			type: args.type,
			productType: args.productType,
			registerClient: {
				connect: {
					id: registerClient.id
				}
			},
			printers: {
				connect: printers.map(p => ({ id: p.id }))
			},
			categories: {
				connect: categories.map(c => ({ id: c.id }))
			},
			products: {
				connect: products.map(p => ({ id: p.id }))
			}
		}
	})
}

export async function updatePrintRule(
	parent: any,
	args: {
		uuid: string
		printerUuids: string[]
		categoryUuids?: string[]
		productUuids?: string[]
	},
	context: ResolverContext
): Promise<PrintRule> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the PrintRule
	const printRule = await context.prisma.printRule.findFirst({
		where: { uuid: args.uuid },
		include: {
			registerClient: {
				include: {
					register: {
						include: {
							restaurant: true
						}
					}
				}
			}
		}
	})

	if (printRule == null) {
		throwApiError(apiErrors.printRuleDoesNotExist)
	}

	// Check if the PrintRule belongs to the same company as the user
	if (
		printRule.registerClient.register.restaurant.companyId !==
		context.user.companyId
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	const printers: Printer[] = []
	const categories: Category[] = []
	const products: Product[] = []

	// Get the printers
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

	// Validate additional arguments based on PrintRuleType
	if (printRule.type === PrintRuleType.CATEGORIES) {
		for (const categoryUuid of args.categoryUuids ?? []) {
			// Get the category
			const category = await context.prisma.category.findFirst({
				where: {
					uuid: categoryUuid
				},
				include: {
					menu: {
						include: {
							restaurant: true
						}
					}
				}
			})

			if (category == null) {
				throwApiError(apiErrors.categoryDoesNotExist)
			}

			// Check if the category belongs to the same company
			if (category.menu.restaurant.companyId !== context.user.companyId) {
				throwApiError(apiErrors.actionNotAllowed)
			}

			categories.push(category)
		}

		if (categories.length === 0) {
			throwApiError(apiErrors.noCategoriesSpecified)
		}
	} else if (printRule.type === PrintRuleType.PRODUCTS) {
		for (const productUuid of args.productUuids ?? []) {
			// Get the product
			const product = await context.prisma.product.findFirst({
				where: {
					uuid: productUuid
				},
				include: {
					category: {
						include: {
							menu: {
								include: {
									restaurant: true
								}
							}
						}
					}
				}
			})

			if (product == null) {
				throwApiError(apiErrors.productDoesNotExist)
			}

			// Check if the product belongs to the same company
			if (
				product.category.menu.restaurant.companyId !==
				context.user.companyId
			) {
				throwApiError(apiErrors.actionNotAllowed)
			}

			products.push(product)
		}

		if (products.length === 0) {
			throwApiError(apiErrors.noProductsSpecified)
		}
	}

	// Update the PrintRule
	return await context.prisma.printRule.update({
		where: { id: printRule.id },
		data: {
			printers: {
				set: printers.map(p => ({ id: p.id }))
			},
			categories: {
				set: categories.map(c => ({ id: c.id }))
			},
			products: {
				set: products.map(p => ({ id: p.id }))
			}
		}
	})
}

export async function deletePrintRule(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<PrintRule> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the PrintRule
	const printRule = await context.prisma.printRule.findFirst({
		where: { uuid: args.uuid },
		include: {
			registerClient: {
				include: {
					register: {
						include: {
							restaurant: true
						}
					}
				}
			}
		}
	})

	if (printRule == null) {
		throwApiError(apiErrors.printRuleDoesNotExist)
	}

	// Check if the PrintRule belongs to the same company as the user
	if (
		printRule.registerClient.register.restaurant.companyId !==
		context.user.companyId
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Delete the PrintRule
	return await context.prisma.printRule.delete({
		where: { id: printRule.id }
	})
}

export async function printers(
	printRule: PrintRule,
	args: {},
	context: ResolverContext
): Promise<List<Printer>> {
	const where = {
		printRules: {
			some: {
				id: printRule.id
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
	printRule: PrintRule,
	args: {},
	context: ResolverContext
): Promise<List<Category>> {
	const where = {
		printRules: {
			some: {
				id: printRule.id
			}
		}
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.category.count({ where }),
		context.prisma.category.findMany({ where })
	])

	return { total, items }
}

export async function products(
	printRule: PrintRule,
	args: {},
	context: ResolverContext
): Promise<List<Product>> {
	const where = {
		printRules: {
			some: {
				id: printRule.id
			}
		}
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.product.count({ where }),
		context.prisma.product.findMany({ where })
	])

	return { total, items }
}
