import * as sessionResolvers from "./resolvers/session.js"
import * as companyResolvers from "./resolvers/company.js"
import * as roomResolvers from "./resolvers/room.js"
import * as tableResolvers from "./resolvers/table.js"
import * as categoryResolvers from "./resolvers/category.js"
import * as productResolvers from "./resolvers/product.js"
import * as variationResolvers from "./resolvers/variation.js"
import * as orderResolvers from "./resolvers/order.js"
import * as orderItemResolvers from "./resolvers/orderItem.js"

export const resolvers = {
	Query: {
		retrieveCompany: companyResolvers.retrieveCompany,
		listRooms: roomResolvers.listRooms,
		listCategories: categoryResolvers.listCategories,
		retrieveTable: tableResolvers.retrieveTable,
		retrieveOrder: orderResolvers.retrieveOrder
	},
	Mutation: {
		login: sessionResolvers.login,
		createRoom: roomResolvers.createRoom,
		createTable: tableResolvers.createTable,
		addProductsToOrder: orderResolvers.addProductsToOrder,
		removeProductsFromOrder: orderResolvers.removeProductsFromOrder
	},
	Company: {
		users: companyResolvers.users
	},
	Room: {
		tables: roomResolvers.tables
	},
	Table: {
		orders: tableResolvers.orders
	},
	Category: {
		products: categoryResolvers.products
	},
	Product: {
		variations: productResolvers.variations
	},
	Variation: {
		variationItems: variationResolvers.variationItems
	},
	Order: {
		totalPrice: orderResolvers.totalPrice,
		orderItems: orderResolvers.orderItems
	},
	OrderItem: {
		order: orderItemResolvers.order,
		product: orderItemResolvers.product
	}
}
