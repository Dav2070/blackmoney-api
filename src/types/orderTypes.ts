import { ProductType } from "../../prisma/generated/client.js"

export interface ProductInput {
	id: bigint
	count: number
	type: ProductType
	discount: number
	variations: {
		variationItemIds: bigint[]
		count: number
	}[]
	orderItems: {
		productUuid: string
		count: number
	}[]
}

export interface ProductInputArgs {
	uuid: string
	count: number
	discount?: number
	variations?: {
		variationItemUuids: string[]
		count: number
	}[]
	orderItems?: {
		productUuid: string
		count: number
	}[]
}
