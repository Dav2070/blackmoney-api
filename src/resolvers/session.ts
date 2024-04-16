import * as crypto from "crypto"
import { ResolverContext } from "../types.js"

export async function createSession(
	parent: any,
	args: {
		username: string
		password: string
	},
	context: ResolverContext
) {
	let user = await context.prisma.user.findFirst({
		where: {
			name: args.username,
			password: args.password
		}
	})

	if (user == null) {
		return null
	}

	let session = await context.prisma.session.create({
		data: {
			userId: user.id,
			token: crypto.randomUUID()
		}
	})

	return session
}
