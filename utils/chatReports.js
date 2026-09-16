export const chatReportCategories = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'harassment', label: 'Harassment or abusive language' },
  { value: 'fraud', label: 'Scam or suspicious payment request' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other', label: 'Other concern' },
]

export function validateChatReport(body) {
  const category = body?.category
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!chatReportCategories.some(item => item.value === category)) return { error: 'Choose a report category.' }
  if (reason.length < 10 || reason.length > 2000) return { error: 'Please describe the issue using 10 to 2000 characters.' }
  return { category, reason }
}

export function validateReportReview(body) {
  const status = body?.status
  const resolution_note = typeof body?.resolution_note === 'string' ? body.resolution_note.trim() : ''
  if (!['reviewed', 'dismissed'].includes(status)) return { error: 'Choose a valid review decision.' }
  if (resolution_note.length < 10 || resolution_note.length > 2000) return { error: 'Explain the decision using 10 to 2000 characters.' }
  return { status, resolution_note }
}
