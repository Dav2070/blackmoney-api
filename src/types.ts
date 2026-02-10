import { PrismaClient, User } from "../prisma/generated/client.js"
import Stripe from "stripe"
import { User as DavUser } from "dav-js"

export type PaymentMethod = "CASH" | "CARD"
export type Country = "DE"

export interface ResolverContext {
	prisma: PrismaClient
	stripe: Stripe
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

export interface OpeningTime {
	id: bigint
	uuid: string
	weekday: Weekday
	durchgehend: boolean
	pause: boolean
	startTime1: string
	endTime1: string
	startTime2?: string
	endTime2?: string
}

export interface SpecialOpeningTime {
	id: bigint
	uuid: string
	reason: string
	from: string
	to: string
	durchgehend: boolean
	pause: boolean
	geschlossen: boolean
	startTime1?: string
	endTime1?: string
	startTime2?: string
	endTime2?: string
}

export type Weekday =
	| "MONDAY"
	| "TUESDAY"
	| "WEDNESDAY"
	| "THURSDAY"
	| "FRIDAY"
	| "SATURDAY"
	| "SUNDAY"

export type RegisterStatus = "ACTIVE" | "INACTIVE"
export type StripeOnboardingStatus = "PENDING" | "COMPLETED"
export type StripeSubscriptionStatus = "NOT_SUBSCRIBED" | "ACTIVE" | "INACTIVE"

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
