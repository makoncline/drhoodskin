import { createHash } from 'node:crypto'
import { drHoodVerified } from '../content/drHoodVerified'

const content = drHoodVerified

export const siteCanonical = content.seo.canonical
export const siteOrigin = new URL(siteCanonical).origin
export const contentSignalValue = 'ai-train=no, search=yes, ai-input=yes'
export const mcpProtocolVersion = '2025-06-18'

export const agentPaths = {
  apiCatalog: '/.well-known/api-catalog',
  agentGuide: '/.well-known/agent-guide.md',
  skillsIndex: '/.well-known/agent-skills/index.json',
  mcpServerCard: '/.well-known/mcp/server-card.json',
  mcpEndpoint: '/mcp',
  openApi: '/openapi.json',
  apiIndex: '/api',
  status: '/api/status',
  profile: '/api/profile',
  office: '/api/office',
  contact: '/api/contact',
  forms: '/api/forms',
  insurance: '/api/insurance',
  services: '/api/services',
  faq: '/api/faq',
  booking: '/api/booking',
  search: '/api/search',
  sitemap: '/sitemap.xml',
} as const

function absoluteUrl(pathname: string) {
  return new URL(pathname, siteCanonical).toString()
}

function hashText(value: string) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function normalize(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim()
}

function tokenize(value: string) {
  return normalize(value)
    .split(' ')
    .filter(Boolean)
}

function sourceRef(
  key: keyof typeof content.officialSources | keyof typeof content.externalSources,
) {
  if (key in content.officialSources) {
    const officialKey = key as keyof typeof content.officialSources
    return {
      label: officialKey,
      type: 'official',
      url: content.officialSources[officialKey],
    }
  }

  const externalKey = key as keyof typeof content.externalSources
  return {
    label: externalKey,
    type: 'external',
    url: content.externalSources[externalKey],
  }
}

function sourcesFor(
  ...keys: Array<
    keyof typeof content.officialSources | keyof typeof content.externalSources
  >
) {
  return keys.map((key) => sourceRef(key))
}

function withSources<T extends Record<string, unknown>>(
  value: T,
  ...keys: Array<
    keyof typeof content.officialSources | keyof typeof content.externalSources
  >
) {
  return {
    ...value,
    sources: sourcesFor(...keys),
  }
}

function countTokenMatches(haystack: string, query: string) {
  const haystackTokens = new Set(tokenize(haystack))
  return tokenize(query).filter((token) => haystackTokens.has(token)).length
}

function yesNo(value: boolean) {
  return value ? 'Yes' : 'No'
}

function summarizeHours() {
  return content.office.hours
    .map(([day, hours]) => `- ${day}: ${hours}`)
    .join('\n')
}

function formatFaq() {
  return faqEntries
    .map(
      (item) =>
        `## ${item.question}\n\n${item.answer}`,
    )
    .join('\n\n')
}

function formatServices() {
  const medical = medicalServices
    .map((item) => `- ${item.title}: ${item.description}`)
    .join('\n')
  const procedures = procedureServices
    .map((item) => `- ${item.title}: ${item.description}`)
    .join('\n')

  return [`## Medical dermatology`, medical, `## Procedures`, procedures].join(
    '\n\n',
  )
}

const profileSources = sourcesFor(
  'provider',
  'goldenOffice',
  'goldenNews',
  'healthgrades',
  'time',
  'publication',
)

const officeSources = sourcesFor('goldenOffice', 'goldenNews')
const serviceSources = sourcesFor('provider', 'goldenOffice')
const procedureSources = sourcesFor('provider', 'goldenOffice', 'goldenNews')

export const medicalServices = content.services.medical.map((item) =>
  withSources(item, 'provider', 'goldenOffice'),
)

export const procedureServices = content.services.procedures.map((item) =>
  withSources(item, 'provider', 'goldenOffice', 'goldenNews'),
)

export const whyChooseEntries = content.whyChoose.map((item) =>
  withSources(item, 'goldenOffice', 'goldenNews'),
)

export const faqEntries = content.faq.map((item) => {
  const key = normalize(item.question)

  if (key.includes('accepting new patients')) {
    return withSources(item, 'provider', 'goldenOffice')
  }

  if (key.includes('where is the golden office')) {
    return withSources(item, 'goldenOffice', 'goldenNews')
  }

  if (key.includes('conditions does she treat')) {
    return withSources(item, 'provider', 'goldenOffice')
  }

  if (key.includes('annual skin exams')) {
    return withSources(item, 'goldenOffice')
  }

  if (key.includes('botox')) {
    return withSources(item, 'provider', 'goldenOffice')
  }

  if (key.includes('appointment online')) {
    return withSources(item, 'appointment')
  }

  if (key.includes('first visit')) {
    return withSources(item, 'patientForms')
  }

  if (key.includes('insurance')) {
    return withSources(item, 'insurance')
  }

  return withSources(item, 'provider', 'goldenOffice')
})

export const profilePayload = {
  clinician: {
    name: content.identity.name,
    title: content.identity.title,
    fellowship: content.identity.fellowship,
    acceptingNewPatients: content.identity.acceptingNewPatients,
    medicalSpecialty: 'Dermatology',
    boardCertified: true,
    background: content.background,
    trustChips: content.trustChips,
    officialProviderProfile: content.officialSources.provider,
    sources: profileSources,
  },
  office: {
    name: content.office.name,
    address1: content.office.address1,
    city: content.office.city,
    state: content.office.state,
    zip: content.office.zip,
    phoneDisplay: content.office.phoneDisplay,
    phoneHref: content.office.phoneHref,
    locationNote: content.office.locationNote,
    hours: content.office.hours,
    directionsHref: content.map.directionsHref,
    officialOfficePage: content.officialSources.goldenOffice,
    sources: officeSources,
  },
  sources: {
    official: content.officialSources,
    external: content.externalSources,
  },
  reviewedAt: content.meta.lastReviewed,
}

export const officePayload = {
  office: profilePayload.office,
  areaServed: content.office.areaServed,
  officeOpened: withSources(content.localContext, 'goldenNews'),
  sources: officeSources,
}

export const contactPayload = {
  address: {
    address1: content.office.address1,
    city: content.office.city,
    state: content.office.state,
    zip: content.office.zip,
  },
  directionsHref: content.map.directionsHref,
  hours: content.office.hours,
  officeName: content.office.name,
  phoneDisplay: content.office.phoneDisplay,
  phoneHref: content.office.phoneHref,
  sources: officeSources,
}

export const formsPayload = {
  firstVisit: {
    ...content.firstVisit,
    sources: sourcesFor('patientForms'),
  },
  sources: sourcesFor('patientForms'),
}

export const insurancePayload = {
  insurance: {
    ...content.insurance,
    sources: sourcesFor('insurance'),
  },
  sources: sourcesFor('insurance'),
}

export const servicesPayload = {
  summary:
    'Read-only service summary sourced from the public Dr. Hood and Golden office pages.',
  medical: medicalServices,
  procedures: procedureServices,
  whyChoose: whyChooseEntries,
  sources: serviceSources,
}

export const faqPayload = {
  faq: faqEntries,
  sources: sourcesFor('provider', 'goldenOffice', 'patientForms', 'insurance'),
}

export const bookingPayload = {
  booking: {
    ...content.booking,
    sources: sourcesFor('appointment'),
  },
  phoneDisplay: content.office.phoneDisplay,
  phoneHref: content.office.phoneHref,
  firstVisit: formsPayload.firstVisit,
  insurance: insurancePayload.insurance,
  officialAppointmentPage: content.officialSources.appointment,
  sources: sourcesFor('appointment', 'patientForms', 'insurance'),
}

export const apiIndexPayload = {
  name: 'Dr Hood Skin Read-Only API',
  purpose:
    'Machine-readable, public information about Dr. Channing Hood, the Golden office, services, FAQ, forms, insurance, and official booking links.',
  endpoints: {
    status: agentPaths.status,
    profile: agentPaths.profile,
    office: agentPaths.office,
    contact: agentPaths.contact,
    forms: agentPaths.forms,
    insurance: agentPaths.insurance,
    services: agentPaths.services,
    faq: agentPaths.faq,
    booking: agentPaths.booking,
    search: agentPaths.search,
    openApi: agentPaths.openApi,
    apiCatalog: agentPaths.apiCatalog,
    agentGuide: agentPaths.agentGuide,
    mcpServerCard: agentPaths.mcpServerCard,
    mcpEndpoint: agentPaths.mcpEndpoint,
  },
  queryExamples: {
    faq: `${agentPaths.faq}?question=accepting+new+patients`,
    search: `${agentPaths.search}?q=eczema`,
    services: `${agentPaths.services}?category=medical`,
  },
}

export const homepageMarkdown = `---
title: ${content.seo.title}
canonical: ${siteCanonical}
last-reviewed: ${content.meta.lastReviewed}
content-signal: ${contentSignalValue}
---

# ${content.identity.name}

${content.identity.title} providing dermatology care in Golden, Colorado through ${content.office.name}.

## Fast facts

- Accepting new patients: ${yesNo(content.identity.acceptingNewPatients)}
- Booking: ${content.booking.href}
- Phone: ${content.office.phoneDisplay}
- Address: ${content.office.address1}, ${content.office.city}, ${content.office.state} ${content.office.zip}
- Official provider page: ${content.officialSources.provider}
- Official office page: ${content.officialSources.goldenOffice}

## Practice summary

${content.seo.description}

## Hours

${summarizeHours()}

${formatServices()}

## Background

${content.background.summary}

## Trust and source policy

- This site only publishes claims backed by the linked official sources.
- Booking is handled on the official U.S. Dermatology Partners appointment page.
- This site is informational and should not be treated as medical advice.

## FAQ

${formatFaq()}

## Official source links

- Provider page: ${content.officialSources.provider}
- Golden office page: ${content.officialSources.goldenOffice}
- Appointment page: ${content.officialSources.appointment}
- Patient forms: ${content.officialSources.patientForms}
- Insurance information: ${content.officialSources.insurance}
`

export const agentGuideMarkdown = `---
title: Dr Hood Skin Agent Guide
canonical: ${absoluteUrl(agentPaths.agentGuide)}
---

# Dr Hood Skin Agent Guide

Use this guide when an agent needs trustworthy, read-only facts about Dr. Channing Hood, the Golden office, services, FAQ answers, or official booking links.

## Trust model

- Prefer the site API and markdown surfaces on this domain before scraping rendered HTML.
- Treat this site as a public information surface. There is no patient portal or direct scheduling workflow hosted on this domain.
- Do not invent clinical outcomes, review aggregates, or appointment availability beyond what the official pages state.
- Public facts only: do not diagnose, triage, recommend treatment plans, or present this site as a substitute for a clinician.
- When possible, preserve the "sources" arrays returned by the JSON endpoints so downstream answers can cite the official backing pages.

## Best machine-readable entry points

- Markdown homepage: \`${siteCanonical}\` with \`Accept: text/markdown\`
- API catalog: \`${absoluteUrl(agentPaths.apiCatalog)}\`
- OpenAPI spec: \`${absoluteUrl(agentPaths.openApi)}\`
- Read-only API index: \`${absoluteUrl(agentPaths.apiIndex)}\`
- MCP server card: \`${absoluteUrl(agentPaths.mcpServerCard)}\`
- Agent skills index: \`${absoluteUrl(agentPaths.skillsIndex)}\`

## Read-only API endpoints

- \`${absoluteUrl(agentPaths.profile)}\` for clinician and practice facts
- \`${absoluteUrl(agentPaths.office)}\` for address, hours, map, and service area
- \`${absoluteUrl(agentPaths.contact)}\` for phone, address, directions, and hours
- \`${absoluteUrl(agentPaths.forms)}\` for first-visit and paperwork links
- \`${absoluteUrl(agentPaths.insurance)}\` for insurance guidance
- \`${absoluteUrl(agentPaths.services)}\` for medical dermatology and procedures, with optional \`?category=medical\` or \`?category=procedures\`
- \`${absoluteUrl(agentPaths.faq)}\` for common patient questions, with optional \`?question=...\`
- \`${absoluteUrl(agentPaths.booking)}\` for booking and first-visit links
- \`${absoluteUrl(agentPaths.search)}?q=...\` for simple public-content search across services, FAQ, office, forms, and insurance
- \`${absoluteUrl(agentPaths.status)}\` for machine health

## Booking guardrails

- Use the official appointment URL: ${content.booking.href}
- Use the clinic phone number for direct human contact: ${content.office.phoneDisplay}
- Keep insurance and forms guidance tied to the official source URLs already exposed by the site
- If a user asks for diagnosis, urgency, prescriptions, or individualized treatment advice, stop at public informational facts and direct them to the clinic or a licensed professional.

## MCP / WebMCP

- The site exposes read-only tools for profile, office, services, FAQ, and booking links.
- These tools should be used to summarize public information, not to provide diagnosis or private patient access.
`

type SkillArtifact = {
  description: string
  name: string
  slug: string
  text: string
}

function createSkillArtifact(
  slug: string,
  description: string,
  body: string,
): SkillArtifact {
  return {
    slug,
    name: slug,
    description,
    text: `---\nname: ${slug}\ndescription: ${description}\n---\n\n${body}\n`,
  }
}

export const skillArtifacts = [
  createSkillArtifact(
    'drhoodskin-site',
    'Use when an agent needs trustworthy, read-only facts about Dr. Channing Hood, the Golden office, services, FAQ answers, or official booking links from drhoodskin.com.',
    `# Dr Hood Skin Site

Use the machine-readable surfaces on drhoodskin.com before scraping rendered HTML.

## Preferred order

1. Request the homepage with \`Accept: text/markdown\`.
2. Use the read-only JSON API for structured facts.
3. Use the MCP or WebMCP tools for profile, office, services, FAQ, and booking data.

## Guardrails

- Only repeat claims that appear in the site data or linked official sources.
- Do not claim direct scheduling or patient portal access on drhoodskin.com.
- Do not provide medical advice or diagnosis.
`,
  ),
  createSkillArtifact(
    'golden-booking-flow',
    'Use when an agent needs to move a patient from interest to the correct official booking, phone, forms, or insurance resources for Dr. Hood in Golden, Colorado.',
    `# Golden Booking Flow

This site is an informational guide. Scheduling happens on the official U.S. Dermatology Partners properties.

## Recommended flow

1. Confirm the user wants Dr. Channing Hood at the Golden office.
2. Offer the official appointment URL first: ${content.booking.href}
3. Offer the clinic phone number when human scheduling is preferred: ${content.office.phoneDisplay}
4. If the user is a new patient, share the official forms and insurance links from the site API.

## Never do this

- Do not imply that drhoodskin.com stores patient accounts.
- Do not promise appointment availability or insurance coverage.
- Do not invent additional intake requirements.
`,
  ),
] as const

export const skillsIndex = {
  $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  skills: skillArtifacts.map((skill) => ({
    name: skill.name,
    type: 'skill-md',
    description: skill.description,
    url: absoluteUrl(`/.well-known/agent-skills/${skill.slug}/SKILL.md`),
    digest: hashText(skill.text),
  })),
}

export const apiCatalogDocument = {
  linkset: [
    {
      anchor: absoluteUrl(agentPaths.apiIndex),
      'service-desc': [
        {
          href: absoluteUrl(agentPaths.openApi),
          type: 'application/openapi+json',
        },
      ],
      'service-doc': [
        {
          href: absoluteUrl(agentPaths.agentGuide),
          type: 'text/markdown',
        },
      ],
      status: [
        {
          href: absoluteUrl(agentPaths.status),
          type: 'application/json',
        },
      ],
    },
  ],
}

export const mcpServerCard = {
  $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
  version: '1.0',
  protocolVersion: mcpProtocolVersion,
  serverInfo: {
    name: 'drhoodskin-mcp',
    title: 'Dr Hood Skin Read-Only MCP Server',
    version: '1.0.0',
  },
  description:
    'Read-only MCP tools for public facts about Dr. Channing Hood, the Golden office, services, FAQ answers, and official booking links.',
  documentationUrl: absoluteUrl(agentPaths.agentGuide),
  transport: {
    type: 'streamable-http',
    endpoint: agentPaths.mcpEndpoint,
  },
  capabilities: {
    tools: {
      listChanged: false,
    },
  },
}

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Dr Hood Skin Read-Only API',
    version: '1.0.0',
    description:
      'Machine-readable public information about Dr. Channing Hood and the Golden office. All data is read-only and sourced from the site content model.',
  },
  servers: [{ url: siteOrigin }],
  paths: {
    [agentPaths.apiIndex]: {
      get: {
        summary: 'List agent-ready API endpoints',
        operationId: 'getApiIndex',
        responses: {
          '200': {
            description: 'API entry point',
          },
        },
      },
    },
    [agentPaths.status]: {
      get: {
        summary: 'Get API health and freshness metadata',
        operationId: 'getStatus',
        responses: {
          '200': {
            description: 'Healthy status response',
          },
        },
      },
    },
    [agentPaths.profile]: {
      get: {
        summary: 'Get Dr. Hood profile and office facts',
        operationId: 'getProfile',
        responses: {
          '200': {
            description: 'Clinician and office profile',
          },
        },
      },
    },
    [agentPaths.office]: {
      get: {
        summary: 'Get Golden office details, map, area served, and hours',
        operationId: 'getOffice',
        responses: {
          '200': {
            description: 'Office details',
          },
        },
      },
    },
    [agentPaths.contact]: {
      get: {
        summary: 'Get phone, address, directions, and office hours',
        operationId: 'getContact',
        responses: {
          '200': {
            description: 'Contact details',
          },
        },
      },
    },
    [agentPaths.forms]: {
      get: {
        summary: 'Get first-visit and patient forms links',
        operationId: 'getForms',
        responses: {
          '200': {
            description: 'Forms guidance',
          },
        },
      },
    },
    [agentPaths.insurance]: {
      get: {
        summary: 'Get insurance guidance and official insurance source links',
        operationId: 'getInsurance',
        responses: {
          '200': {
            description: 'Insurance guidance',
          },
        },
      },
    },
    [agentPaths.services]: {
      get: {
        summary: 'Get medical dermatology and procedure summaries',
        operationId: 'getServices',
        parameters: [
          {
            in: 'query',
            name: 'category',
            schema: {
              enum: ['all', 'medical', 'procedures'],
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Services summary',
          },
        },
      },
    },
    [agentPaths.faq]: {
      get: {
        summary: 'Get frequently asked questions and answers',
        operationId: 'getFaq',
        parameters: [
          {
            in: 'query',
            name: 'question',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'FAQ list',
          },
        },
      },
    },
    [agentPaths.booking]: {
      get: {
        summary: 'Get official booking, forms, and insurance links',
        operationId: 'getBooking',
        responses: {
          '200': {
            description: 'Booking guidance',
          },
        },
      },
    },
    [agentPaths.search]: {
      get: {
        summary: 'Search public site content across office, services, FAQ, forms, and insurance',
        operationId: 'searchPublicInfo',
        parameters: [
          {
            in: 'query',
            name: 'q',
            required: true,
            schema: {
              type: 'string',
            },
          },
          {
            in: 'query',
            name: 'limit',
            schema: {
              type: 'integer',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Search results',
          },
        },
      },
    },
  },
}

export const linkHeaderValues = [
  `<${agentPaths.apiCatalog}>; rel="api-catalog"`,
  `<${agentPaths.openApi}>; rel="service-desc"; type="application/openapi+json"`,
  `<${agentPaths.agentGuide}>; rel="service-doc"; type="text/markdown"`,
  `<${siteCanonical}>; rel="alternate"; type="text/markdown"`,
]

export const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(siteCanonical)}</loc>
    <lastmod>${escapeXml(content.meta.lastReviewed)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`

type ToolInput = Record<string, unknown> | undefined
type ToolResult = {
  content: Array<{ text: string; type: 'text' }>
  structuredContent: Record<string, unknown>
}

export const mcpTools = [
  {
    annotations: { readOnlyHint: true },
    description:
      'Return a structured profile for Dr. Channing Hood and the current Golden office.',
    inputSchema: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    name: 'get_profile',
  },
  {
    annotations: { readOnlyHint: true },
    description:
      'Return the Golden office address, phone, map link, hours, and area served.',
    inputSchema: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    name: 'get_office_details',
  },
  {
    annotations: { readOnlyHint: true },
    description:
      'List Dr. Hood services. Optionally limit the response to medical or procedures.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        category: {
          enum: ['all', 'medical', 'procedures'],
          type: 'string',
        },
      },
      type: 'object',
    },
    name: 'list_services',
  },
  {
    annotations: { readOnlyHint: true },
    description:
      'Return FAQ answers. Optionally pass a question string to retrieve the closest match.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        question: {
          description: 'A natural-language patient question.',
          type: 'string',
        },
      },
      type: 'object',
    },
    name: 'get_faq',
  },
  {
    annotations: { readOnlyHint: true },
    description:
      'Return the official booking URL, forms, insurance information, and clinic phone number.',
    inputSchema: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    name: 'get_booking_options',
  },
] as const

function findFaq(question: string | undefined) {
  if (!question) {
    return {
      matched: null,
      questions: faqEntries.map((item) => item.question),
    }
  }

  const normalizedQuestion = normalize(question)
  const matched =
    faqEntries.find((item) =>
      normalize(item.question).includes(normalizedQuestion),
    ) ??
    faqEntries.find((item) =>
      normalizedQuestion.includes(normalize(item.question)),
    ) ??
    faqEntries.find((item) => {
      const questionWords = normalizedQuestion.split(' ')
      return questionWords.some((word) => normalize(item.question).includes(word))
    }) ??
    null

  return {
    matched,
    questions: faqEntries.map((item) => item.question),
  }
}

export function getServicesResult(category: string | undefined) {
  const resolvedCategory = category === 'medical' || category === 'procedures'
    ? category
    : 'all'

  if (resolvedCategory === 'medical') {
    return {
      category: resolvedCategory,
      medical: medicalServices,
      sources: serviceSources,
    }
  }

  if (resolvedCategory === 'procedures') {
    return {
      category: resolvedCategory,
      procedures: procedureServices,
      sources: procedureSources,
    }
  }

  return {
    ...servicesPayload,
    category: resolvedCategory,
  }
}

export function getFaqResult(question: string | undefined) {
  const result = findFaq(question)

  if (result.matched) {
    return {
      answer: result.matched.answer,
      matchedQuestion: result.matched.question,
      sources: result.matched.sources,
    }
  }

  return {
    ...faqPayload,
    questions: result.questions,
  }
}

const searchDocuments = [
  {
    apiPath: agentPaths.profile,
    id: 'profile',
    kind: 'profile',
    pageUrl: siteCanonical,
    sources: profileSources,
    text: [
      content.identity.name,
      content.identity.title,
      content.background.summary,
      content.trustChips.join(' '),
    ].join(' '),
    title: 'Dr. Hood profile',
  },
  {
    apiPath: agentPaths.contact,
    id: 'contact',
    kind: 'contact',
    pageUrl: `${siteCanonical}#visit-the-golden-clinic`,
    sources: officeSources,
    text: [
      content.office.name,
      content.office.address1,
      content.office.city,
      content.office.state,
      content.office.zip,
      content.office.phoneDisplay,
      content.office.locationNote,
      content.office.hours.map(([day, hours]) => `${day} ${hours}`).join(' '),
    ].join(' '),
    title: 'Clinic contact details',
  },
  {
    apiPath: agentPaths.forms,
    id: 'forms',
    kind: 'forms',
    pageUrl: `${siteCanonical}#insurance-first-visit`,
    sources: sourcesFor('patientForms'),
    text: [
      content.firstVisit.summary,
      content.firstVisit.onlineFormsLabel,
      content.firstVisit.printableFormsLabel,
      content.firstVisit.healthHistoryLabel,
    ].join(' '),
    title: 'First-visit forms',
  },
  {
    apiPath: agentPaths.insurance,
    id: 'insurance',
    kind: 'insurance',
    pageUrl: `${siteCanonical}#insurance-first-visit`,
    sources: sourcesFor('insurance'),
    text: [content.insurance.summary, content.insurance.disclaimer].join(' '),
    title: 'Insurance guidance',
  },
  ...medicalServices.map((item, index) => ({
    apiPath: `${agentPaths.services}?category=medical`,
    id: `medical-${index}`,
    kind: 'service',
    pageUrl: `${siteCanonical}#conditions-treated`,
    sources: item.sources,
    text: [item.title, item.description, 'medical dermatology'].join(' '),
    title: item.title,
  })),
  ...procedureServices.map((item, index) => ({
    apiPath: `${agentPaths.services}?category=procedures`,
    id: `procedure-${index}`,
    kind: 'service',
    pageUrl: `${siteCanonical}#conditions-treated`,
    sources: item.sources,
    text: [item.title, item.description, 'procedures cosmetic'].join(' '),
    title: item.title,
  })),
  ...faqEntries.map((item, index) => ({
    apiPath: `${agentPaths.faq}?question=${encodeURIComponent(item.question)}`,
    id: `faq-${index}`,
    kind: 'faq',
    pageUrl: `${siteCanonical}#faq`,
    sources: item.sources,
    text: [item.question, item.answer].join(' '),
    title: item.question,
  })),
]

export function searchSiteContent(query: string | undefined, limit = 8) {
  const trimmedQuery = query?.trim() || ''
  const parsedLimit = Math.max(1, Math.min(20, limit))

  if (!trimmedQuery) {
    return {
      limit: parsedLimit,
      query: trimmedQuery,
      results: [],
    }
  }

  const results = searchDocuments
    .map((entry) => ({
      ...entry,
      score: countTokenMatches(`${entry.title} ${entry.text}`, trimmedQuery),
      snippet: entry.text,
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, parsedLimit)
    .map((entry) => ({
      apiUrl: absoluteUrl(entry.apiPath),
      id: entry.id,
      kind: entry.kind,
      pageUrl: entry.pageUrl,
      score: entry.score,
      snippet: entry.snippet,
      sources: entry.sources,
      title: entry.title,
    }))

  return {
    limit: parsedLimit,
    query: trimmedQuery,
    results,
  }
}

export function callSiteTool(name: string, input: ToolInput): ToolResult {
  if (name === 'get_profile') {
    return {
      content: [
        {
          text: `${content.identity.name} is a board-certified dermatologist seeing patients at ${content.office.name} in Golden, Colorado.`,
          type: 'text',
        },
      ],
      structuredContent: profilePayload,
    }
  }

  if (name === 'get_office_details') {
    return {
      content: [
        {
          text: `${content.office.name} is located at ${content.office.address1}, ${content.office.city}, ${content.office.state} ${content.office.zip}. Phone: ${content.office.phoneDisplay}.`,
          type: 'text',
        },
      ],
      structuredContent: officePayload,
    }
  }

  if (name === 'list_services') {
    const payload = getServicesResult(
      typeof input?.category === 'string' ? input.category : undefined,
    )

    return {
      content: [
        {
          text:
            payload.category === 'medical'
              ? 'Returning medical dermatology services.'
              : payload.category === 'procedures'
                ? 'Returning procedure-focused services.'
                : 'Returning the full services summary.',
          type: 'text',
        },
      ],
      structuredContent: payload,
    }
  }

  if (name === 'get_faq') {
    const question = typeof input?.question === 'string' ? input.question : undefined
    const payload = getFaqResult(question)

    return {
      content: [
        {
          text:
            'matchedQuestion' in payload
              ? `${payload.matchedQuestion} ${payload.answer}`
              : 'No exact FAQ match was found. Returning the available public FAQ questions.',
          type: 'text',
        },
      ],
      structuredContent: payload,
    }
  }

  if (name === 'get_booking_options') {
    return {
      content: [
        {
          text: `Use the official appointment form at ${content.booking.href} or call ${content.office.phoneDisplay} for the Golden clinic.`,
          type: 'text',
        },
      ],
      structuredContent: bookingPayload,
    }
  }

  throw new Error(`Unknown tool: ${name}`)
}
