import {
	Offer,
	OfferItem,
	OfferType,
	DiscountType,
	Weekday
} from "../../prisma/generated/client.js"
import { List, ResolverContext } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { apiErrors } from "../errors.js"
import { validateNameLength, validateOfferValue } from "../services/validationService.js"

export async function createOffer(
	parent: any,
	args: {
		productUuid: string
		offerType: OfferType
		discountType?: DiscountType
		offerValue: number
		startDate?: string
		endDate?: string
		startTime?: string
		endTime?: string
		weekdays: Weekday[]
		offerItems: {
			name: string
			maxSelections: number
			productUuids: string[]
		}[]
	},
	context: ResolverContext
): Promise<Offer> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the product
	const product = await context.prisma.product.findFirst({
		where: { uuid: args.productUuid },
		include: { category: { include: { menu: { include: { restaurant: true } } } } }
	})

	if (product == null) {
		throwApiError(apiErrors.productDoesNotExist)
	}

	// Check if the user belongs to the same company and has the correct role
	if (
		context.user.companyId !== product.category.menu.restaurant.companyId ||
		!["ADMIN", "OWNER"].includes(context.user.role)
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Check if product already has an offer
	const existingOffer = await context.prisma.offer.findFirst({
		where: { productId: product.id }
	})

	if (existingOffer != null) {
		throwApiError(apiErrors.productAlreadyHasOffer)
	}

	// Validate offer value
	throwValidationError(validateOfferValue(args.offerValue))

	// Create the offer
	const offer = await context.prisma.offer.create({
		data: {
			offerType: args.offerType,
			discountType: args.discountType,
			offerValue: args.offerValue,
			startDate: args.startDate ? new Date(args.startDate) : null,
			endDate: args.endDate ? new Date(args.endDate) : null,
			startTime: args.startTime,
			endTime: args.endTime,
			weekdays: args.weekdays,
			menuId: product.category.menuId,
			productId: product.id
		}
	})

	// Create offer items
	for (const offerItemInput of args.offerItems) {
		// Validate name
		throwValidationError(validateNameLength(offerItemInput.name))

		// Collect product connections
		const productConnections = []
		for (const productUuid of offerItemInput.productUuids) {
			const offerProduct = await context.prisma.product.findFirst({
				where: { uuid: productUuid }
			})

			if (offerProduct != null) {
				productConnections.push({ id: offerProduct.id })
			}
		}

		await context.prisma.offerItem.create({
			data: {
				name: offerItemInput.name,
				maxSelections: offerItemInput.maxSelections,
				offerId: offer.id,
				products: {
					connect: productConnections
				}
			}
		})
	}

	return offer
}

export async function updateOffer(
	parent: any,
	args: {
		uuid: string
		offerType?: OfferType
		discountType?: DiscountType
		offerValue?: number
		startDate?: string
		endDate?: string
		startTime?: string
		endTime?: string
		weekdays?: Weekday[]
		offerItems?: {
			name: string
			maxSelections: number
			productUuids: string[]
		}[]
	},
	context: ResolverContext
): Promise<Offer> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the offer
	const offer = await context.prisma.offer.findFirst({
		where: { uuid: args.uuid },
		include: { menu: { include: { restaurant: true } } }
	})

	if (offer == null) {
		throwApiError(apiErrors.offerDoesNotExist)
	}

	// Check if the user belongs to the same company and has the correct role
	if (
		context.user.companyId !== offer.menu.restaurant.companyId ||
		!["ADMIN", "OWNER"].includes(context.user.role)
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate offer value if provided
	if (args.offerValue != null) {
		throwValidationError(validateOfferValue(args.offerValue))
	}

	// Update the offer
	const updatedOffer = await context.prisma.offer.update({
		where: { id: offer.id },
		data: {
			...(args.offerType != null && { offerType: args.offerType }),
			...(args.discountType !== null && { discountType: args.discountType }),
			...(args.offerValue != null && { offerValue: args.offerValue }),
			...(args.startDate !== null && {
				startDate: args.startDate ? new Date(args.startDate) : null
			}),
			...(args.endDate !== null && {
				endDate: args.endDate ? new Date(args.endDate) : null
			}),
			...(args.startTime !== null && { startTime: args.startTime }),
			...(args.endTime !== null && { endTime: args.endTime }),
			...(args.weekdays != null && { weekdays: args.weekdays })
		}
	})

	// Update offer items if provided
	if (args.offerItems != null) {
		// Delete existing offer items
		await context.prisma.offerItem.deleteMany({
			where: { offerId: offer.id }
		})

		// Create new offer items
		for (const offerItemInput of args.offerItems) {
			// Validate name
			throwValidationError(validateNameLength(offerItemInput.name))

			// Collect product connections
			const productConnections = []
			for (const productUuid of offerItemInput.productUuids) {
				const offerProduct = await context.prisma.product.findFirst({
					where: { uuid: productUuid }
				})

				if (offerProduct != null) {
					productConnections.push({ id: offerProduct.id })
				}
			}

			await context.prisma.offerItem.create({
				data: {
					name: offerItemInput.name,
					maxSelections: offerItemInput.maxSelections,
					offerId: offer.id,
					products: {
						connect: productConnections
					}
				}
			})
		}
	}

	return updatedOffer
}

export async function deleteOffer(
	parent: any,
	args: {
		uuid: string
	},
	context: ResolverContext
): Promise<Offer> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the offer
	const offer = await context.prisma.offer.findFirst({
		where: { uuid: args.uuid },
		include: { menu: { include: { restaurant: true } } }
	})

	if (offer == null) {
		throwApiError(apiErrors.offerDoesNotExist)
	}

	// Check if the user belongs to the same company and has the correct role
	if (
		context.user.companyId !== offer.menu.restaurant.companyId ||
		!["ADMIN", "OWNER"].includes(context.user.role)
	) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Delete the offer (cascade will handle offer items)
	return await context.prisma.offer.delete({
		where: { id: offer.id }
	})
}

export function id(offer: Offer): number {
	return Number(offer.id)
}

export function startDate(offer: Offer): string {
	return offer.startDate?.toISOString() ?? null
}

export function endDate(offer: Offer): string {
	return offer.endDate?.toISOString() ?? null
}

export async function offerItems(
	offer: Offer,
	args: {},
	context: ResolverContext
): Promise<List<OfferItem>> {
	const where = { offerId: offer.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.offerItem.count({ where }),
		context.prisma.offerItem.findMany({ where })
	])

	return {
		total,
		items
	}
}
