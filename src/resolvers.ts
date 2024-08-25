import * as roomResolvers from "./resolvers/room.js"
import * as tableResolvers from "./resolvers/table.js"
import * as categoryResolvers from "./resolvers/category.js"

export const resolvers = {
	Query: {
		listRooms: roomResolvers.listRooms,
		listCategories: categoryResolvers.listCategories
	},
	Mutation: {
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
