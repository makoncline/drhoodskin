import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  FileText,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react'
import { drHoodVerified } from '../content/drHoodVerified'
import { trackEvent } from '../lib/analytics'

const content = drHoodVerified

const physicianSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Physician',
      '@id': 'https://drhoodskin.com/#physician',
      name: content.identity.name,
      url: content.seo.canonical,
      image: `https://drhoodskin.com${content.identity.headshotSrc}`,
      jobTitle: content.identity.title,
      medicalSpecialty: 'Dermatology',
      telephone: '+1-720-604-0602',
      sameAs: [
        content.officialSources.provider,
        content.externalSources.healthgrades,
        content.externalSources.time,
        content.externalSources.publication,
      ],
      alumniOf: content.background.education.map((item) => ({
        '@type': item.includes('internship') ? 'Hospital' : 'CollegeOrUniversity',
        name: item.replace(' internship', '').replace(' dermatology residency', ''),
      })),
      memberOf: [
        { '@type': 'Organization', name: 'American Academy of Dermatology' },
        {
          '@type': 'Organization',
          name: 'American Society of Dermatologic Surgery',
        },
      ],
      worksFor: { '@id': 'https://drhoodskin.com/#clinic' },
    },
    {
      '@type': 'MedicalClinic',
      '@id': 'https://drhoodskin.com/#clinic',
      name: content.office.name,
      url: content.seo.canonical,
      image: `https://drhoodskin.com${content.identity.officeImageSrc}`,
      telephone: '+1-720-604-0602',
      hasMap: content.map.directionsHref,
      address: {
        '@type': 'PostalAddress',
        streetAddress: content.office.address1,
        addressLocality: content.office.city,
        addressRegion: content.office.state,
        postalCode: content.office.zip,
        addressCountry: 'US',
      },
      openingHoursSpecification: content.office.hours
        .filter(([, hours]) => hours !== 'Closed')
        .map(([day]) => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: day,
          opens: '08:00',
          closes: '16:30',
        })),
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

type SourceLinkItem = {
  href: string
  label: string
  onClick?: () => void
}

export const Route = createFileRoute('/')({
  head: () => ({
    links: [{ rel: 'canonical', href: content.seo.canonical }],
    meta: [
      { title: content.seo.title },
      { name: 'description', content: content.seo.description },
      { property: 'og:title', content: content.seo.title },
      { property: 'og:description', content: content.seo.description },
      { property: 'og:type', content: 'website' },
      {
        property: 'og:image',
        content: `https://drhoodskin.com${content.identity.headshotSrc}`,
      },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Home,
})

function Home() {
  return (
    <main className="min-h-screen bg-[var(--paper)] pb-24 text-[var(--ink)] sm:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(physicianSchema) }}
      />

      <header className="sticky top-0 z-40 hidden border-b border-[var(--line)] bg-[var(--paper-strong)] backdrop-blur sm:block">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-3 px-6 py-3 lg:px-8">
          <a
            href={content.office.phoneHref}
            onClick={() => trackEvent('sticky_call_click')}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Phone className="h-4 w-4" />
            Call {content.office.phoneDisplay}
          </a>
          <a
            href={content.booking.href}
            onClick={() => trackEvent('sticky_book_click')}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            <CalendarDays className="h-4 w-4" />
            {content.booking.ctaLabel}
          </a>
        </div>
      </header>

      <section className="section-wrap grid gap-10 py-10 lg:grid-cols-[minmax(0,1.02fr)_24rem] lg:items-center lg:gap-14 lg:py-16">
        <div>
          <p className="mb-5 text-[0.72rem] font-semibold uppercase tracking-[0.4em] text-[var(--accent)]">
            {content.identity.name}
          </p>
          <h1 className="max-w-4xl font-display text-[clamp(2.85rem,6vw,5.4rem)] leading-[0.94] tracking-[-0.05em]">
            Board-Certified Dermatology Care in Golden
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Thoughtful, evidence-based dermatology care for adults and children
            in Golden and west Denver. Accepting new patients at{' '}
            {content.office.name}.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={content.booking.href}
              onClick={() => trackEvent('hero_book_click')}
              className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[var(--accent)] px-5 py-3.5 text-base font-semibold text-white transition hover:bg-[var(--accent-strong)] sm:w-auto sm:px-6"
            >
              {content.booking.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={content.office.phoneHref}
              onClick={() => trackEvent('hero_call_click')}
              className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[var(--line-strong)] bg-white px-5 py-3.5 text-base font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] sm:w-auto sm:px-6"
            >
              <Phone className="h-4 w-4" />
              Call {content.office.phoneDisplay}
            </a>
          </div>

          <p className="mt-6 flex items-start gap-2 text-sm leading-7 text-[var(--muted)]">
            <MapPin className="mt-1 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <span>
              {content.office.name}, {content.office.address1},{' '}
              {content.office.city}, {content.office.state} {content.office.zip}
            </span>
          </p>

          <SourceLinks
            className="mt-5"
            links={[
              {
                href: content.officialSources.provider,
                label: 'Provider page',
              },
              {
                href: content.officialSources.goldenOffice,
                label: 'Golden office page',
              },
            ]}
          />
        </div>

        <div className="lg:justify-self-end">
          <figure className="overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
            <img
              src={content.identity.headshotSrc}
              alt={content.identity.name}
              className="aspect-[4/5] w-full object-cover"
              loading="eager"
            />
          </figure>
        </div>
      </section>

      <section className="section-wrap border-t border-[var(--line)] py-6 lg:py-8">
        <div className="flex flex-wrap gap-2">
          {content.trustChips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--ink)]"
            >
              {chip}
            </span>
          ))}
        </div>
      </section>

      <section className="section-wrap border-t border-[var(--line)] py-12 lg:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Why choose Dr. Hood in Golden</p>
            <h2 className="section-title">Local care with the medical focus people actually need.</h2>
          </div>
          <SourceLinks
            links={[
              {
                href: content.officialSources.goldenOffice,
                label: 'Golden office page',
              },
              {
                href: content.officialSources.goldenNews,
                label: 'Golden office announcement',
              },
            ]}
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {content.whyChoose.map((item) => (
            <div
              key={item.title}
              className="border-t border-[var(--line)] pt-4"
            >
              <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
              <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-wrap border-t border-[var(--line)] py-12 lg:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Conditions treated</p>
            <h2 className="section-title">Medical dermatology first, procedures second.</h2>
          </div>
          <SourceLinks
            links={[
              {
                href: content.officialSources.provider,
                label: 'Provider page',
              },
              {
                href: content.officialSources.goldenOffice,
                label: 'Golden office page',
              },
            ]}
          />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            <p className="eyebrow">Medical dermatology</p>
            <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
              {content.services.medical.map((service) => (
                <details
                  key={service.title}
                  className="group border-t border-[var(--line)]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-base font-medium [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">{service.title}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-open:rotate-180" />
                  </summary>
                  <p className="pb-4 pr-8 text-sm leading-7 text-[var(--muted)]">
                    {service.description}
                  </p>
                </details>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--line)] pt-5 lg:pt-0">
            <p className="eyebrow">Procedures / cosmetic</p>
            <div className="space-y-4">
              {content.services.procedures.map((service) => (
                <div
                  key={service.title}
                  className="border-t border-[var(--line)] py-4"
                >
                  <p className="m-0 text-base font-semibold">{service.title}</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    {service.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-wrap border-t border-[var(--line)] py-12 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <p className="eyebrow">About Dr. Hood</p>
            <h2 className="section-title">Source-backed training and current Golden practice.</h2>
            <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--muted)]">
              {content.background.summary}
            </p>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="border-t border-[var(--line)] pt-5">
                <p className="eyebrow">Training</p>
                <ul className="space-y-2 text-sm leading-7 text-[var(--muted)]">
                  {content.background.education.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-[var(--line)] pt-5">
                <p className="eyebrow">Affiliations</p>
                <ul className="space-y-2 text-sm leading-7 text-[var(--muted)]">
                  {content.background.distinctions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <SourceLinks
              className="mt-6"
              links={[
                {
                  href: content.officialSources.provider,
                  label: 'Provider page',
                },
                {
                  href: content.officialSources.goldenNews,
                  label: 'Golden office announcement',
                },
              ]}
            />
          </div>

          <div className="border-t border-[var(--line)] pt-5 lg:pt-0">
            <p className="eyebrow">Additional credibility</p>
            <div className="space-y-4">
              {content.elsewhereOnline.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)] transition hover:text-[var(--accent)]"
                >
                  {item.label}
                  <ExternalLink className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-wrap border-t border-[var(--line)] py-12 lg:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">What patients say</p>
            <h2 className="section-title">Official office reviews, kept simple.</h2>
          </div>
          <SourceLinks
            links={[
              {
                href: content.officialSources.goldenOffice,
                label: 'Golden office page',
              },
            ]}
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {content.reviews.map((review) => (
            <article
              key={`${review.author}-${review.dateLabel}`}
              className="border-t border-[var(--line)] pt-5"
            >
              <BadgeCheck className="h-4 w-4 text-[var(--accent)]" />
              <p className="mt-4 text-base leading-8 text-[var(--ink)]">
                &ldquo;{review.quote}&rdquo;
              </p>
              <p className="mt-4 text-sm text-[var(--muted)]">
                {review.author} · Source: {review.sourceLabel} · {review.dateLabel}
              </p>
            </article>
          ))}
        </div>

        <a
          href={content.externalSources.healthgrades}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent('review_outbound_click')}
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)] transition hover:text-[var(--accent)]"
        >
          {content.reviewOutboundLabel}
          <ExternalLink className="h-4 w-4" />
        </a>
      </section>

      <section className="section-wrap border-t border-[var(--line)] py-12 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12">
          <div>
            <p className="eyebrow">Visit the Golden clinic</p>
            <h2 className="section-title">Address, map, phone, and weekday hours in one place.</h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
              {content.office.locationNote}
            </p>

            <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
              <iframe
                title="Map to U.S. Dermatology Partners Golden"
                src={content.map.embedSrc}
                className="h-[320px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <SourceLinks
              className="mt-6"
              links={[
                {
                  href: content.officialSources.goldenOffice,
                  label: 'Golden office page',
                },
                {
                  href: content.officialSources.goldenNews,
                  label: 'Golden office announcement',
                },
              ]}
            />
          </div>

          <div className="border-t border-[var(--line)] pt-5 lg:pt-0">
            <div className="space-y-6 divide-y divide-[var(--line)]">
              <div className="pb-1">
                <figure className="overflow-hidden rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)]">
                  <img
                    src={content.identity.officeImageSrc}
                    alt={`${content.office.name} exterior`}
                    className="aspect-[5/4] w-full object-cover"
                    loading="lazy"
                  />
                </figure>
                <p className="eyebrow mt-5">Address</p>
                <p className="mt-2 text-lg font-semibold">
                  {content.office.address1}
                </p>
                <p className="text-lg font-semibold">
                  {content.office.city}, {content.office.state} {content.office.zip}
                </p>
              </div>

              <div className="pt-6">
                <p className="eyebrow">Contact</p>
                <div className="mt-2 flex flex-col items-start gap-4">
                  <a
                    href={content.office.phoneHref}
                    className="inline-flex items-center gap-2 whitespace-nowrap text-lg font-semibold text-[var(--ink)] transition hover:text-[var(--accent)]"
                  >
                    <Phone className="h-4 w-4" />
                    {content.office.phoneDisplay}
                  </a>
                  <a
                    href={content.map.directionsHref}
                    onClick={() => trackEvent('directions_click')}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)] transition hover:text-[var(--accent)]"
                  >
                    Get directions
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="pt-6">
                <p className="eyebrow">Hours</p>
                <dl className="mt-3 space-y-2 text-base">
                  {content.office.hours.map(([day, hours]) => (
                    <div
                      key={day}
                      className="flex flex-col gap-1 border-b border-[var(--line)] py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <dt className="font-medium">{day}</dt>
                      <dd className="text-[var(--muted)]">{hours}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-wrap border-t border-[var(--line)] py-12 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <p className="eyebrow">Insurance &amp; first visit</p>
            <h2 className="section-title">Reduce booking friction before the appointment.</h2>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)]">
              {content.insurance.summary} {content.insurance.disclaimer}
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="border-t border-[var(--line)] pt-5">
                <FileText className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="mt-4 text-base font-semibold">Before your first visit</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {content.firstVisit.summary}
                </p>
                <div className="mt-5 flex flex-col items-start gap-3">
                  <a
                    href={content.firstVisit.onlineFormsUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackEvent('forms_click', { type: 'online' })}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                  >
                    {content.firstVisit.onlineFormsLabel}
                  </a>
                  <a
                    href={content.firstVisit.printableFormsUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackEvent('forms_click', { type: 'printable' })}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)] transition hover:text-[var(--accent)]"
                  >
                    {content.firstVisit.printableFormsLabel}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    href={content.firstVisit.healthHistoryUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackEvent('forms_click', { type: 'history' })}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)] transition hover:text-[var(--accent)]"
                  >
                    {content.firstVisit.healthHistoryLabel}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="border-t border-[var(--line)] pt-5">
                <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="mt-4 text-base font-semibold">Insurance</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {content.insurance.summary}
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {content.insurance.disclaimer}
                </p>
                <a
                  href={content.officialSources.insurance}
                  onClick={() => trackEvent('insurance_source_click')}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)] transition hover:text-[var(--accent)]"
                >
                  Official insurance information
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--line)] pt-5 lg:pt-0">
            <p className="eyebrow">Official source</p>
            <div className="space-y-3">
              <a
                href={content.officialSources.patientForms}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)] transition hover:text-[var(--accent)]"
              >
                Patient forms page
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={content.officialSources.insurance}
                onClick={() => trackEvent('insurance_source_click')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)] transition hover:text-[var(--accent)]"
              >
                Insurance information
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section-wrap border-t border-[var(--line)] py-12 lg:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2 className="section-title">Short answers before you book.</h2>
          </div>
          <SourceLinks
            links={[
              {
                href: content.officialSources.provider,
                label: 'Provider page',
              },
              {
                href: content.officialSources.goldenOffice,
                label: 'Golden office page',
              },
              {
                href: content.officialSources.patientForms,
                label: 'Patient forms',
              },
              {
                href: content.officialSources.insurance,
                label: 'Insurance',
              },
            ]}
          />
        </div>

        <div className="mt-8 space-y-2">
          {content.faq.map((item) => (
            <details
              key={item.question}
              className="group rounded-[1rem] border border-[var(--line)] bg-[var(--surface)] px-5 py-1"
              onToggle={(event) => {
                if (event.currentTarget.open) {
                  trackEvent('faq_expand', { question: item.question })
                }
              }}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-semibold [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-open:rotate-180" />
              </summary>
              <p className="pb-4 text-sm leading-7 text-[var(--muted)]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="section-wrap border-t border-[var(--line)] py-14 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="eyebrow">Book an appointment</p>
            <h2 className="section-title">Ready to book with Dr. Hood in Golden?</h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
              Use the official appointment form or call the Golden office
              directly.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={content.booking.href}
              onClick={() => trackEvent('final_cta_book_click')}
              className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[var(--accent)] px-5 py-3.5 text-base font-semibold text-white transition hover:bg-[var(--accent-strong)] sm:w-auto sm:px-6"
            >
              {content.booking.ctaLabel}
            </a>
            <a
              href={content.office.phoneHref}
              onClick={() => trackEvent('final_cta_call_click')}
              className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[var(--line-strong)] bg-white px-5 py-3.5 text-base font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] sm:w-auto sm:px-6"
            >
              Call {content.office.phoneDisplay}
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="section-wrap flex flex-col gap-4 py-8 text-sm text-[var(--muted)] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-semibold text-[var(--ink)]">{content.identity.name}</p>
            <p>{content.identity.title}</p>
            <p>{content.office.name}</p>
            <p>
              {content.office.address1}, {content.office.city}, {content.office.state}{' '}
              {content.office.zip}
            </p>
            <p>{content.office.phoneDisplay}</p>
            <p>Last reviewed: {content.meta.lastReviewed}</p>
          </div>

          <div className="flex flex-wrap gap-5">
            <a href={content.officialSources.provider} className="font-medium hover:text-[var(--accent)]">
              Official provider profile
            </a>
            <a href={content.officialSources.goldenOffice} className="font-medium hover:text-[var(--accent)]">
              Golden office page
            </a>
            <a href={content.officialSources.appointment} className="font-medium hover:text-[var(--accent)]">
              Appointment page
            </a>
          </div>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-[var(--paper-strong)] p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-lg gap-3">
          <a
            href={content.booking.href}
            onClick={() => trackEvent('sticky_book_click')}
            className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            <CalendarDays className="h-4 w-4" />
            Book Appointment
          </a>
          <a
            href={content.office.phoneHref}
            onClick={() => trackEvent('sticky_call_click')}
            className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[var(--line-strong)] bg-white px-4 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Phone className="h-4 w-4" />
            Call
          </a>
        </div>
      </div>
    </main>
  )
}

function SourceLinks({
  links,
  className = '',
}: {
  links: SourceLinkItem[]
  className?: string
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-xs text-[var(--muted)] ${className}`.trim()}
    >
      <span className="font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        Official source
      </span>
      {links.map((link) => (
        <a
          key={`${link.label}-${link.href}`}
          href={link.href}
          onClick={link.onClick}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 font-medium transition hover:text-[var(--accent)]"
        >
          {link.label}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ))}
    </div>
  )
}
