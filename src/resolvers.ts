import * as sessionResolvers from "./resolvers/session.js"
import * as userResolvers from "./resolvers/user.js"
import * as companyResolvers from "./resolvers/company.js"
import * as restaurantResolvers from "./resolvers/restaurant.js"
import * as registerResolvers from "./resolvers/register.js"
import * as registerClientResolvers from "./resolvers/registerClient.js"
import * as printerResolvers from "./resolvers/printer.js"
import * as roomResolvers from "./resolvers/room.js"
import * as tableResolvers from "./resolvers/table.js"
import * as categoryResolvers from "./resolvers/category.js"
import * as productResolvers from "./resolvers/product.js"
import * as variationResolvers from "./resolvers/variation.js"
import * as billResolvers from "./resolvers/bill.js"
import * as orderResolvers from "./resolvers/order.js"
import * as orderItemResolvers from "./resolvers/orderItem.js"
import * as orderItemVariationResolvers from "./resolvers/orderItemVariation.js"
import * as variationItemResolvers from "./resolvers/variationItem.js"

export const resolvers = {
	Query: {
		retrieveOwnUser: userResolvers.retrieveOwnUser,
		retrieveUser: userResolvers.retrieveUser,
		retrieveCompany: companyResolvers.retrieveCompany,
		retrieveRestaurant: restaurantResolvers.retrieveRestaurant,
		listRooms: roomResolvers.listRooms,
		listCategories: categoryResolvers.listCategories,
		retrieveTable: tableResolvers.retrieveTable,
		retrieveOrder: orderResolvers.retrieveOrder,
		listOrders: orderResolvers.listOrders
	},
	Mutation: {
		login: sessionResolvers.login,
		createOwner: userResolvers.createOwner,
		createUser: userResolvers.createUser,
		setPasswordForUser: userResolvers.setPasswordForUser,
		createCompany: companyResolvers.createCompany,
		updateRestaurant: restaurantResolvers.updateRestaurant,
		createRegister: registerResolvers.createRegister,
		createRegisterClient: registerClientResolvers.createRegisterClient,
		createPrinter: printerResolvers.createPrinter,
		updatePrinter: printerResolvers.updatePrinter,
		createRoom: roomResolvers.createRoom,
		createTable: tableResolvers.createTable,
		createBill: billResolvers.createBill,
		createOrder: orderResolvers.createOrder,
		updateOrder: orderResolvers.updateOrder,
		addProductsToOrder: orderResolvers.addProductsToOrder,
		removeProductsFromOrder: orderResolvers.removeProductsFromOrder,
		completeOrder: orderResolvers.completeOrder,
		updateOrderItem: orderItemResolvers.updateOrderItem
	},
	Session: {
		user: sessionResolvers.user
	},
	Company: {
		restaurants: companyResolvers.restaurants,
		users: companyResolvers.users
	},
	Restaurant: {
		users: restaurantResolvers.users,
		rooms: restaurantResolvers.rooms,
		printers: restaurantResolvers.printers
	},
	Room: {
		tables: roomResolvers.tables
	},
	Table: {
		orders: tableResolvers.orders
	},
	Category: {
		products: categoryResolvers.products
	},
	Product: {
		id: productResolvers.id,
		variations: productResolvers.variations
	},
	Variation: {
		variationItems: variationResolvers.variationItems
	},
	Order: {
		totalPrice: orderResolvers.totalPrice,
		paidAt: orderResolvers.paidAt,
		table: orderResolvers.table,
		bill: orderResolvers.bill,
		orderItems: orderResolvers.orderItems
	},
	OrderItem: {
		order: orderItemResolvers.order,
		product: orderItemResolvers.product,
		orderItemVariations: orderItemResolvers.orderItemVariations
	},
	OrderItemVariation: {
		variationItems: orderItemVariationResolvers.variationItems
	},
	VariationItem: {
		id: variationItemResolvers.id
	}
}
