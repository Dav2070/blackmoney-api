export const typeDefs = `#graphql
	type Query {
		hello: String
	}

	type Mutation {
		createSession(
			username: String!
			password: String!
		): Session
	}

	type Session {
		token: String
	}
`
