export const typeDefs = `#graphql
	type Query {
		listRooms: RoomList!
	}

	type Mutation {
		createRoom(name: String!): Room!
		createTable(
			roomUuid: String!
			name: String!
		): Table!
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
