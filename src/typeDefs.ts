export const typeDefs = `#graphql
	type Query {
		retrieveCompany: Company
		listRooms: RoomList!
		listCategories: CategoryList!
		retrieveTable(uuid: String!): Table
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
		addProductsToOrder(
			uuid: String!
			products: [AddProductsInput!]!
		): Order!
		removeProductsFromOrder(
			uuid: String!
			products: [AddProductsInput!]!
		): Order!
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
		orders(paid: Boolean): OrderList!
	}

	type TableList {
		total: Int!
		items: [Table!]!
	}

	type Category {
		uuid: String!
		name: String!
		type: CategoryType!
		products: ProductList!
	}

	type CategoryList {
		total: Int!
		items: [Category!]!
	}

	type Product {
		uuid: String!
		name: String!
		price: Int!
		variations: VariationList!
	}

	type ProductList {
		total: Int!
		items: [Product!]!
	}

	type Variation {
		uuid: String!
		name: String!
		variationItems: VariationItemList!
	}

	type VariationList {
		total: Int!
		items: [Variation!]!
	}

	type VariationItem {
		uuid: String!
		name: String!
		additionalCost: Int!
	}

	type VariationItemList {
		total: Int!
		items: [VariationItem!]!
	}

	type Order {
		uuid: String!
		totalPrice: Int!
		products: ProductList!
	}

	type OrderList {
		total: Int!
		items: [Order!]!
	}

	enum UserRole {
		ADMIN
		USER
	}

	enum CategoryType {
		FOOD
		DRINK
	}

	input AddProductsInput{
		uuid: String!
		count: Int!
	}
`
