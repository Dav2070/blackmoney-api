export const typeDefs = `#graphql
	type Query {
		retrieveUser: User!
		retrieveCompany: Company
		listRooms: RoomList!
		listCategories: CategoryList!
		retrieveTable(uuid: String!): Table
		retrieveOrder(uuid: String!): Order
		listOrders(completed: Boolean): OrderList!
	}

	type Mutation {
		login(
			restaurantUuid: String!
			userName: String!
			password: String!
		): Session!
		createUser(
			restaurantUuid: String!
			name: String!
		): User!
		createCompany(name: String!): Company!
		createRoom(name: String!): Room!
		createTable(
			roomUuid: String!
			name: String!
		): Table!
		createBill: Bill!
		createOrder(tableUuid: String!): Order!
		updateOrder(
			uuid: String!
			orderItems: [OrderItemInput!]!
		): Order!
		addProductsToOrder(
			uuid: String!
			products: [AddProductsInput!]!
		): Order!
		removeProductsFromOrder(
			uuid: String!
			products: [AddProductsInput!]!
		): Order!
		completeOrder(
			uuid: String!
			billUuid: String!
			paymentMethod: PaymentMethod!
		): Order!
		updateOrderItem(
			uuid: String!
			count: Int
			orderItemVariations: [OrderItemVariationInput!]
		): OrderItem!
	}

	type Company {
		uuid: String!
		name: String!
	}

	type Restaurant {
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
		id: Int!
		uuid: String!
		name: String!
		additionalCost: Int!
	}

	type VariationItemList {
		total: Int!
		items: [VariationItem!]!
	}

	type Bill {
		uuid: String!
	}

	type Order {
		uuid: String!
		totalPrice: Int!
		paidAt: String
		paymentMethod: PaymentMethod
		table: Table!
		bill: Bill
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

	enum PaymentMethod {
		CASH
		CARD
	}

	input OrderItemInput {
		count: Int!
		productId: Int!
		orderItemVariations: [OrderItemVariationInput!]
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

	input OrderItemVariationInput {
		uuid: String
		count: Int!
		variationItems: [VariationItemInput!]
	}

	input VariationItemInput {
		id: Int!
	}
`
