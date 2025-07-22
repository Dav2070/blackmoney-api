import { PrismaClient, User } from "@prisma/client"
import { User as DavUser } from "dav-js"

export type PaymentMethod = "CASH" | "CARD"
export type Country = "GERMANY"

export interface ResolverContext {
	prisma: PrismaClient
	davUser?: DavUser
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
	name: string
}

export interface Table {
	id: bigint
	name: number
}

export interface Category {
	id: bigint
	name: string
}

//#region Fiskaly types
export type TssState = "CREATED" | "UNINITIALIZED" | "INITIALIZED"

export interface Tss {
	admin_puk?: string
	state: TssState
}

export interface Transaction {
	schema: {
		raw: {
			process_type: string
			process_data: string
		}
	}
}
//#endregion
