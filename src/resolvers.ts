import * as roomResolvers from "./resolvers/room.js"
import * as tableResolvers from "./resolvers/table.js"

export const resolvers = {
	Query: {
		listRooms: roomResolvers.listRooms
	},
	Mutation: {
		createRoom: roomResolvers.createRoom,
		createTable: tableResolvers.createTable
	},
	Room: {
		tables: roomResolvers.tables
	}
}
