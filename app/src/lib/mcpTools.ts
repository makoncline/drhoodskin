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
    title: 'Get Dr. Hood profile',
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
    title: 'Get Golden office details',
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
    title: 'List services',
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
    title: 'Answer a patient question from the FAQ',
  },
  {
    annotations: { readOnlyHint: true },
    description:
      'Return the ways to book with Dr. Hood: the official scheduling link, which books a specific time (full-body skin exam times rarely show online, so call when none appear); the callback request form, which does not book a time; and the clinic phone number. Also returns first-visit forms and insurance guidance.',
    inputSchema: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    name: 'get_booking_options',
    title: 'Get booking options',
  },
  {
    annotations: { readOnlyHint: true, openWorldHint: true },
    description:
      'Find open appointment times with Dr. Hood that fit the patient. Filter by weekdays and time bands (empty means any), and exclude busy start times with avoid. Returns matching days with their times and booking links, totalMatches, totalDays, the unfiltered soonest opening, hours derived from loaded openings, and the unfiltered other visit type. Limit counts days, not times. Times are Mountain Time. A full-body skin exam needs a full-body slot; never offer an office-visit time for a full-body exam. An office visit is for a specific concern. Confirm the visit type and time with the patient. Give booking links to the patient; do not open them. Online times cover about 90 days.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        visit: {
          description:
            'Office visit for a specific skin concern, or full-body skin exam requiring a full-body slot. exam is an alias for full-body-exam. Never substitute an office visit for a full-body exam. Missing or empty means office. Other values are rejected.',
          enum: ['office', 'full-body-exam', 'exam'],
          type: 'string',
        },
        days: {
          description:
            'Weekdays the patient can come in. Dr. Hood usually works Mon, Tue, Thu, Fri, and sometimes adds a Wednesday.',
          items: {
            enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
            type: 'string',
          },
          type: 'array',
        },
        times: {
          description:
            'Times of day that work: early-morning (before 10 AM), late-morning (10 AM to noon), early-afternoon (noon to 2 PM), late-afternoon (after 2 PM; her last times are about 2:50 PM).',
          items: {
            enum: [
              'early-morning',
              'late-morning',
              'early-afternoon',
              'late-afternoon',
            ],
            type: 'string',
          },
          type: 'array',
        },
        avoid: {
          description:
            'Busy ranges in Mountain Time, in 24-hour HH:MM-HH:MM form, such as 09:00-17:00. Excludes starts at or after the first time and before the second. Malformed or reversed ranges are ignored.',
          items: { type: 'string' },
          type: 'array',
        },
        limit: {
          description: 'Maximum matching days to return, 1 to 20. Default 5.',
          maximum: 20,
          minimum: 1,
          type: 'integer',
        },
      },
      type: 'object',
    },
    name: 'find_appointments',
    title: 'Find appointment times',
  },
] as const
