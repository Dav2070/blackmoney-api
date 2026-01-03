import { OrderItemType } from "../../prisma/generated/client.js"

export interface ProductInput {
	id?: bigint
	count: number
	type?: OrderItemType
	discount: number
	diversePrice?: number
	notes: string | null
	takeAway: boolean
	course: number | null
	offerId: bigint | null
	variations: {
		variationItemIds: bigint[]
		count: number
	}[]
	orderItems: {
		productUuid: string
		count: number
		variations?: {
			variationItemUuids: string[]
			count: number
		}[]
	}[]
}

export interface ProductInputArgs {
	uuid?: string
	count: number
	discount?: number
	diversePrice?: number
	type?: OrderItemType
	notes?: string
	takeAway?: boolean
	course?: number
	offerUuid?: string
	variations?: {
		variationItemUuids: string[]
		count: number
	}[]
	orderItems?: {
		productUuid: string
		count: number
		variations?: {
			variationItemUuids: string[]
			count: number
		}[]
	}[]
}
