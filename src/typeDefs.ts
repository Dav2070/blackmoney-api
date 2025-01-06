export const typeDefs = `#graphql
	type Query {
		retrieveCompany: Company
		listRooms: RoomList!
		listCategories: CategoryList!
	}

	type Mutation {
		login(
			userName: String!
			password: String!
		): Session!
		createRoom(name: String!): Room!
		createTable(
			roomUuid: String!
			name: String!
		): Table!
		addProducts(
			uuid: String!
			products: [AddProductsInput!]!
		):Order!
	}

	type Company {
		uuid: String!
		name: String!
		users: UserList!
	}

	type User {
		uuid: String!
		name: String!
		role: UserRole!
	}

	type UserList {
		total: Int!
		items: [User!]!
	}

	type Session {
		uuid: String!
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

	type Order {
	uuid:String!
	}

	enum UserRole {
		ADMIN
		USER
	}

	input AddProductsInput{
		uuid: String!
		count: Int!
	}
`
