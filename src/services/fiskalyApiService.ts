import axios from "axios"
import { fiskalyApiBaseUrl } from "../constants.js"

let fiskalyAccessToken = null

export async function getAccessToken(): Promise<string | null> {
	if (fiskalyAccessToken) {
		return fiskalyAccessToken
	}

	const authenticationResponse = await authenticate()

	if (authenticationResponse) {
		fiskalyAccessToken = authenticationResponse.access_token
		return fiskalyAccessToken
	}

	return null
}

export async function authenticate(): Promise<{ access_token: string } | null> {
	try {
		const response = await axios({
			method: "post",
			url: `${fiskalyApiBaseUrl}/auth`,
			data: {
				api_key: process.env.FISKALY_API_KEY,
				api_secret: process.env.FISKALY_API_SECRET
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}

export async function createTss(uuid: string): Promise<{
	admin_puk: string
} | null> {
	try {
		const response = await axios({
			method: "put",
			url: `${fiskalyApiBaseUrl}/tss/${uuid}`,
			headers: {
				Authorization: `Bearer ${await getAccessToken()}`,
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}
