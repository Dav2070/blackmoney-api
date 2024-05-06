import * as roomResolvers from "./resolvers/room.js"
import * as sessionResolvers from "./resolvers/session.js"

export const resolvers = {
	Query: {
		listRooms: roomResolvers.listRooms
	},
	Mutation: {
		createSession: sessionResolvers.createSession
	},
	Room: {
		tables: roomResolvers.tables
	}
}
