import * as sessionResolvers from "./resolvers/session.js"
import * as roomResolvers from "./resolvers/room.js"
import * as tableResolvers from "./resolvers/table.js"

export const resolvers = {
	Query: {
		listRooms: roomResolvers.listRooms
	},
	Mutation: {
		createSession: sessionResolvers.createSession,
		createRoom: roomResolvers.createRoom,
		createTable: tableResolvers.createTable
	},
	Room: {
		tables: roomResolvers.tables
	}
}
