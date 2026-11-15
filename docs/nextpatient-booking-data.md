# NextPatient booking data (observed 2026-11-14)

Internal reference. These are the read-only requests that NextPatient's public booking pages and widgets make in a patient's browser. NextPatient does not document them as an API. Production use needs USDP or NextPatient approval. Do not open `appt-book` slot links in automation; a slot hold on open is not ruled out.

## Identifiers

| Item | Value |
|---|---|
| Practice (USDP Golden location) | `5596` |
| Dr. Hood provider entity | `60744` |
| Visit-type group | `Medical Dermatology` (the only group at Golden) |
| Visit reasons | `56487` new office visit, `56488` established office visit, `56485` new full-body skin exam, `56486` established full-body skin exam |

New and established reasons return the same slots (owner: no scheduling difference).

## Requests

All are `GET`, JSON, `Access-Control-Allow-Origin: *`, `Cache-Control: no-store`.

| Request | Inputs | Returns |
|---|---|---|
| `/p/5596/60744/provider-locations.js?id=60744` | none | Official provider widget script with a pre-rendered "Next Appt" preview and the reason menu |
| `/p/5596/60744/provider.json` | `id`, `reason_id` | `{ html, age_range_display }`: first three slots for the reason |
| `/p/5596/schedule.json` | `day=YYYY-MM-DD`, `reason_id`, `entity_id` | `{ html, day, day_min, day_max, prev_day, next_day, next_slot_day }`: a three-day window of slots |
| `/p/5596/providers.json` | `group`, `reason_id` (also supports `age`, `insurance_id`, `zip`, `max_miles`; not enabled here) | `{ html, reason_select }`: every provider at the location with next times, and the reason menu |

`next_slot_day` is the first day with any slot for the reason, not the next day after the window. A window without open times returns one placeholder cell (`td.nextpatient-schedule-next-available`, `colspan=3`, "First available: …") instead of three day columns. The placeholder looks the same for an empty stretch before a later opening and for dates past the online booking window, so a reader cannot use it to find the horizon. The site's loader scans empty stretches up to about 92 days ahead, then stops at the first empty batch.

## What a slot contains

Only: clock time as text (`1:50pm`, Mountain Time, no zone label), a numeric slot ID, and the booking link `/p/5596/<slotId>/appt-book?reason_id=<reason>`. No end time, duration, slot type, or status. Responses are HTML fragments, not structured data.

## Findings

- **Online window: about 90 days, practice-wide.** On 2026-11-14 the last online time for both Golden providers was 2027-02-11 (day 89). Friday 2027-02-12, a working day, showed no slots. Confirm the rolling behavior with the poller's `horizon` events.
- **Full-body booking is enabled at Golden, but Dr. Hood has no online full-body slots.** For reason `56485`, another Golden provider lists bookable times; Dr. Hood lists "CALL TO SCHEDULE". She appears under the reason, so she is enabled for it (NextPatient hides providers who are not enabled for a reason).
- **Slot types differ by provider.** The other provider's slot IDs serve both office and full-body reasons (generic 10-minute slots). Dr. Hood's online slots serve office visits only, at :40 and :50 each hour from 8:40 AM to 2:50 PM (up to 12 a day). Her full-body slots are a separate type that does not appear online in the window.
- **Cause confirmed: booked, not broken.** On Saturday, Nov 14, about 6 PM, a full-body slot for Dr. Hood appeared online for Monday, Nov 16, 2:30 PM (slot `1096686135`). It was offered for both full-body reasons and not for office visits. Her full-body slot type is mapped; her full-body exams are simply booked past the window, so they show online only after a cancellation.

## Colorado comparison (2026-11-14)

Each USDP Colorado office has its own NextPatient practice ID, found in the office page widget: Arvada `5159`, Denver `5160`, Lakewood `5161`, Littleton `5162`, Sterling `5502`, Golden `5596`. All use the same four visit reasons. Results from `providers.json` with the new-patient reasons:

| Provider | Office visit online | Full-body online | Slot setup |
|---|---|---|---|
| Jade Fettig, MD (Denver) | Dec 7 | Nov 17 | separate full-body slots |
| Alexandra Theriault, MD (Denver) | Nov 19 | Nov 19 | at least one shared slot |
| Matthew Coffman, MD (Lakewood) | Jan 11 | Nov 20 | separate full-body slots |
| Matthew Coffman, MD (Littleton) | Jan 6 | Jan 6 | separate full-body slots |
| Harleen Arora, MD (Lakewood) | call | Jan 21 | — |
| Emily Nesbitt, MD (Littleton) | Nov 20 | call | like Dr. Hood |
| Channing Hood, MD (Golden) | Jan 12 | call | office slots only online |

PAs and NPs vary the same way (generic slots that serve both reasons, typed slots, or call). Conclusion: USDP publishes typed full-body slots online, including Dr. Hood's (confirmed by the Nov 16 cancellation above). Her "call" means her full-body slots before the horizon are booked.

## Waitlist (2026-11-14)

Public pages cannot show whether Waitlist is on. No Colorado office's booking pages, provider search, or schedule scripts mention a waitlist. NextPatient's shared `main.js` has waitlist text-consent code, but every practice loads it. Patients join Waitlist on the booking form after picking a time, or from the confirmation text. Both are past the slot link, which automation does not open. NextPatient's Waitlist supports athenahealth.

## Questions for USDP or NextPatient

1. What is the online booking window, and can it extend to 6–12 months? (NextPatient says its athenahealth sync supports up to 12 months.)
2. Is Dr. Hood's full-body appointment type mapped to the "Full Body Skin Exam" visit reasons?
3. Is NextPatient's Waitlist product enabled for USDP Golden? It texts best-fit patients when earlier slots open and books them into the EHR.
4. Should Reserve with Google use NextPatient instead of Zocdoc for Dr. Hood's Google profile?
