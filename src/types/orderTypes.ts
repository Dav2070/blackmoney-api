import { OrderItemType } from "../../prisma/generated/client.js"

export interface AddOrderItemInput {
	uuid?: string
	productUuid?: string
	count: number
	discount?: number
	diversePrice?: number
	type?: OrderItemType
	notes?: string
	takeAway?: boolean
	course?: number
	offerUuid?: string
	variations?: AddOrderItemVariationInput[]
	orderItems?: AddChildOrderItemInput[]
}

export interface AddOrderItemVariationInput {
	uuid?: string
	variationItemUuids: string[]
	count: number
}

export interface AddChildOrderItemInput {
	uuid?: string
	productUuid: string
	count: number
	variations?: AddOrderItemVariationInput[]
}
