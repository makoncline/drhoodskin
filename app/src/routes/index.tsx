import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowUpRight, ChevronDown, MapPin, Phone } from 'lucide-react'
import { drHoodVerified } from '../content/drHoodVerified'
import { trackEvent } from '../lib/analytics'
import { registerWebMcpTools } from '../lib/webMcp'
import {
  formatDayHours,
  officeNow,
  openingHoursSpecification,
  weeklyHours,
} from '../lib/officeHours'
import { AppointmentCard } from '../components/AppointmentCard'
import { OfficeStatus } from '../components/OfficeStatus'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'

const content = drHoodVerified
const siteUrl = 'https://drhoodskin.com'
const shareImageUrl = `${siteUrl}${content.identity.shareImageSrc}`
const shareImageAlt = `${content.identity.name}, board-certified dermatologist in Golden, Colorado`

const physicianSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: content.seo.canonical,
      name: 'Dr. Channing Hood',
      about: { '@id': `${siteUrl}/#physician` },
    },
    {
      '@type': 'ProfilePage',
      '@id': `${siteUrl}/#webpage`,
      url: content.seo.canonical,
      name: content.seo.title,
      isPartOf: { '@id': `${siteUrl}/#website` },
      mainEntity: { '@id': `${siteUrl}/#physician` },
      primaryImageOfPage: `${siteUrl}${content.identity.headshotSrc}`,
      dateModified: content.meta.lastReviewed,
    },
    {
      '@type': 'Physician',
      '@id': `${siteUrl}/#physician`,
      name: content.identity.name,
      url: content.seo.canonical,
      isAcceptingNewPatients: content.identity.acceptingNewPatients,
      image: `https://drhoodskin.com${content.identity.headshotSrc}`,
      jobTitle: content.identity.title,
      medicalSpecialty: 'Dermatology',
      telephone: '+1-720-604-0602',
      sameAs: [
        content.officialSources.provider,
        content.externalSources.googleProfile,
        content.externalSources.healthgrades,
        content.externalSources.time,
        content.externalSources.publication,
      ],
      alumniOf: content.background.education.map((item) => ({
        '@type': item.includes('internship')
          ? 'Hospital'
          : 'CollegeOrUniversity',
        name: item
          .replace(' internship', '')
          .replace(' dermatology residency', ''),
      })),
      memberOf: [
        { '@type': 'Organization', name: 'American Academy of Dermatology' },
        {
          '@type': 'Organization',
          name: 'American Society of Dermatologic Surgery',
        },
      ],
      worksFor: { '@id': 'https://drhoodskin.com/#clinic' },
      potentialAction: {
        '@type': 'ReserveAction',
        name: 'Choose an open appointment time with Dr. Hood',
        description: content.booking.summary,
        target: {
          '@type': 'EntryPoint',
          urlTemplate: content.booking.href,
          actionPlatform: [
            'https://schema.org/DesktopWebPlatform',
            'https://schema.org/MobileWebPlatform',
          ],
        },
      },
    },
    {
      '@type': 'MedicalClinic',
      '@id': 'https://drhoodskin.com/#clinic',
      name: content.office.name,
      url: content.officialSources.goldenOffice,
      telephone: '+1-720-604-0602',
      isAcceptingNewPatients: content.identity.acceptingNewPatients,
      parentOrganization: {
        '@type': 'MedicalOrganization',
        name: 'U.S. Dermatology Partners',
        url: 'https://www.usdermatologypartners.com/',
      },
      hasMap: content.map.directionsHref,
      address: {
        '@type': 'PostalAddress',
        streetAddress: content.office.address1,
        addressLocality: content.office.city,
        addressRegion: content.office.state,
        postalCode: content.office.zip,
        addressCountry: 'US',
      },
      openingHoursSpecification: openingHoursSpecification(),
      areaServed: content.office.areaServed,
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://drhoodskin.com/#faq',
      mainEntity: content.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ],
}

const trainingFrames = [
  {
    name: 'New York Medical College',
    role: 'Dermatology residency. Chief resident in her final year.',
    size: 'feature',
  },
  {
    name: 'Louisiana State University School of Medicine',
    role: 'Medical school',
    size: 'wide',
  },
  { name: 'Ochsner Medical Center', role: 'Internship', size: 'small' },
  { name: 'University of Notre Dame', role: null, size: 'small' },
  {
    name: 'Alpha Omega Alpha',
    role: 'Medical honor society',
    size: 'smallSolo',
  },
  {
    name: 'American Academy of Dermatology',
    role: 'Fellow (FAAD)',
    size: 'wide',
  },
  {
    name: 'American Society of Dermatologic Surgery',
    role: 'Member',
    size: 'wide',
  },
] as const

const frameSpan = {
  feature: 'col-span-2 md:col-span-5 md:row-span-2',
  wide: 'col-span-1 md:col-span-4',
  small: 'col-span-1 md:col-span-3',
  smallSolo: 'col-span-1 md:col-span-3',
} as const

const reviewSources = [
  { label: 'Google', href: content.externalSources.googleProfile },
  { label: 'Healthgrades', href: content.externalSources.healthgrades },
]

export const Route = createFileRoute('/')({
  head: () => ({
    links: [{ rel: 'canonical', href: content.seo.canonical }],
    meta: [
      { title: content.seo.title },
      { name: 'description', content: content.seo.description },
      { name: 'theme-color', content: '#f7f5f2' },
      { property: 'og:title', content: content.seo.title },
      { property: 'og:description', content: content.seo.description },
      { property: 'og:type', content: 'profile' },
      { property: 'og:url', content: content.seo.canonical },
      { property: 'og:site_name', content: 'Dr. Channing Hood' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:image', content: shareImageUrl },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: shareImageAlt },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: content.seo.title },
      { name: 'twitter:description', content: content.seo.description },
      { name: 'twitter:image', content: shareImageUrl },
      { name: 'twitter:image:alt', content: shareImageAlt },
    ],
  }),
  component: Home,
})

function Home() {
  useEffect(registerWebMcpTools, [])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(physicianSchema) }}
      />
      <a
        href="#appointment"
        className="sr-only z-[60] rounded-lg bg-action px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to appointment options
      </a>
      <SiteHeader />
      <main className="pb-24 md:pb-0">
        <Hero />
        <PatientWords />
        <TrainingWall />
        <VisitOffice />
        <FirstVisit />
        <ServicesParked />
        <Questions />
        <Closing />
      </main>
      <SiteFooter clearMobileBar />
      <MobileActionBar />
    </>
  )
}

function Hero() {
  return (
    <div id="top" className="bg-paper">
      <div className="shell grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 gap-y-5 pt-7 pb-12 [grid-template-areas:'name_name''photo_lede''card_card'] sm:grid-cols-[8rem_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_minmax(16rem,21rem)] md:gap-x-16 md:gap-y-7 md:pt-16 md:pb-20 md:[grid-template-areas:'name_photo''lede_photo''card_photo']">
        <h1 className="m-0 [grid-area:name]">
          <span className="block font-display text-[clamp(2.1rem,6vw,3.6rem)] leading-[1.05] font-normal tracking-[-0.015em]">
            {content.identity.name}
          </span>
          <span className="mt-3 block text-[clamp(1.1rem,2vw,1.35rem)] leading-snug font-semibold text-ink-muted md:mt-4">
            Board-certified dermatologist in Golden, Colorado
          </span>
        </h1>

        <p className="m-0 self-center text-base leading-snug text-ink-muted [grid-area:lede] sm:text-[1.05rem] sm:leading-relaxed md:self-start md:text-xl md:leading-relaxed">
          Dr. Hood sees adults and children at {content.office.name}, in Red
          Rocks Medical Center.{' '}
          <span className="font-semibold text-ink">
            Accepting new patients.
          </span>
        </p>

        <figure className="m-0 self-start [grid-area:photo] md:row-span-3">
          <div className="frame portrait-settle p-[3px] md:p-1.5">
            <div className="frame-mat p-[6%] md:p-[8%]">
              <img
                src={content.identity.headshotSrc}
                alt={`Portrait of ${content.identity.name}`}
                width={693}
                height={780}
                className="block aspect-[693/780] w-full object-cover"
                loading="eager"
                fetchPriority="high"
              />
            </div>
          </div>
          <figcaption className="mt-4 hidden text-[0.95rem] leading-snug text-ink-muted md:block">
            <span className="block font-semibold text-ink">
              {content.identity.title}
            </span>
            {content.identity.fellowship}. Chief resident at New York Medical
            College.
          </figcaption>
        </figure>

        <div className="[grid-area:card]">
          <AppointmentCard
            id="appointment"
            headingId="appointment-heading"
            placement="hero"
          />
        </div>
      </div>
    </div>
  )
}

function TrainingWall() {
  return (
    <section aria-labelledby="training-heading" className="bg-stone">
      <div className="shell py-16 md:py-24">
        <h2 id="training-heading" className="section-heading">
          Training and recognition
        </h2>

        <ul
          role="list"
          className="mt-10 grid list-none grid-cols-2 items-center gap-3 p-0 md:mt-12 md:grid-cols-12 md:gap-6"
        >
          {trainingFrames.map((frame) => (
            <li key={frame.name} className={frameSpan[frame.size]}>
              <div className="frame frame-quiet">
                <div
                  className={`frame-mat flex flex-col items-center justify-center px-3 text-center ${
                    frame.size === 'feature' ? 'py-7 md:py-14' : 'py-4 md:py-7'
                  }`}
                >
                  <p
                    className={`m-0 font-display leading-tight ${
                      frame.size === 'feature'
                        ? 'text-xl md:text-[1.7rem]'
                        : 'text-base md:text-[1.05rem]'
                    }`}
                  >
                    {frame.name}
                  </p>
                  {frame.role ? (
                    <p className="mt-1.5 mb-0 text-sm leading-snug text-ink-muted md:text-[0.95rem]">
                      {frame.role}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 mb-0 text-[0.95rem] text-ink-muted">
          Training and memberships as listed on{' '}
          <a href={content.officialSources.provider} className="text-link">
            Dr. Hood’s U.S. Dermatology Partners profile
          </a>
          .
        </p>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {content.elsewhereOnline.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => trackEvent('press_click', { label: item.label })}
              className="group flex items-center justify-between gap-4 border-t border-ink/25 pt-5 no-underline"
            >
              <span className="font-display text-xl md:text-2xl">
                {item.label}
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-action transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function PatientWords() {
  return (
    <section aria-labelledby="reviews-heading" className="bg-card">
      <div className="shell py-16 md:py-24">
        <h2 id="reviews-heading" className="section-heading">
          What patients say
        </h2>

        <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-14">
          {content.reviews.map((review) => (
            <figure
              key={`${review.author}-${review.dateLabel}`}
              className="m-0"
            >
              <blockquote className="m-0 border-t border-ink/25 pt-6">
                <p className="m-0 font-display text-[1.35rem] leading-snug md:text-[1.6rem] md:leading-snug">
                  “{review.quote}”
                </p>
              </blockquote>
              <figcaption className="mt-4 text-[0.95rem] text-ink-muted">
                <span className="font-semibold text-ink">{review.author}</span>,{' '}
                {review.sourceLabel} review, {review.dateLabel}
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mt-12 mb-0 text-ink-muted">
          Read more reviews, or leave one after your visit:{' '}
          {reviewSources.map((source, index) => (
            <span key={source.label}>
              {index > 0 ? ' · ' : null}
              <a
                href={source.href}
                onClick={() =>
                  trackEvent('review_outbound_click', { source: source.label })
                }
                className="text-link"
              >
                {source.label}
              </a>
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}

function ServicesParked() {
  return (
    <section
      aria-labelledby="services-heading"
      className="border-t border-rule bg-paper"
    >
      <div className="shell py-16 md:py-24">
        <h2 id="services-heading" className="section-heading max-w-2xl">
          Medical dermatology first, procedures second.
        </h2>

        <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-14">
          <div>
            <h3 className="m-0 text-base font-semibold">Medical dermatology</h3>
            <ul
              role="list"
              className="mt-3 grid list-none gap-x-8 p-0 sm:grid-cols-2"
            >
              {content.services.medical.map((service) => (
                <li key={service.title} className="border-t border-rule">
                  <details className="group">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                      {service.title}
                      <ChevronDown
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="mt-0 mb-4 pr-8 text-ink-muted">
                      {service.description}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="m-0 text-base font-semibold">
              Procedures / cosmetic
            </h3>
            <ul role="list" className="mt-3 list-none p-0">
              {content.services.procedures.map((service) => (
                <li key={service.title} className="border-t border-rule py-3">
                  <p className="m-0 font-semibold">{service.title}</p>
                  <p className="mt-1 mb-0 text-ink-muted">
                    {service.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function useOfficeToday() {
  const [today, setToday] = useState<string | null>(null)
  useEffect(() => setToday(officeNow().day), [])
  return today
}

function VisitOffice() {
  const today = useOfficeToday()

  return (
    <section id="visit" aria-labelledby="visit-heading" className="bg-paper">
      <div className="shell grid gap-12 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-16 md:py-24">
        <div>
          <h2 id="visit-heading" className="section-heading">
            Visit the Golden office
          </h2>

          <address className="mt-6 text-lg leading-relaxed not-italic">
            <span className="block font-semibold">{content.office.name}</span>
            {content.office.address1}
            <br />
            {content.office.city}, {content.office.state} {content.office.zip}
          </address>
          <p className="mt-3 mb-0 text-ink-muted">
            {content.office.locationNote}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={content.map.directionsHref}
              onClick={() => trackEvent('directions_click')}
              className="btn-secondary"
            >
              <MapPin aria-hidden="true" className="h-4.5 w-4.5" />
              Get directions
            </a>
            <a
              href={content.office.phoneHref}
              onClick={() => trackEvent('visit_call_click')}
              className="btn-secondary"
            >
              <Phone aria-hidden="true" className="h-4.5 w-4.5" />
              {content.office.phoneDisplay}
            </a>
          </div>

          <h3 className="mt-10 mb-0 text-base font-semibold">Office hours</h3>
          <OfficeStatus className="mt-2 text-ink-muted" />
          <table className="mt-4 w-full max-w-md border-collapse text-left tabular-nums">
            <caption className="sr-only">
              Golden office hours, Mountain Time
            </caption>
            <tbody>
              {weeklyHours.map((entry) => {
                const isToday = entry.day === today
                return (
                  <tr
                    key={entry.day}
                    aria-current={isToday ? 'date' : undefined}
                    className={`border-t border-rule ${isToday ? 'bg-action-tint' : ''}`}
                  >
                    <th scope="row" className="py-2.5 pl-2 font-semibold">
                      {entry.day}
                      {isToday ? (
                        <span className="ml-2 text-sm text-action">Today</span>
                      ) : null}
                    </th>
                    <td
                      className={`py-2.5 pr-2 text-right ${'closed' in entry ? 'text-ink-muted' : ''}`}
                    >
                      {formatDayHours(entry)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="md:pt-2">
          <div className="frame">
            <iframe
              title="Map of U.S. Dermatology Partners Golden at 400 Indiana St, Golden, Colorado"
              src={content.map.embedSrc}
              className="block aspect-[4/3] w-full border-0 bg-card md:aspect-[4/5]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <p className="mt-3 mb-0 text-[0.95rem] text-ink-muted">
            Serving {content.office.areaServed.slice(0, -1).join(', ')}, and{' '}
            {content.office.areaServed.at(-1)}.
          </p>
        </div>
      </div>
    </section>
  )
}

function FirstVisit() {
  const forms = [
    {
      href: content.firstVisit.onlineFormsUrl,
      label: content.firstVisit.onlineFormsLabel,
      type: 'online',
    },
    {
      href: content.firstVisit.printableFormsUrl,
      label: `${content.firstVisit.printableFormsLabel} (PDF)`,
      type: 'printable',
    },
    {
      href: content.firstVisit.healthHistoryUrl,
      label: content.firstVisit.healthHistoryLabel,
      type: 'history',
    },
  ]

  return (
    <section
      id="first-visit"
      aria-labelledby="first-visit-heading"
      className="bg-card"
    >
      <div className="shell grid gap-12 py-16 md:grid-cols-2 md:gap-16 md:py-24">
        <div>
          <h2 id="first-visit-heading" className="section-heading">
            Before your first visit
          </h2>
          <p className="mt-4 mb-0 text-lg leading-relaxed text-ink-muted">
            {content.firstVisit.summary}
          </p>
          <ul role="list" className="mt-6 list-none p-0">
            {forms.map((form) => (
              <li
                key={form.type}
                className="border-t border-rule last:border-b"
              >
                <a
                  href={form.href}
                  onClick={() => trackEvent('forms_click', { type: form.type })}
                  className="group flex min-h-14 items-center justify-between gap-4 py-3 font-semibold no-underline hover:text-action"
                >
                  {form.label}
                  <ArrowUpRight
                    aria-hidden="true"
                    className="h-4.5 w-4.5 shrink-0 text-action transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:pt-[4.6rem]">
          <h3 className="m-0 text-xl font-semibold">Insurance</h3>
          <p className="mt-3 mb-0 text-lg leading-relaxed">
            {content.insurance.summary}
          </p>
          <p className="mt-3 mb-0 leading-relaxed text-ink-muted">
            {content.insurance.disclaimer}
          </p>
          <a
            href={content.officialSources.insurance}
            onClick={() => trackEvent('insurance_source_click')}
            className="text-link mt-5 inline-flex items-center gap-1.5"
          >
            Insurance information from U.S. Dermatology Partners
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  )
}

function Questions() {
  return (
    <section
      aria-labelledby="faq-heading"
      className="border-t border-rule bg-paper"
    >
      <div className="shell py-16 md:py-24">
        <h2 id="faq-heading" className="section-heading">
          Questions patients ask
        </h2>
        <div className="mt-8 max-w-3xl">
          {content.faq.map((item) => (
            <details
              key={item.question}
              className="group border-t border-rule last:border-b"
              onToggle={(event) => {
                if (event.currentTarget.open) {
                  trackEvent('faq_expand', { question: item.question })
                }
              }}
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="mt-0 mb-5 max-w-[65ch] leading-relaxed text-ink-muted">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function Closing() {
  return (
    <section aria-labelledby="closing-heading" className="bg-stone">
      <div className="shell grid gap-8 py-16 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-center md:gap-14 md:py-24">
        <div>
          <h2 id="closing-heading" className="section-heading">
            Ready to see Dr. Hood?
          </h2>
          <p className="mt-4 mb-0 text-lg leading-relaxed text-ink-muted">
            Pick an open time online, ask the office to call you, or call them
            yourself. U.S. Dermatology Partners confirms every appointment.
          </p>
        </div>
        <AppointmentCard
          headingId="closing-appointment-heading"
          placement="closing"
        />
      </div>
    </section>
  )
}

function MobileActionBar() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const controls = document.querySelectorAll('[data-booking-control]')
    const visible = new Set<Element>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio >= 0.99) visible.add(entry.target)
          else visible.delete(entry.target)
        }
        setHidden(visible.size > 0)
      },
      { threshold: [0, 0.99] },
    )
    controls.forEach((control) => observer.observe(control))
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgb(28_37_41/0.35)] backdrop-blur-md transition-transform duration-300 ease-out motion-reduce:transition-none md:hidden ${
        hidden ? 'translate-y-full' : 'translate-y-0'
      }`}
      aria-hidden={hidden}
      inert={hidden}
    >
      <div className="mx-auto flex max-w-lg gap-3">
        <a
          href={content.booking.href}
          onClick={() => trackEvent('sticky_schedule_click')}
          className="btn-primary flex-[1.6] px-4 whitespace-nowrap"
        >
          Book online
        </a>
        <a
          href={content.office.phoneHref}
          onClick={() => trackEvent('sticky_call_click')}
          className="btn-secondary flex-1 px-4"
        >
          <Phone aria-hidden="true" className="h-4 w-4" />
          Call
        </a>
      </div>
    </div>
  )
}
