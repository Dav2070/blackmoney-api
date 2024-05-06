export const typeDefs = `#graphql
	type Query {
		listRooms: RoomList!
	}

	type Mutation {
		createSession(
			username: String!
			password: String!
		): Session
	}

	type Session {
		token: String
	}

	type Room {
		name: String!
		tables: TableList!
	}

	type RoomList {
		total: Int!
		items: [Room!]!
	}

	type Table {
		name: String!
	}

	type TableList {
		total: Int!
		items: [Table!]!
	}
`
