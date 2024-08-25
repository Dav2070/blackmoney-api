export const typeDefs = `#graphql
	type Query {
		listRooms: RoomList!
		listCategories: CategoryList!
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

	type Product {
		uuid: String!
		name: String!
		price: Int!
	}

	type ProductList {
		total: Int!
		items: [Product!]!
	}
	
	type Category {
		uuid: String!
		name: String!
		products: ProductList!
	}

	type CategoryList {
		total: Int!
		items: [Category!]!
	}
`
