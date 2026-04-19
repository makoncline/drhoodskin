import { drHoodVerified } from '../content/drHoodVerified'

const content = drHoodVerified

const profilePayload = {
  clinician: {
    acceptingNewPatients: content.identity.acceptingNewPatients,
    fellowship: content.identity.fellowship,
    name: content.identity.name,
    officialProviderProfile: content.officialSources.provider,
    title: content.identity.title,
    trustChips: content.trustChips,
  },
  office: {
    address1: content.office.address1,
    city: content.office.city,
    directionsHref: content.map.directionsHref,
    hours: content.office.hours,
    locationNote: content.office.locationNote,
    name: content.office.name,
    officialOfficePage: content.officialSources.goldenOffice,
    phoneDisplay: content.office.phoneDisplay,
    phoneHref: content.office.phoneHref,
    state: content.office.state,
    zip: content.office.zip,
  },
}

const officePayload = {
  areaServed: content.office.areaServed,
  office: profilePayload.office,
}

const servicesPayload = {
  medical: content.services.medical,
  procedures: content.services.procedures,
  whyChoose: content.whyChoose,
}

const faqPayload = {
  faq: content.faq,
}

const bookingPayload = {
  booking: content.booking,
  firstVisit: content.firstVisit,
  insurance: content.insurance,
  officialAppointmentPage: content.officialSources.appointment,
  phoneDisplay: content.office.phoneDisplay,
  phoneHref: content.office.phoneHref,
}

export function buildWebMcpScript() {
  const payload = JSON.stringify({
    booking: bookingPayload,
    faq: faqPayload,
    office: officePayload,
    profile: profilePayload,
    services: servicesPayload,
  })

  return `(() => {
  const modelContext = globalThis.navigator?.modelContext
  if (!modelContext) return

  const data = ${payload}

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  function findFaq(question) {
    if (!question) {
      return { matched: null, questions: data.faq.faq.map((item) => item.question) }
    }

    const normalizedQuestion = normalize(question)
    const matched =
      data.faq.faq.find((item) => normalize(item.question).includes(normalizedQuestion)) ||
      data.faq.faq.find((item) => normalizedQuestion.includes(normalize(item.question))) ||
      data.faq.faq.find((item) =>
        normalizedQuestion.split(' ').some((word) => normalize(item.question).includes(word)),
      ) ||
      null

    return { matched, questions: data.faq.faq.map((item) => item.question) }
  }

  const tools = [
    {
      name: 'get_profile',
      title: 'Get Dr. Hood profile',
      description: 'Return public profile facts for Dr. Channing Hood and the Golden office.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async () => data.profile,
    },
    {
      name: 'get_office_details',
      title: 'Get office details',
      description: 'Return address, phone, hours, directions, and service area for the Golden office.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async () => data.office,
    },
    {
      name: 'list_services',
      title: 'List services',
      description: 'List medical dermatology and procedures offered through Dr. Hood’s Golden office.',
      inputSchema: {
        type: 'object',
        properties: { category: { type: 'string', enum: ['all', 'medical', 'procedures'] } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async ({ category } = {}) => {
        if (category === 'medical') return { medical: data.services.medical }
        if (category === 'procedures') return { procedures: data.services.procedures }
        return data.services
      },
    },
    {
      name: 'get_faq',
      title: 'Get FAQ answers',
      description: 'Return FAQ answers, optionally filtered by a natural-language patient question.',
      inputSchema: {
        type: 'object',
        properties: { question: { type: 'string' } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async ({ question } = {}) => {
        const result = findFaq(question)
        if (result.matched) {
          return {
            matchedQuestion: result.matched.question,
            answer: result.matched.answer,
            source: 'drhoodskin.com FAQ',
          }
        }
        return result
      },
    },
    {
      name: 'get_booking_options',
      title: 'Get booking options',
      description: 'Return the official booking link, first-visit forms, insurance links, and clinic phone number.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async () => data.booking,
    },
  ]

  try {
    if (typeof modelContext.provideContext === 'function') {
      modelContext.provideContext({ tools })
      return
    }

    if (typeof modelContext.registerTool === 'function') {
      for (const tool of tools) {
        try {
          modelContext.unregisterTool?.(tool.name)
        } catch {}
        modelContext.registerTool(tool)
      }
    }
  } catch (error) {
    console.debug('WebMCP registration failed', error)
  }
})()`
}
