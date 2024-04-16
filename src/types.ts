import { PrismaClient } from "@prisma/client"

export interface ResolverContext {
	prisma: PrismaClient
}

export interface User {
	name: string
	password: string
}

export interface Session {
	user: User
	token: string
}
