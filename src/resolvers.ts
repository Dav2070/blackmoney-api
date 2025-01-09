import * as sessionResolvers from "./resolvers/session.js"
import * as companyResolvers from "./resolvers/company.js"
import * as roomResolvers from "./resolvers/room.js"
import * as tableResolvers from "./resolvers/table.js"
import * as categoryResolvers from "./resolvers/category.js"
import * as orderResolvers from "./resolvers/order.js"

export const resolvers = {
	Query: {
		retrieveCompany: companyResolvers.retrieveCompany,
		listRooms: roomResolvers.listRooms,
		listCategories: categoryResolvers.listCategories
	},
	Mutation: {
		login: sessionResolvers.login,
		createRoom: roomResolvers.createRoom,
		createTable: tableResolvers.createTable,
		addProductsToOrder: orderResolvers.addProductsToOrder
	},
	Company: {
		users: companyResolvers.users
	},
	Room: {
		tables: roomResolvers.tables
	},
	Category: {
		products: categoryResolvers.products
	},
	Order: {
		totalPrice: orderResolvers.totalPrice,
		products: orderResolvers.products
	}
}
