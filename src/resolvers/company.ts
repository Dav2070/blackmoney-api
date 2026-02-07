import Stripe from "stripe"
import {
	PrismaClient,
	Company,
	Restaurant,
	User
} from "../../prisma/generated/client.js"
import { apiErrors } from "../errors.js"
import { List, ResolverContext, StripeOnboardingStatus } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { validateNameLength } from "../services/validationService.js"

export async function retrieveCompany(
	parent: any,
	args: any,
	context: ResolverContext
): Promise<Company> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	return await context.prisma.company.findFirst({
		where: { userId: context.davUser.Id }
	})
}

export async function createCompany(
	parent: any,
	args: { name: string },
	context: ResolverContext
): Promise<Company> {
	// Check if the user is logged in
	if (context.davUser == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Check if the user already has a company
	const existingCompany = await context.prisma.company.findFirst({
		where: { userId: BigInt(context.davUser.Id) }
	})

	if (existingCompany != null) {
		throwApiError(apiErrors.companyAlreadyExists)
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	// Create the Stripe connected account for the company
	const account = await context.stripe.v2.core.accounts.create({
		dashboard: "full",
		defaults: {
			currency: "eur",
			locales: ["de-DE"],
			responsibilities: {
				fees_collector: "stripe",
				losses_collector: "stripe"
			}
		},
		display_name: args.name,
		contact_email: context.davUser.Email,
		identity: {
			country: "DE"
		},
		configuration: {
			merchant: {
				capabilities: {
					card_payments: {
						requested: true
					}
				}
			},
			customer: {}
		}
	})

	// Create the company and the first restaurant for the company
	const company = await context.prisma.company.create({
		data: {
			name: args.name,
			userId: BigInt(context.davUser.Id),
			stripeAccountId: account.id,
			restaurants: {
				create: {
					name: args.name
				}
			}
		},
		include: {
			restaurants: true
		}
	})

	const restaurant = company.restaurants[0]
	await createDefaultDataForRestaurant(context.prisma, restaurant)

	// Create the default register for the restaurant
	await context.prisma.register.create({
		data: {
			name: "Hauptkasse",
			restaurant: {
				connect: {
					id: restaurant.id
				}
			}
		}
	})

	return company
}

export async function stripeOnboardingStatus(
	company: Company,
	args: {},
	context: ResolverContext
): Promise<StripeOnboardingStatus> {
	let account: Stripe.V2.Core.Account

	try {
		// Retrieve the Stripe account to check the onboarding status
		account = await context.stripe.v2.core.accounts.retrieve(
			company.stripeAccountId,
			{ include: ["configuration.merchant"] }
		)
	} catch (error) {
		console.error("Error retrieving Stripe account", error)
		throwApiError(apiErrors.unexpectedError)
	}

	const status =
		account.configuration.merchant.capabilities.card_payments.status

	if (status === "active") {
		return "COMPLETED"
	} else {
		return "PENDING"
	}
}

export async function restaurants(
	company: Company,
	args: {},
	context: ResolverContext
): Promise<List<Restaurant>> {
	let where = { companyId: company.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.restaurant.count({ where }),
		context.prisma.restaurant.findMany({
			where,
			orderBy: { name: "asc" }
		})
	])

	return {
		total,
		items
	}
}

export async function users(
	company: Company,
	args: {},
	context: ResolverContext
): Promise<List<User>> {
	// Get the users
	const where = { companyId: company.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.user.count({
			where
		}),
		context.prisma.user.findMany({
			where,
			orderBy: { name: "asc" }
		})
	])

	return {
		total,
		items
	}
}

//#region Helper functions
async function createDefaultDataForRestaurant(
	prisma: PrismaClient,
	restaurant: Restaurant
) {
	// Create default rooms
	await prisma.room.createMany({
		data: [
			{ name: "1", restaurantId: restaurant.id },
			{ name: "2", restaurantId: restaurant.id },
			{ name: "3", restaurantId: restaurant.id }
		]
	})

	// Create default menu
	const menu = await prisma.menu.create({
		data: {
			restaurantId: restaurant.id
		}
	})

	// Create default category
	const [categoryPizza, categoryAlkoholfrei, categoryAktionen, categoryMenus] =
		await prisma.category.createManyAndReturn({
			data: [
				{
					name: "Pizza",
					menuId: menu.id
				},
				{
					name: "Alkoholfrei",
					menuId: menu.id
				},
				{
					name: "Aktionen",
					menuId: menu.id
				},
				{
					name: "Menüs",
					menuId: menu.id
				}
			]
		})

	// Create default products
	const [
		productMargherita,
		productSalami,
		productCola,
		productFanta,
		productMittagsSpecial,
		productPizzaMenu
	] = await prisma.product.createManyAndReturn({
		data: [
			{
				name: "Pizza Margherita",
				price: 850,
				type: "FOOD",
				categoryId: categoryPizza.id
			},
			{
				name: "Pizza Salami",
				price: 990,
				type: "FOOD",
				categoryId: categoryPizza.id
			},
			{
				name: "Cola",
				price: 280,
				type: "DRINK",
				categoryId: categoryAlkoholfrei.id
			},
			{
				name: "Fanta",
				price: 280,
				type: "DRINK",
				categoryId: categoryAlkoholfrei.id
			},
			{
				name: "Mittags-Special",
				price: 0,
				type: "SPECIAL",
				categoryId: categoryAktionen.id
			},
			{
				name: "Pizza-Menü",
				price: 0,
				type: "MENU",
				categoryId: categoryMenus.id
			}
		]
	})

	// Create default variations
	const [
		variationSizeMargherita,
		variationSizeSalami,
		variationSizeCola,
		variationSizeFanta
	] = await prisma.variation.createManyAndReturn({
		data: [
			{ name: "Größe", menuId: menu.id },
			{ name: "Größe", menuId: menu.id },
			{ name: "Größe", menuId: menu.id },
			{ name: "Größe", menuId: menu.id }
		]
	})

	// Create default variation items
	await prisma.variationItem.createMany({
		data: [
			{
				name: "Klein",
				additionalCost: 0,
				variationId: variationSizeMargherita.id
			},
			{
				name: "Groß",
				additionalCost: 200,
				variationId: variationSizeMargherita.id
			},
			{
				name: "Klein",
				additionalCost: 0,
				variationId: variationSizeSalami.id
			},
			{
				name: "Groß",
				additionalCost: 250,
				variationId: variationSizeSalami.id
			},
			{
				name: "0,3L",
				additionalCost: 0,
				variationId: variationSizeCola.id
			},
			{
				name: "0,5L",
				additionalCost: 70,
				variationId: variationSizeCola.id
			},
			{
				name: "0,3L",
				additionalCost: 0,
				variationId: variationSizeFanta.id
			},
			{
				name: "0,5L",
				additionalCost: 70,
				variationId: variationSizeFanta.id
			}
		]
	})

	// Create default offers for specials & menus
	const [mittagsSpecialOffer, pizzaMenuOffer] =
		await prisma.offer.createManyAndReturn({
			data: [
				{
					menuId: menu.id,
					productId: productMittagsSpecial.id,
					offerType: "DISCOUNT",
					discountType: "PERCENTAGE",
					offerValue: 20,
					startTime: "11:00",
					endTime: "14:00",
					weekdays: [
						"MONDAY",
						"TUESDAY",
						"WEDNESDAY",
						"THURSDAY",
						"FRIDAY"
					]
				},
				{
					menuId: menu.id,
					productId: productPizzaMenu.id,
					offerType: "FIXED_PRICE",
					offerValue: 1490,
					weekdays: [
						"MONDAY",
						"TUESDAY",
						"WEDNESDAY",
						"THURSDAY",
						"FRIDAY",
						"SATURDAY",
						"SUNDAY"
					]
				}
			]
		})

	// Create default offer items
	// Here using $transaction, as connect does not work with createMany
	await prisma.$transaction([
		prisma.offerItem.create({
			data: {
				offerId: mittagsSpecialOffer.id,
				name: "Hauptgericht",
				maxSelections: 1,
				products: {
					connect: [{ id: productMargherita.id }, { id: productSalami.id }]
				}
			}
		}),
		prisma.offerItem.create({
			data: {
				offerId: pizzaMenuOffer.id,
				name: "Pizza",
				maxSelections: 1,
				products: {
					connect: [{ id: productMargherita.id }, { id: productSalami.id }]
				}
			}
		}),
		prisma.offerItem.create({
			data: {
				offerId: pizzaMenuOffer.id,
				name: "Getränk",
				maxSelections: 1,
				products: {
					connect: [{ id: productCola.id }, { id: productFanta.id }]
				}
			}
		})
	])
}
//#endregion
