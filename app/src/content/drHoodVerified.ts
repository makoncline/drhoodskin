// Content guardrails:
// - Only include claims backed by the official source URLs below.
// - If a claim loses an official source, remove it instead of guessing.
// - Keep copy original; do not paste official site prose verbatim.
// - Do not add awards, review totals, or outcome claims.

export const drHoodVerified = {
  meta: {
    lastReviewed: '2026-03-15',
  },

  officialSources: {
    provider:
      'https://www.usdermatologypartners.com/provider/channing-hood-md/',
    goldenOffice:
      'https://www.usdermatologypartners.com/locations/colorado/golden/400-indiana-st-ste-380/',
    appointment:
      'https://www.usdermatologypartners.com/locations/colorado/golden/400-indiana-st-ste-380/#id=5596&reason_id=&ag%20by%20e=&group=Medical%20Dermatology',
    patientForms:
      'https://www.usdermatologypartners.com/resources/patient-forms/',
    insurance:
      'https://www.usdermatologypartners.com/resources/insurance-information/',
    goldenNews:
      'https://www.usdermatologypartners.com/news/new-location-golden-co/',
  },

  externalSources: {
    healthgrades:
      'https://www.healthgrades.com/physician/dr-channing-hood-11vyamkx77',
    time: 'https://time.com/7300908/how-to-stop-chafing/',
    publication: 'https://touroscholar.touro.edu/nymc_fac_pubs/3817/',
  },

  seo: {
    title: 'Dr. Channing Hood | Dermatologist in Golden, CO',
    description:
      'Board-certified dermatologist Channing Hood, MD, FAAD sees patients in Golden, Colorado for skin exams, acne, eczema, psoriasis, rosacea, hair loss, Botox, minor procedures, and skin cancer checks. Book online or call the Golden clinic.',
    canonical: 'https://drhoodskin.com/',
  },

  identity: {
    name: 'Channing Hood, MD, FAAD',
    title: 'Board-Certified Dermatologist',
    fellowship: 'Fellow of the American Academy of Dermatology',
    acceptingNewPatients: true,
    headshotSrc: '/dr-hood-headshot.jpg',
    officeImageSrc: '/golden-office.jpg',
  },

  office: {
    name: 'U.S. Dermatology Partners Golden',
    address1: '400 Indiana St #380',
    city: 'Golden',
    state: 'CO',
    zip: '80401',
    phoneDisplay: '(720) 604-0602',
    phoneHref: 'tel:+17206040602',
    locationNote:
      'Located in the Red Rocks Medical Center at the NE corner of 6th Ave and Indiana St, just 1/2 mile east of Jefferson County Fairgrounds.',
    areaServed: [
      'Golden',
      'Wheat Ridge',
      'Applewood',
      'Morrison',
      'Evergreen',
      'West Denver',
    ],
    hours: [
      ['Monday', '8:00AM - 4:30PM'],
      ['Tuesday', '8:00AM - 4:30PM'],
      ['Wednesday', 'Closed'],
      ['Thursday', '8:00AM - 4:30PM'],
      ['Friday', '8:00AM - 4:30PM'],
      ['Saturday', 'Closed'],
      ['Sunday', 'Closed'],
    ] as const,
  },

  map: {
    directionsHref:
      'https://maps.google.com?daddr=400+Indiana+St+%23380,+Golden,+CO+80401',
    embedSrc:
      'https://maps.google.com/maps?q=400%20Indiana%20St%20%23380%2C%20Golden%2C%20CO%2080401&t=&z=15&ie=UTF8&iwloc=&output=embed',
  },

  booking: {
    ctaLabel: 'Book an Appointment',
    href: 'https://www.usdermatologypartners.com/locations/colorado/golden/400-indiana-st-ste-380/#id=5596&reason_id=&ag%20by%20e=&group=Medical%20Dermatology',
    summary:
      'Use the official U.S. Dermatology Partners appointment form to request a visit at the Golden office.',
  },

  firstVisit: {
    summary:
      'New patients can complete forms online before the visit or use printable packets from the patient forms page.',
    onlineFormsUrl: 'https://myskinportal.usdermpartners.com/login',
    onlineFormsLabel: 'Complete patient forms online',
    printableFormsUrl:
      'https://www.usdermatologypartners.com/wp-content/uploads/2025/07/U.S.-Dermatology-Partners-Patient-Packet-2025-2.pdf',
    printableFormsLabel: 'Printable patient forms',
    healthHistoryUrl:
      'https://www.usdermatologypartners.com/wp-content/uploads/2022/01/U.S.-Dermatology-Partners-Health-History-Form-2022-v2.pdf',
    healthHistoryLabel: 'Health history form PDF',
  },

  insurance: {
    summary: 'U.S. Dermatology Partners accepts most major insurance plans.',
    disclaimer:
      'Patients should verify coverage benefits directly with their insurance carrier. Some plans require a referral, pre-authorization, or pre-certification before scheduling.',
  },

  localContext: {
    officeOpened: 'July 21, 2025',
    officeOpenedSummary:
      'The Golden office opened on July 21, 2025 and serves patients of all ages.',
  },

  trustChips: [
    'Board-Certified Dermatologist',
    'FAAD',
    'Accepting New Patients',
    'Golden, CO',
    'Patients of all ages',
  ],

  whyChoose: [
    {
      title: 'Annual skin exams and skin cancer checks',
      description:
        'The Golden office highlights annual skin examinations and skin cancer detection and treatment as core services.',
    },
    {
      title: 'Medical dermatology for common ongoing issues',
      description:
        'Acne, eczema, psoriasis, rosacea, and hair loss are among the conditions publicly emphasized for this office and provider.',
    },
    {
      title: 'Care for adults and children',
      description:
        'The Golden office announcement states the clinic serves patients of all ages.',
    },
    {
      title: 'Convenient Golden location',
      description:
        'The clinic is in Red Rocks Medical Center near 6th Avenue and Indiana Street with direct booking and weekday hours.',
    },
  ],

  services: {
    medical: [
      {
        title: 'Annual skin examinations',
        description:
          'Yearly skin checks and visits for new or changing spots.',
      },
      {
        title: 'Skin cancer concerns',
        description:
          'Evaluation of suspicious lesions and skin cancer detection needs.',
      },
      {
        title: 'Acne',
        description:
          'Medical acne care for persistent breakouts and treatment planning.',
      },
      {
        title: 'Eczema / dermatitis',
        description:
          'Help for chronic itching, irritation, inflammation, and flare control.',
      },
      {
        title: 'Psoriasis',
        description:
          'Care for ongoing inflammatory skin disease and long-term management.',
      },
      {
        title: 'Rosacea',
        description:
          'Treatment for redness, flushing, and recurring facial irritation.',
      },
      {
        title: 'Hair loss / alopecia',
        description:
          'Evaluation of alopecia and other forms of hair thinning or shedding.',
      },
      {
        title: 'Pediatric dermatology',
        description: 'Dermatology care for children as well as adults.',
      },
    ],
    procedures: [
      {
        title: 'Botox',
        description:
          'Botox is publicly listed among services available through the Golden office.',
      },
      {
        title: 'Minor procedures',
        description:
          'Dr. Hood’s official Golden office announcement notes minor surgeries and procedures.',
      },
    ],
  },

  background: {
    summary:
      'Dr. Hood trained at the University of Notre Dame, Louisiana State University School of Medicine, Ochsner Medical Center, and New York Medical College, where she served as chief resident during her final year.',
    education: [
      'University of Notre Dame',
      'Louisiana State University School of Medicine',
      'Ochsner Medical Center internship',
      'New York Medical College dermatology residency',
    ],
    distinctions: [
      'Alpha Omega Alpha Medical Honor Society',
      'Chief resident during final year of residency',
      'American Academy of Dermatology',
      'American Society of Dermatologic Surgery',
    ],
  },

  reviews: [
    {
      quote:
        'Dr Hood was efficient and friendly, and quickly identified a small concerning skin growth as harmless.',
      author: 'Michael Hearne',
      sourceLabel: 'Google',
      dateLabel: 'Mar 14, 2026',
    },
    {
      quote:
        'Dr. Hood is always thorough and professional. She allows patient participation when deciding a course of action and explains several solutions.',
      author: 'Chris Fraser',
      sourceLabel: 'Google',
      dateLabel: 'Mar 12, 2026',
    },
  ],

  reviewOutboundLabel: 'View external patient profile',

  elsewhereOnline: [
    {
      label: 'Featured in TIME',
      href: 'https://time.com/7300908/how-to-stop-chafing/',
    },
    {
      label: 'Published in JAAD International',
      href: 'https://touroscholar.touro.edu/nymc_fac_pubs/3817/',
    },
  ],

  faq: [
    {
      question: 'Is Dr. Hood accepting new patients?',
      answer:
        'Yes. The official provider page and Golden office page both indicate that Dr. Hood is accepting new patients.',
    },
    {
      question: 'Where is the Golden office located?',
      answer:
        'The Golden clinic is at 400 Indiana St #380, Golden, CO 80401 in Red Rocks Medical Center near the NE corner of 6th Avenue and Indiana Street.',
    },
    {
      question: 'What conditions does she treat?',
      answer:
        'Official pages highlight annual skin examinations, skin cancer concerns, acne, eczema, psoriasis, rosacea, hair loss, pediatric dermatology, Botox, and minor procedures.',
    },
    {
      question: 'Does the clinic provide annual skin exams?',
      answer:
        'Yes. Annual skin examinations are specifically listed among services at the Golden office.',
    },
    {
      question: 'Is Botox available in Golden?',
      answer:
        'Yes. Botox is publicly listed among services associated with the Golden office and Dr. Hood’s current practice.',
    },
    {
      question: 'How do I request an appointment online?',
      answer:
        'Use the official U.S. Dermatology Partners appointment form to request a visit at the Golden clinic.',
    },
    {
      question: 'What should I do before my first visit?',
      answer:
        'New patients can complete forms online in advance or use the printable patient forms and health history form from the official patient forms page.',
    },
    {
      question: 'What should I know about insurance coverage?',
      answer:
        'U.S. Dermatology Partners says it accepts most major insurance plans, but patients should verify benefits directly with their insurer because some plans require a referral, pre-authorization, or pre-certification.',
    },
  ],
} as const
