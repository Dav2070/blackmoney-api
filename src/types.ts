import { PrismaClient } from "@prisma/client"
import { User } from "dav-js"

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

export interface Room {
	id: bigint
	name: String
}

export interface Table {
	id: bigint
	name: String
}

export interface Product {
	id: bigint
	name: String
}

export interface Category {
	id: bigint
	name: String
}
