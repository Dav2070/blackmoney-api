import axios from "axios"
import { fiskalyApiBaseUrl } from "../constants.js"
import { Transaction, Tss, TssState } from "../types.js"

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

export async function authenticateAdmin(
	tssUuid: string,
	adminPin: string
): Promise<boolean> {
	try {
		await axios({
			method: "post",
			url: `${fiskalyApiBaseUrl}/tss/${tssUuid}/admin/auth`,
			headers: {
				Authorization: `Bearer ${await getAccessToken()}`
			},
			data: {
				admin_pin: adminPin
			}
		})

		return true
	} catch (error) {
		console.error(error)
		return false
	}
}

export async function logoutAdmin(tssUuid: string): Promise<boolean> {
	try {
		await axios({
			method: "post",
			url: `${fiskalyApiBaseUrl}/tss/${tssUuid}/admin/logout`,
			headers: {
				Authorization: `Bearer ${await getAccessToken()}`
			},
			data: {}
		})

		return true
	} catch (error) {
		console.error(error)
		return false
	}
}

export async function createTss(uuid: string): Promise<Tss | null> {
	try {
		const response = await axios({
			method: "put",
			url: `${fiskalyApiBaseUrl}/tss/${uuid}`,
			headers: {
				Authorization: `Bearer ${await getAccessToken()}`
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}

export async function retrieveTss(uuid: string): Promise<Tss | null> {
	try {
		const response = await axios({
			method: "get",
			url: `${fiskalyApiBaseUrl}/tss/${uuid}`,
			headers: {
				Authorization: `Bearer ${await getAccessToken()}`
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}

export async function updateTss(
	uuid: string,
	state: TssState
): Promise<Tss | null> {
	try {
		const response = await axios({
			method: "patch",
			url: `${fiskalyApiBaseUrl}/tss/${uuid}`,
			headers: {
				Authorization: `Bearer ${await getAccessToken()}`
			},
			data: {
				state
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}

export async function setTssAdminPin(
	uuid: string,
	adminPuk: string,
	newAdminPin: string
): Promise<boolean> {
	try {
		await axios({
			method: "patch",
			url: `${fiskalyApiBaseUrl}/tss/${uuid}/admin`,
			headers: {
				Authorization: `Bearer ${await getAccessToken()}`
			},
			data: {
				admin_puk: adminPuk,
				new_admin_pin: newAdminPin
			}
		})

		return true
	} catch (error) {
		console.error(error)
		return false
	}
}

export async function createClient(
	tssUuid: string,
	clientUuid: string,
	serialNumber: string
): Promise<{ state: string } | null> {
	try {
		const response = await axios({
			method: "put",
			url: `${fiskalyApiBaseUrl}/tss/${tssUuid}/client/${clientUuid}`,
			headers: {
				Authorization: `Bearer ${await getAccessToken()}`
			},
			data: {
				serial_number: serialNumber
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}

export async function startTransaction(
	tssUuid: string,
	clientUuid: string,
	transactionUuid: string,
	lineItems: {
		quantity: number
		text: string
		pricePerUnit: number
	}[]
): Promise<Transaction | null> {
	try {
		const response = await axios({
			method: "put",
			url: `${fiskalyApiBaseUrl}/tss/${tssUuid}/tx/${transactionUuid}`,
			params: {
				tx_revision: 1
			},
			headers: {
				Authorization: `Bearer ${await getAccessToken()}`
			},
			data: {
				state: "ACTIVE",
				client_id: clientUuid,
				schema: {
					standard_v1: {
						order: {
							line_items: lineItems.map(item => ({
								quantity: item.quantity.toString(),
								text: item.text,
								price_per_unit: (item.pricePerUnit / 100)
									.toFixed(2)
									.toString()
							}))
						}
					}
				}
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}

export async function finishTransaction(
	tssUuid: string,
	clientUuid: string,
	transactionUuid: string,
	processType: string,
	processData: string
): Promise<Transaction | null> {
	try {
		const response = await axios({
			method: "put",
			url: `${fiskalyApiBaseUrl}/tss/${tssUuid}/tx/${transactionUuid}`,
			params: {
				tx_revision: 2
			},
			headers: {
				Authorization: `Bearer ${await getAccessToken()}`
			},
			data: {
				state: "FINISHED",
				client_id: clientUuid,
				schema: {
					raw: {
						process_type: processType,
						process_data: processData
					}
				}
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}
