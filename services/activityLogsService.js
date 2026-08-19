import { rAllActivityLogs } from '../repositories/activityLogsRepository'

export async function sAllActivityLogs(limit) {
  return rAllActivityLogs(limit)
}
