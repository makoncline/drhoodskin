# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Prospective patients in Golden, Wheat Ridge, Applewood, Morrison, Evergreen, and west Denver. Most arrive on a phone from a Google search for Dr. Hood's name or for a dermatologist in Golden. Their job: decide if Dr. Hood is right for them, then request a visit. Existing patients come for the phone number, hours, directions, and forms. Patients include adults and parents of children; some are older adults.

## Product Purpose

drhoodskin.com is Dr. Channing Hood's personal physician site. It turns interest in Dr. Hood into appointment requests at U.S. Dermatology Partners (USDP) Golden, where she practices. Success is more patients who ask for Dr. Hood by name, measured by booking and call actions on the site.

## Positioning

It is the only site about Dr. Hood as a person. USDP pages present her as one provider in a large group. This site presents her training, her manner with patients, and the direct way to see her.

## Operating Context

- Dr. Hood is employed by USDP. All appointments are confirmed in USDP or vendor flows, never on this site.
- She is booked out for weeks. Public wait times are not confirmed. The site must not promise availability it cannot show.
- The site also serves agents through read-only data surfaces (`app/server.ts`, `app/src/lib/agentReady.ts`).

## Capabilities and Constraints

- Content lives in `app/src/content/drHoodVerified.ts`. Only claims backed by the official sources listed there. No awards, review totals, or outcome claims.
- Do not show either physician assistant on the public site.
- Procedures, services, and conditions are out of scope for current site work (owner decision, 2026-11-14). Keep existing service content unchanged until a separate decision.
- Do not make USDP unhappy: no competing booking, no criticism, no off-brand claims about the group.
- Inferred (not confirmed by the owner): no cosmetic marketing; she prefers surgery and complex medical dermatology.

## Brand Commitments

- Owner direction (2026-11-14): the site should sit alongside premium dermatology practices: refined, warm, soft neutrals, elegant type, still clinical. Professional and polished for patients and AI agents.
- Rejected (2026-11-14): the dark green and brass palette.
- The headshot uses USDP's sky-blue studio background.

## Evidence on Hand

- `app/public/dr-hood-headshot.jpg`: official headshot, 693x780.
- Two dated Google reviews (in the content file). Clinic-page reviews that name her are not reviews on her own profile.
- Featured in TIME; published in JAAD International; training at Notre Dame, LSU School of Medicine, Ochsner, New York Medical College (chief resident); AOA, AAD, ASDS.
- `app/public/golden-office.jpg` is a stock family photo, not the office. Do not present it as the office.
- No photos of the Golden office, no patient photos, no video.

## Product Principles

1. Lead with Dr. Hood the person, then the way to see her.
2. Make the appointment path the clearest thing on every screen, and say honestly what each path does (request vs. booked time vs. phone).
3. Every claim is sourced; credibility comes from specifics, not adjectives.
4. Phone first: the full journey must work with one thumb.

## Accessibility & Inclusion

WCAG 2.2 AA. Large, readable body text for older patients. Full keyboard access. Content visible without JavaScript or animation.
