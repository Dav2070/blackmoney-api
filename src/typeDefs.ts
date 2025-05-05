export const typeDefs = `#graphql
	type Query {
		retrieveUser: User!
		retrieveCompany: Company
		listRooms: RoomList!
		listCategories: CategoryList!
		retrieveTable(uuid: String!): Table
		retrieveOrder(uuid: String!): Order
	}

	type Mutation {
		login(
			userName: String!
			password: String!
		): Session!
		createUser(name: String!): User!
		createCompany(name: String!): Company!
		createRoom(name: String!): Room!
		createTable(
			roomUuid: String!
			name: String!
		): Table!
		updateOrder(
			uuid: String!
			orderItems: [UpdateOrderItemInput!]!
		): Order!
		addProductsToOrder(
			uuid: String!
			products: [AddProductsInput!]!
		): Order!
		removeProductsFromOrder(
			uuid: String!
			products: [AddProductsInput!]!
		): Order!
		updateOrderItem(
			uuid: String!
			count: Int
			orderItemVariations: [UpdateOrderItemVariationInput!]
		): OrderItem!
	}

	type Company {
		uuid: String!
		name: String!
		users: UserList!
		rooms: RoomList!
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
		user: User!
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
		name: Int!
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
		id: Int!
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
		orderItems: OrderItemList!
	}

	type OrderList {
		total: Int!
		items: [Order!]!
	}

	type OrderItem {
		uuid: String!
		count: Int!
		order: Order!
		product: Product!
		orderItemVariations: OrderItemVariationList!
	}

	type OrderItemList {
		total: Int!
		items: [OrderItem!]!
	}

	type OrderItemVariation {
		uuid: String!
		count: Int!
		variationItems: VariationItemList!
	}

	type OrderItemVariationList {
		total: Int!
		items: [OrderItemVariation!]!
	}

	enum UserRole {
		ADMIN
		USER
	}

	enum CategoryType {
		FOOD
		DRINK
	}

	input UpdateOrderItemInput {
		count: Int!
		productId: Int!
	}

	input AddProductsInput {
		uuid: String!
		count: Int!
		variations: [AddProductVariationInput!]
	}

	input AddProductVariationInput {
		variationItemUuids: [String!]!
		count: Int!
	}

	input UpdateOrderItemVariationInput {
		uuid: String!
		count: Int!
	}
`
