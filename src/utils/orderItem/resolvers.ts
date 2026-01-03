import { PrismaClient, Product } from "../../../prisma/generated/client.js"
import { apiErrors } from "../../errors.js"
import { throwApiError } from "../../utils.js"

/**
 * UUID Resolution Functions
 *
 * These functions handle the conversion from UUIDs (used in GraphQL/frontend)
 * to database IDs (used internally).
 */

/**
 * Resolves a product UUID to its database entity.
 * Throws an error if the product doesn't exist.
 */
export async function resolveProductByUuid(
	prisma: PrismaClient,
	uuid: string | null | undefined
): Promise<Product> {
	if (!uuid) {
		throwApiError(apiErrors.productDoesNotExist)
	}

	const product = await prisma.product.findFirst({ where: { uuid } })
	if (!product) {
		throwApiError(apiErrors.productDoesNotExist)
	}
	return product
}

/**
 * Resolves an offer UUID to its database ID.
 * Returns null if no UUID is provided or offer doesn't exist.
 */
export async function resolveOfferByUuid(
	prisma: PrismaClient,
	offerUuid: string | null | undefined
): Promise<bigint | null> {
	if (!offerUuid) return null
	const offer = await prisma.offer.findFirst({ where: { uuid: offerUuid } })
	return offer?.id ?? null
}

/**
 * Resolves an array of variation item UUIDs to their database IDs.
 * Throws an error if any variation item doesn't exist.
 */
export async function resolveVariationItemsByUuids(
	prisma: PrismaClient,
	uuids: string[]
): Promise<bigint[]> {
	const resolvedIds: bigint[] = []
	for (const uuid of uuids) {
		const variationItem = await prisma.variationItem.findFirst({
			where: { uuid }
		})
		if (!variationItem) {
			throwApiError(apiErrors.variationItemDoesNotExist)
		}
		resolvedIds.push(variationItem.id)
	}
	return resolvedIds
}

/**
 * Converts variation input (with UUIDs) to resolved variations (with IDs).
 */
export async function resolveVariationsFromInput(
	prisma: PrismaClient,
	variations: Array<{ variationItemUuids: string[]; count: number }>
): Promise<Array<{ variationItemIds: bigint[]; count: number }>> {
	const resolved = []
	for (const variation of variations) {
		const variationItemIds = await resolveVariationItemsByUuids(
			prisma,
			variation.variationItemUuids
		)
		resolved.push({
			variationItemIds,
			count: variation.count
		})
	}
	return resolved
}
