export const typeDefs = `#graphql
	type Query {
		retrieveOwnUser: User!
		retrieveUser(uuid: String!): User!
		retrieveCompany: Company
		retrieveRestaurant(uuid: String!): Restaurant
		retrieveRegister(uuid: String!): Register
		retrieveRoom(uuid: String!): Room
		listRooms(restaurantUuid: String!): RoomList!
		listCategories: CategoryList!
		retrieveTable(uuid: String!): Table
		retrieveOrder(uuid: String!): Order
		listOrders(completed: Boolean): OrderList!
	}

	type Mutation {
		login(
			companyUuid: String!
			userName: String!
			password: String!
			registerUuid: String!
			registerClientSerialNumber: String!
		): Session!
		createOwner(
			companyUuid: String!
			name: String!
			password: String!
		): User!
		createUser(
			companyUuid: String!
			name: String!
			role: UserRole
			restaurants: [String!]!
		): User!
		setPasswordForUser(
			uuid: String!
			password: String!
		): User!
		resetPasswordOfUser(uuid: String!): User!
		createCompany(name: String!): Company!
		updateRestaurant(
			uuid: String!
			name: String
			city: String
			country: Country
			line1: String
			line2: String
			postalCode: String
		): Restaurant!
		createRegister(
			restaurantUuid: String!
			name: String!
		): Register!
		createRegisterClient(
			registerUuid: String!
			name: String!
			serialNumber: String!
		): RegisterClient!
		createPrinter(
			restaurantUuid: String!
			name: String!
			ipAddress: String!
		): Printer!
		updatePrinter(
			uuid: String!
			name: String
			ipAddress: String
		): Printer!
		createRoom(
			restaurantUuid: String!
			name: String!
		): Room!
		updateRoom(uuid: String!, name: String): Room!
		deleteRoom(uuid: String!): Room!
		createTable(
			roomUuid: String!
			name: Int!
			seats: Int!
		): Table!
		updateTable(
			uuid: String!
			seats: Int
		): Table!
		deleteTable(
			uuid: String!
		): Table!
		createBill(registerClientUuid: String!): Bill!
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
		restaurants: RestaurantList!
		users: UserList!
	}

	type Restaurant {
		uuid: String!
		name: String!
		city: String
		country: Country
		line1: String
		line2: String
		postalCode: String
		users: UserList!
		rooms: RoomList!
		registers: RegisterList!
		printers: PrinterList!
		menu: Menu
	}

	type RestaurantList {
		total: Int!
		items: [Restaurant!]!
	}

	type Register {
		uuid: String!
		name: String!
		registerClients: RegisterClientList!
	}

	type RegisterList {
		total: Int!
		items: [Register!]!
	}

	type RegisterClient {
		uuid: String!
		name: String
		serialNumber: String!
	}

	type RegisterClientList {
		total: Int!
		items: [RegisterClient!]!
	}

	type Printer {
		uuid: String!
		name: String!
		ipAddress: String!
	}

	type PrinterList {
		total: Int!
		items: [Printer!]!
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
		seats: Int!
		orders(paid: Boolean): OrderList!
	}

	type TableList {
		total: Int!
		items: [Table!]!
	}

	type Menu {
		uuid: String!
		categories: CategoryList!
		offers: OfferList!
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
		category: Category!
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

	type Offer {
		id: Int!
		uuid: String!
		name: String!
		offerType: OfferType!
		discountType: DiscountType
		offerValue: Int!
		startDate: String
		endDate: String
		startTime: String
		endTime: String
		weekdays: [Weekday!]!
		offerItems: OfferItemList!
	}

	type OfferList {
		total: Int!
		items: [Offer!]!
	}

	type OfferItem {
		uuid: String!
		name: String!
		maxSelections: Int!
		products: ProductList!
	}

	type OfferItemList {
		total: Int!
		items: [OfferItem!]!
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
		OWNER
		ADMIN
		USER
	}

	enum CategoryType {
		FOOD
		DRINK
	}

	enum OfferType {
		FIXED_PRICE
		DISCOUNT
	}

	enum DiscountType {
		PERCENTAGE
		AMOUNT
	}

	enum PaymentMethod {
		CASH
		CARD
	}

	enum Country {
		DE
	}

	enum Weekday {
		MONDAY
		TUESDAY
		WEDNESDAY
		THURSDAY
		FRIDAY
		SATURDAY
		SUNDAY
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
