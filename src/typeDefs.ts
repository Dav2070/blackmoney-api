export const typeDefs = `#graphql
	type Query {
		listRooms: RoomList!
	}

	type Mutation {
		createSession(
			username: String!
			password: String!
		): Session!
		createRoom(name: String!): Room!
		createTable(
			roomUuid: String!
			name: String!
		): Table!
	}

	type Session {
		token: String
	}

	type Room {
		uuid: String!
		name: String!
		tables: TableList!
	}

	type RoomList {
		total: Int!
		items: [Room!]!
	}

	type Table {
		uuid: String!
		name: String!
	}

	type TableList {
		total: Int!
		items: [Table!]!
	}
`
