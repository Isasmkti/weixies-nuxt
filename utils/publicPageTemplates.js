export const PUBLIC_PAGE_TYPES = [
  { value: 'general', label: 'General page', path: '/help/page-name' },
  { value: 'about', label: 'About', path: '/about' },
  { value: 'contact', label: 'Contact', path: '/contact' },
  { value: 'help', label: 'Help or documentation', path: '/help' },
  { value: 'legal_terms', label: 'Terms & Conditions', path: '/legal/terms' },
  { value: 'legal_privacy', label: 'Privacy Policy', path: '/legal/privacy-policy' },
  { value: 'legal_refund', label: 'Refund Policy', path: '/legal/refund-policy' },
  { value: 'legal_license', label: 'Product License', path: '/legal/license' },
]

export const CONTACT_DETAIL_TYPES = [
  { value: 'business', label: 'Business or legal name' },
  { value: 'registration', label: 'Registration information' },
  { value: 'email', label: 'Email address' },
  { value: 'phone', label: 'Phone or WhatsApp' },
  { value: 'address', label: 'Business address' },
  { value: 'hours', label: 'Service hours' },
  { value: 'url', label: 'External URL' },
  { value: 'text', label: 'Other information' },
]

const templates = {
  general: [
    ['Overview', 'Explain what this page covers and who it is for.'],
    ['Details', 'Provide the complete, approved information visitors need.'],
    ['Contact', 'Explain where visitors can ask questions about this page.'],
  ],
  about: [
    ['About Weixies', 'Enter the verified company or platform background.'],
    ['Mission', 'Enter the platform mission and the audience it serves.'],
    ['How the marketplace works', 'Explain the verified role of buyers, sellers, and the platform.'],
    ['Trust and safety', 'Describe the actual moderation, payment, and support controls in use.'],
  ],
  contact: [
    ['How to contact us', 'Explain which channel visitors should use for each type of request.'],
    ['Support availability', 'Enter service hours, timezone, and expected response time.'],
    ['Before contacting support', 'List the information a buyer or seller should prepare.'],
  ],
  help: [
    ['Getting started', 'Explain account creation and the first steps for a new user.'],
    ['Purchasing and downloads', 'Explain the actual purchase, payment, and download flow.'],
    ['Licenses', 'Explain where buyers can find the license attached to a product.'],
    ['Refunds', 'Explain where and how an eligible refund request is submitted.'],
    ['Seller help', 'Explain seller application, product review, sales, and payout support.'],
  ],
  legal_terms: [
    ['Acceptance and eligibility', 'Define acceptance of the terms, age, territory, and eligibility requirements.'],
    ['Accounts and security', 'Define account ownership, accurate information, and security responsibilities.'],
    ['Marketplace transactions', 'Describe the actual buyer, seller, platform, payment, and delivery relationship.'],
    ['Seller obligations', 'Define listing accuracy, product quality, rights ownership, updates, and support duties.'],
    ['Buyer obligations', 'Define permitted purchasing behavior, payment, licenses, reviews, and account use.'],
    ['Prohibited conduct', 'List prohibited products, misuse, fraud, scraping, abuse, and circumvention.'],
    ['Intellectual property', 'Explain platform marks, seller content, buyer licenses, and infringement reporting.'],
    ['Suspension and termination', 'Explain when access, listings, or accounts may be restricted or terminated.'],
    ['Disclaimers and liability', 'Insert limitations reviewed for the laws and jurisdictions that apply to you.'],
    ['Changes, governing law, and contact', 'State amendment notice, governing law, dispute route, and legal contact.'],
  ],
  legal_privacy: [
    ['Data we collect', 'List actual account, transaction, device, communication, seller, and support data collected.'],
    ['How data is used', 'List each actual purpose, such as service delivery, security, support, analytics, and compliance.'],
    ['Legal basis and consent', 'State the applicable legal bases and when consent is requested.'],
    ['Sharing and service providers', 'List categories of processors and recipients actually used by the platform.'],
    ['Cookies and analytics', 'Describe actual cookies, local storage, analytics, and user controls.'],
    ['Retention and deletion', 'State verified retention periods or the criteria used to determine them.'],
    ['Security', 'Describe real organizational and technical safeguards without making unsupported guarantees.'],
    ['User rights', 'Explain access, correction, deletion, objection, withdrawal, and complaint procedures.'],
    ['International transfers', 'Explain whether data crosses borders and which safeguards apply.'],
    ['Children, policy changes, and contact', 'State age rules, change notices, and the privacy contact channel.'],
  ],
  legal_refund: [
    ['Refund eligibility', 'Define the verified conditions and time window for an eligible digital-product refund.'],
    ['Non-refundable situations', 'List cases that are not eligible, subject to applicable consumer law.'],
    ['How to request a refund', 'Describe the actual order-detail flow and information or evidence required.'],
    ['Review process', 'Explain who reviews requests, what is checked, and how status updates are delivered.'],
    ['Refund method and timing', 'State the actual payment route, processing dependency, currency, and timing.'],
    ['Product access after refund', 'Explain what happens to downloads, licenses, updates, and repurchase eligibility.'],
    ['Seller impact and disputes', 'Explain the actual balance adjustment and escalation process.'],
    ['Contact', 'Provide the approved refund-support contact details.'],
  ],
  legal_license: [
    ['License grant', 'Define the rights granted after a valid purchase and whether the license is personal or commercial.'],
    ['Permitted uses', 'List allowed projects, users, seats, installations, or end products.'],
    ['Prohibited uses', 'List redistribution, resale, sharing, sublicensing, extraction, and other restrictions.'],
    ['Ownership', 'Clarify that purchase grants a license and does not transfer underlying ownership.'],
    ['Product-specific terms', 'Explain how product-specific license terms override or supplement this page.'],
    ['Updates and support', 'Describe access to versions, updates, support, and any limits that actually apply.'],
    ['Termination', 'Explain when a license ends and what the user must do after termination or refund.'],
    ['Questions and permissions', 'Provide a contact route for uses not covered by the standard license.'],
  ],
}

export function getPublicPageTemplate(type) {
  return (templates[type] || templates.general).map(([heading, guidance]) => ({ heading, body: '', guidance }))
}

export function guidanceForSection(type, heading) {
  return (templates[type] || []).find(([candidate]) => candidate === heading)?.[1] || ''
}
