import * as sessionResolvers from "./resolvers/session.js"

export const resolvers = {
	Query: {
		hello: () => {
			return "Hello World"
		}
	},
	Mutation: {
		createSession: sessionResolvers.createSession
	}
}
