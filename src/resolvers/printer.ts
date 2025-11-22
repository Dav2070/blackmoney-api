import { Prisma, Printer } from "@prisma/client"
import { List, ResolverContext } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { apiErrors } from "../errors.js"
import {
	validateIpAddress,
	validateNameLength
} from "../services/validationService.js"

export async function searchPrinters(
	parent: any,
	args: {
		restaurantUuid: string
		query: string
		exclude?: string[]
	},
	context: ResolverContext
): Promise<List<Printer>> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findFirst({
		where: { uuid: args.restaurantUuid }
	})

	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if the restaurant belongs to the same company as the user
	if (restaurant.companyId !== context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Search for printers
	const where: Prisma.PrinterWhereInput = {
		restaurantId: restaurant.id,
		name: {
			contains: args.query,
			mode: "insensitive"
		},
		uuid: {
			notIn: args.exclude ?? []
		}
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.printer.count({ where }),
		context.prisma.printer.findMany({
			where,
			take: 10,
			orderBy: {
				name: "asc"
			}
		})
	])

	return {
		total,
		items
	}
}

export async function createPrinter(
	parent: any,
	args: {
		restaurantUuid: string
		name: string
		ipAddress: string
	},
	context: ResolverContext
): Promise<Printer> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Check if the user is an admin or owner
	if (context.user.role !== "ADMIN" && context.user.role !== "OWNER") {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findFirst({
		where: { uuid: args.restaurantUuid }
	})

	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if the restaurant belongs to the same company as the user
	if (restaurant.companyId !== context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Check if there is already a printer with this ip address
	const existingPrinter = await context.prisma.printer.findFirst({
		where: {
			ipAddress: args.ipAddress,
			restaurantId: restaurant.id
		}
	})

	if (existingPrinter != null) {
		throwApiError(apiErrors.printerAlreadyExists)
	}

	// Validate the args
	throwValidationError(
		validateNameLength(args.name),
		validateIpAddress(args.ipAddress)
	)

	// Create the printer
	return await context.prisma.printer.create({
		data: {
			name: args.name,
			ipAddress: args.ipAddress,
			restaurant: {
				connect: {
					id: restaurant.id
				}
			}
		}
	})
}

export async function updatePrinter(
	parent: any,
	args: {
		uuid: string
		name?: string
		ipAddress?: string
	},
	context: ResolverContext
): Promise<Printer> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Check if the user is an admin or owner
	if (context.user.role !== "ADMIN" && context.user.role !== "OWNER") {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Get the printer
	const printer = await context.prisma.printer.findFirst({
		where: { uuid: args.uuid },
		include: { restaurant: true }
	})

	if (printer == null) {
		throwApiError(apiErrors.printerDoesNotExist)
	}

	// Check if the printer belongs to a restaurant of the company
	if (printer.restaurant.companyId !== context.user.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	if (args.name == null && args.ipAddress == null) {
		return printer
	}

	if (args.ipAddress != null && args.ipAddress !== printer.ipAddress) {
		// Check if there is alrady a printer with this ip address
		const existingPrinter = await context.prisma.printer.findFirst({
			where: {
				ipAddress: args.ipAddress,
				restaurantId: printer.restaurant.id
			}
		})

		if (existingPrinter != null) {
			throwApiError(apiErrors.printerAlreadyExists)
		}
	}

	// Validate the args
	let errors: string[] = []

	if (args.name != null) {
		errors.push(validateNameLength(args.name))
	}

	if (args.ipAddress != null) {
		errors.push(validateIpAddress(args.ipAddress))
	}

	throwValidationError(...errors)

	// Update the printer
	let data: any = {}

	if (args.name != null) {
		data.name = args.name
	}

	if (args.ipAddress != null) {
		data.ipAddress = args.ipAddress
	}

	return await context.prisma.printer.update({
		where: { id: printer.id },
		data
	})
}
