import { ApolloServer } from "@apollo/server"
import { expressMiddleware } from "@apollo/server/express4"
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer"
import { makeExecutableSchema } from "@graphql-tools/schema"
import express from "express"
import http from "http"
import cors from "cors"
import { PrismaClient } from "@prisma/client"
import {
	Dav,
	Environment,
	ApiResponse,
	isSuccessStatusCode,
	User,
	UsersController
} from "dav-js"
import { typeDefs } from "./src/typeDefs.js"
import { resolvers } from "./src/resolvers.js"
import "dotenv/config"

const port = process.env.PORT || 2000
const app = express()
const httpServer = http.createServer(app)

let schema = makeExecutableSchema({
	typeDefs,
	resolvers
})

export const prisma = new PrismaClient()

const server = new ApolloServer({
	schema,
	plugins: [ApolloServerPluginDrainHttpServer({ httpServer })]
})

await server.start()

// Init dav
let environment = Environment.Staging

if (process.env.ENVIRONMENT == "production") {
	environment = Environment.Production
}

new Dav({
	environment,
	server: true
})

app.use(
	"/",
	cors<cors.CorsRequest>(),
	express.json({ type: "application/json", limit: "50mb" }),
	expressMiddleware(server, {
		context: async ({ req }) => {
			const accessToken = req.headers.authorization
			let user: User = null

			if (accessToken != null) {
				let userResponse = await UsersController.GetUser({ accessToken })

				if (isSuccessStatusCode(userResponse.status)) {
					user = (userResponse as ApiResponse<User>).data
				}
			}

			return {
				prisma,
				user
			}
		}
	})
)

await new Promise<void>(resolve => httpServer.listen({ port }, resolve))
console.log(`🚀 Server ready at http://localhost:${port}/`)
