import { PrismaClient } from "@prisma/client"

export interface ResolverContext {
	prisma: PrismaClient
	user?: User
}

export interface List<T> {
	total: number
	items: T[]
}

export interface ApiError {
	code: string
	message: string
	status?: number
}

export interface User {
	id: bigint
	name: string
	password: string
}

export interface Session {
	user: User
	token: string
}

export interface Room {
	name: String
}
