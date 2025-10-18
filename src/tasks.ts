import nodeCron from "node-cron"
import { DateTime } from "luxon"
import { prisma } from "../server.js"

const timezone = "Etc/UTC"

export async function setupTasks() {
	nodeCron.schedule("0 3 * * 0", deleteSessions, { timezone })
}

async function deleteSessions() {
	// Delete sessions which were not used in the last 30 days
	const minDate = DateTime.now().minus({ days: 30 }).toJSDate()

	const sessions = await prisma.session.findMany({
		where: { lastActive: { lt: minDate } }
	})

	for (const session of sessions) {
		await prisma.session.delete({ where: { id: session.id } })
	}
}
