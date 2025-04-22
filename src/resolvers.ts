import * as sessionResolvers from "./resolvers/session.js"
import * as userResolvers from "./resolvers/user.js"
import * as companyResolvers from "./resolvers/company.js"
import * as roomResolvers from "./resolvers/room.js"
import * as tableResolvers from "./resolvers/table.js"
import * as categoryResolvers from "./resolvers/category.js"
import * as productResolvers from "./resolvers/product.js"
import * as variationResolvers from "./resolvers/variation.js"
import * as orderResolvers from "./resolvers/order.js"
import * as orderItemResolvers from "./resolvers/orderItem.js"
import * as orderItemVariationResolvers from "./resolvers/orderItemVariation.js"

export const resolvers = {
	Query: {
		retrieveUser: userResolvers.retrieveUser,
		retrieveCompany: companyResolvers.retrieveCompany,
		listRooms: roomResolvers.listRooms,
		listCategories: categoryResolvers.listCategories,
		retrieveTable: tableResolvers.retrieveTable,
		retrieveOrder: orderResolvers.retrieveOrder
	},
	Mutation: {
		login: sessionResolvers.login,
		createUser: userResolvers.createUser,
		createCompany: companyResolvers.createCompany,
		createRoom: roomResolvers.createRoom,
		createTable: tableResolvers.createTable,
		addProductsToOrder: orderResolvers.addProductsToOrder,
		removeProductsFromOrder: orderResolvers.removeProductsFromOrder,
		updateOrderItem: orderItemResolvers.updateOrderItem
	},
	Session: {
		user: sessionResolvers.user
	},
	Company: {
		users: companyResolvers.users,
		rooms: companyResolvers.rooms
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
		id: productResolvers.id,
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
		product: orderItemResolvers.product,
		orderItemVariations: orderItemResolvers.orderItemVariations
	},
	OrderItemVariation: {
		variationItems: orderItemVariationResolvers.variationItems
	}
}
