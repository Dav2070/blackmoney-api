import { apiErrors } from "../errors.js"
import { ResolverContext, Table } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { validateNameLength } from "../services/validationService.js"

export async function createTable(
	parent: any,
	args: {
		roomUuid: string
		name: string
	},
	context: ResolverContext
): Promise<Table> {
	// Check if the user is logged in
	if (context.user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the room
	let room = await context.prisma.room.findFirst({
		where: { uuid: args.roomUuid }
	})

	if (room == null) {
		throwApiError(apiErrors.roomDoesNotExist)
	}

	// Check if the room belongs to the user
	if (room.userId != context.user.id) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the name
	throwValidationError(validateNameLength(args.name))

	// Create the table
	return await context.prisma.table.create({
		data: {
			name: args.name,
			roomId: room.id
		}
	})
}
