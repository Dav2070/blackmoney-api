import * as sessionResolvers from "./resolvers/session.js"
import * as companyResolvers from "./resolvers/company.js"
import * as roomResolvers from "./resolvers/room.js"
import * as tableResolvers from "./resolvers/table.js"
import * as categoryResolvers from "./resolvers/category.js"

export const resolvers = {
	Query: {
		retrieveCompany: companyResolvers.retrieveCompany,
		listRooms: roomResolvers.listRooms,
		listCategories: categoryResolvers.listCategories
	},
	Mutation: {
		login: sessionResolvers.login,
		createRoom: roomResolvers.createRoom,
		createTable: tableResolvers.createTable
	},
	Room: {
		tables: roomResolvers.tables
	},
	Category: {
		products: categoryResolvers.products
	}
}
