export const typeDefs = `#graphql
	type Query {
		retrieveOwnUser: User!
		retrieveUser(uuid: String!): User!
		retrieveCompany: Company
		retrieveRestaurant(uuid: String!): Restaurant
		retrieveRegister(uuid: String!): Register
		retrieveRegisterClient(uuid: String!): RegisterClient
		retrieveRegisterClientBySerialNumber(
			registerUuid: String!
			serialNumber: String!
		): RegisterClient
		searchPrinters(
			restaurantUuid: String!
			query: String!
			exclude: [String!]
		): PrinterList!
		retrieveRoom(uuid: String!): Room
		listRooms(restaurantUuid: String!): RoomList!
		retrieveCategory(uuid: String!): Category
		searchCategories(
			restaurantUuid: String!
			query: String!
			exclude: [String!]
		): CategoryList!
		listCategories(restaurantUuid: String!): CategoryList!
		searchProducts(
			restaurantUuid: String!
			query: String!
			exclude: [String!]
		): ProductList!
		retrieveTable(uuid: String!): Table
		retrieveOrder(uuid: String!): Order
		listOrders(completed: Boolean): OrderList!
		listReservations(
			restaurantUuid: String!
			date: String!
		): ReservationList!
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
			housenumber: String
			line2: String
			postalCode: String
			owner: String
			taxNumber: String
			mail: String
			phoneNumber: String
		): Restaurant!
		createRegister(
			restaurantUuid: String!
			name: String!
		): Register!
		updateRegisterClient(
			uuid: String!
			name: String
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
		createPrintRule(
			registerClientUuid: String!
			type: PrintRuleType!
			productType: ProductType
			printerUuids: [String!]!
			categoryUuids: [String!]
			productUuids: [String!]
		): PrintRule!
		updatePrintRule(
			uuid: String!
			printerUuids: [String!]!
			categoryUuids: [String!]
			productUuids: [String!]
		): PrintRule!
		deletePrintRule(uuid: String!): PrintRule!
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
		updateCategory(
			uuid: String!
			name: String
		): Category!
		deleteCategory(uuid: String!): Category!
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
		updateReservation(
			uuid: String!
			checkedIn: Boolean
		): Reservation!
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
		owner: String
		taxNumber: String
		mail: String
		phoneNumber: String
		users: UserList!
		rooms: RoomList!
		registers: RegisterList!
		printers: PrinterList!
		menu: Menu
		address: Address
	}

	type RestaurantList {
		total: Int!
		items: [Restaurant!]!
	}

	type Address {
		uuid: String!
		city: String
		country: Country
		addressLine1: String
		addressLine2: String
		housenumber: String
		postalCode: String
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
		printRules: PrintRuleList!
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

	type PrintRule {
		uuid: String!
		type: PrintRuleType!
		productType: ProductType
		printers: PrinterList!
		categories: CategoryList!
		products: ProductList!
	}

	type PrintRuleList {
		total: Int!
		items: [PrintRule!]!
	}

	type User {
		uuid: String!
		name: String!
		role: UserRole!
		company: Company!
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
		variations: VariationList!
		offers: OfferList!
	}

	type Category {
		uuid: String!
		name: String!
		products(type: ProductType): ProductList!
	}

	type CategoryList {
		total: Int!
		items: [Category!]!
	}

	type Product {
		uuid: String!
		type: ProductType!
		name: String!
		price: Int!
		shortcut: Int!
		category: Category!
		offer: Offer
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
		type: OrderItemType!
		discount: Int
		diversePrice: Int
		notes: String
		takeAway: Boolean!
		course: Int
		order: Order!
		product: Product
		orderItems: OrderItemList!
		offer: Offer
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

	type Reservation {
		uuid: String!
		table: Table!
		name: String!
		phoneNumber: String
		email: String
		numberOfPeople: Int!
		date: String!
		checkedIn: Boolean!
	}

	type ReservationList {
		total: Int!
		items: [Reservation!]!
	}

	enum UserRole {
		OWNER
		ADMIN
		USER
	}

	enum ProductType {
		FOOD
		DRINK
		SPECIAL
		MENU
	}

	enum PrintRuleType {
		BILLS
		PRODUCT_TYPE
		CATEGORIES
		PRODUCTS
	}

	enum OrderItemType {
		PRODUCT
		MENU
		SPECIAL
		DIVERSE_FOOD
		DIVERSE_DRINK
		DIVERSE_OTHER
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

	enum OrderItemType {
		PRODUCT
		MENU
		SPECIAL
		DIVERSE_FOOD
		DIVERSE_DRINK
		DIVERSE_OTHER
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
		uuid: String
		count: Int!
		discount: Int
		diversePrice: Int
		type: OrderItemType
		notes: String
		takeAway: Boolean
		course: Int
		offerUuid: String
		variations: [AddProductVariationInput!]
		orderItems: [AddProductOrderItemInput!]
	}

	input AddProductVariationInput {
		variationItemUuids: [String!]!
		count: Int!
	}

	input AddProductOrderItemInput {
		productUuid: String!
		count: Int!
		variations: [AddProductVariationInput!]
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
