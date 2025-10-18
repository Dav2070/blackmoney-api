import { ApolloServer } from "@apollo/server"
import { expressMiddleware } from "@apollo/server/express4"
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer"
import { makeExecutableSchema } from "@graphql-tools/schema"
import express from "express"
import http from "http"
import cors from "cors"
import { PrismaClient, User } from "@prisma/client"
import {
	Dav,
	Environment,
	User as DavUser,
	UsersController,
	convertUserResourceToUser
} from "dav-js"
import { typeDefs } from "./src/typeDefs.js"
import { resolvers } from "./src/resolvers.js"
import { setupTasks } from "./src/tasks.js"
import "dotenv/config"

const port = process.env.PORT || 2000
const app = express()
const httpServer = http.createServer(app)

let schema = makeExecutableSchema({
	typeDefs,
	resolvers
})

export const prisma = new PrismaClient()

// Init dav
let environment = Environment.Staging

switch (process.env.ENVIRONMENT) {
	case "production":
		environment = Environment.Production
		break
	case "development":
		environment = Environment.Development
		break
}

new Dav({
	environment,
	server: true
})

const server = new ApolloServer({
	schema,
	plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
	introspection: environment != Environment.Production
})

await server.start()

if (process.env.ENV == "production") {
	// Setup cron jobs
	setupTasks()
}

app.use(
	"/",
	cors<cors.CorsRequest>(),
	express.json({ type: "application/json", limit: "50mb" }),
	expressMiddleware(server, {
		context: async ({ req }) => {
			const accessToken = req.headers.authorization
			let davUser: DavUser = null
			let user: User = null

			if (accessToken != null) {
				let session = await prisma.session.findFirst({
					where: {
						uuid: accessToken
					},
					include: { user: true }
				})

				if (session != null) {
					user = session?.user

					await prisma.session.update({
						where: { uuid: accessToken },
						data: { lastActive: new Date() }
					})
				}

				if (user == null) {
					let userResponse = await UsersController.retrieveUser(
						`
							id
							email
							firstName
						`,
						{
							accessToken
						}
					)

					if (!Array.isArray(userResponse)) {
						davUser = convertUserResourceToUser(userResponse)
					}
				}
			}

			return {
				prisma,
				davUser,
				user
			}
		}
	})
)

await new Promise<void>(resolve => httpServer.listen({ port }, resolve))
console.log(`🚀 Server ready at http://localhost:${port}/`)
