import { apiErrors } from "../errors.js"
import {
	ResolverContext,
	List,
	OpeningTime,
	SpecialOpeningTime,
	Weekday
} from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"

export async function listOpeningTimes(
	parent: any,
	args: {
		restaurantUuid: string
	},
	context: ResolverContext
): Promise<List<OpeningTime>> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findFirst({
		where: { uuid: args.restaurantUuid }
	})

	// Check if the restaurant exists
	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Get the opening times of the restaurant
	const where = {
		restaurantId: restaurant.id
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.openingTime.count({ where }),
		context.prisma.openingTime.findMany({
			where,
			orderBy: { weekday: "asc" }
		})
	])

	return {
		total,
		items
	}
}

export async function updateOpeningTimes(
	parent: any,
	args: {
		restaurantUuid: string
		openingTimes: {
			weekday: Weekday
			durchgehend: boolean
			pause: boolean
			startTime1: string
			endTime1: string
			startTime2?: string
			endTime2?: string
		}[]
	},
	context: ResolverContext
): Promise<List<OpeningTime>> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findFirst({
		where: { uuid: args.restaurantUuid }
	})

	// Check if the restaurant exists
	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if the restaurant belongs to the same company as the user
	if (context.user.companyId !== restaurant.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Check if the user is an owner or an admin
	if (context.user.role !== "OWNER" && context.user.role !== "ADMIN") {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// First, delete all existing opening times for this restaurant
	// This ensures that closed days (not in the array) are removed
	await context.prisma.openingTime.deleteMany({
		where: { restaurantId: restaurant.id }
	})

	// Update or create opening times for each weekday
	const updatedOpeningTimes: OpeningTime[] = []

	for (const openingTimeData of args.openingTimes) {
		// Create new opening time
		const newOpeningTime = await context.prisma.openingTime.create({
			data: {
				restaurantId: restaurant.id,
				weekday: openingTimeData.weekday,
				durchgehend: openingTimeData.durchgehend,
				pause: openingTimeData.pause,
				startTime1: openingTimeData.startTime1,
				endTime1: openingTimeData.endTime1,
				startTime2: openingTimeData.startTime2,
				endTime2: openingTimeData.endTime2
			}
		})
		updatedOpeningTimes.push(newOpeningTime)
	}

	return {
		total: updatedOpeningTimes.length,
		items: updatedOpeningTimes
	}
}

export async function listSpecialOpeningTimes(
	parent: any,
	args: {
		restaurantUuid: string
	},
	context: ResolverContext
): Promise<List<SpecialOpeningTime>> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findFirst({
		where: { uuid: args.restaurantUuid }
	})

	// Check if the restaurant exists
	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Get the special opening times of the restaurant
	const where = {
		restaurantId: restaurant.id
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.specialOpeningTime.count({ where }),
		context.prisma.specialOpeningTime.findMany({
			where,
			orderBy: { from: "asc" }
		})
	])

	return {
		total,
		items
	}
}

export async function createSpecialOpeningTime(
	parent: any,
	args: {
		restaurantUuid: string
		reason: string
		from: string
		to: string
		durchgehend: boolean
		pause?: boolean
		geschlossen?: boolean
		startTime1?: string
		endTime1?: string
		startTime2?: string
		endTime2?: string
	},
	context: ResolverContext
): Promise<SpecialOpeningTime> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the restaurant
	const restaurant = await context.prisma.restaurant.findFirst({
		where: { uuid: args.restaurantUuid }
	})

	// Check if the restaurant exists
	if (restaurant == null) {
		throwApiError(apiErrors.restaurantDoesNotExist)
	}

	// Check if the restaurant belongs to the same company as the user
	if (context.user.companyId !== restaurant.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Check if the user is an owner or an admin
	if (context.user.role !== "OWNER" && context.user.role !== "ADMIN") {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Create the special opening time
	return await context.prisma.specialOpeningTime.create({
		data: {
			restaurantId: restaurant.id,
			reason: args.reason,
			from: args.from,
			to: args.to,
			durchgehend: args.durchgehend,
			pause: args.pause ?? false,
			geschlossen: args.geschlossen ?? false,
			startTime1: args.startTime1,
			endTime1: args.endTime1,
			startTime2: args.startTime2,
			endTime2: args.endTime2
		}
	})
}

export async function updateSpecialOpeningTime(
	parent: any,
	args: {
		uuid: string
		reason?: string
		from?: string
		to?: string
		durchgehend?: boolean
		pause?: boolean
		geschlossen?: boolean
		startTime1?: string
		endTime1?: string
		startTime2?: string
		endTime2?: string
	},
	context: ResolverContext
): Promise<SpecialOpeningTime> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the special opening time
	const specialOpeningTime =
		await context.prisma.specialOpeningTime.findFirst({
			where: { uuid: args.uuid },
			include: { restaurant: true }
		})

	if (specialOpeningTime == null) {
		throwApiError(apiErrors.specialOpeningTimeDoesNotExist)
	}

	// Check if the special opening time belongs to the same company as the user
	if (context.user.companyId !== specialOpeningTime.restaurant.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Check if the user is an owner or an admin
	if (context.user.role !== "OWNER" && context.user.role !== "ADMIN") {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Prepare the update data
	const data: any = {}
	if (args.reason != null) data.reason = args.reason
	if (args.from != null) data.from = args.from
	if (args.to != null) data.to = args.to
	if (args.durchgehend != null) data.durchgehend = args.durchgehend
	if (args.pause != null) data.pause = args.pause
	if (args.geschlossen != null) data.geschlossen = args.geschlossen
	if (args.startTime1 != null) data.startTime1 = args.startTime1
	if (args.endTime1 != null) data.endTime1 = args.endTime1
	if (args.startTime2 !== undefined) data.startTime2 = args.startTime2
	if (args.endTime2 !== undefined) data.endTime2 = args.endTime2

	// Update the special opening time
	return await context.prisma.specialOpeningTime.update({
		where: { id: specialOpeningTime.id },
		data
	})
}

export async function deleteSpecialOpeningTime(
	parent: any,
	args: {
		uuid: string
	},
	context: ResolverContext
): Promise<SpecialOpeningTime> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the special opening time
	const specialOpeningTime =
		await context.prisma.specialOpeningTime.findFirst({
			where: { uuid: args.uuid },
			include: { restaurant: true }
		})

	if (specialOpeningTime == null) {
		throwApiError(apiErrors.specialOpeningTimeDoesNotExist)
	}

	// Check if the special opening time belongs to the same company as the user
	if (context.user.companyId !== specialOpeningTime.restaurant.companyId) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Check if the user is an owner or an admin
	if (context.user.role !== "OWNER" && context.user.role !== "ADMIN") {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Delete the special opening time
	return await context.prisma.specialOpeningTime.delete({
		where: { id: specialOpeningTime.id }
	})
}
