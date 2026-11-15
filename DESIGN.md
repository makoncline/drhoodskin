---
name: Dr. Channing Hood
description: A refined dermatology practice system with porcelain surfaces, gallery frames, and clear blue-slate actions.
colors:
  paper: "#f7f5f2"
  stone: "#ece7e0"
  card: "#ffffff"
  ink: "#1c2529"
  ink-muted: "#56626a"
  rule: "#ddd6cc"
  frame: "#262b2d"
  action: "#26475a"
  action-hover: "#1a3442"
  action-tint: "#e4edf1"
  night: "#1d2529"
  night-muted: "#b9c2c6"
  secondary-border: "#c9c1b5"
typography:
  display:
    fontFamily: 'Marcellus, ui-serif, Georgia, serif'
    fontSize: "clamp(2.1rem, 6vw, 3.6rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  headline:
    fontFamily: 'Marcellus, ui-serif, Georgia, serif'
    fontSize: "clamp(1.85rem, 3.4vw, 2.6rem)"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  title:
    fontFamily: 'Marcellus, ui-serif, Georgia, serif'
    fontSize: "1.45rem"
    fontWeight: 400
    lineHeight: 1.25
  body:
    fontFamily: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif'
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif'
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.6
  control:
    fontFamily: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif'
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.6
rounded:
  frame: "0px"
  focus: "6px"
  navigation: "8px"
  button: "10px"
  card: "16px"
spacing:
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  7: "1.75rem"
  8: "2rem"
  10: "2.5rem"
  12: "3rem"
  14: "3.5rem"
  16: "4rem"
  24: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.card}"
    typography: "{typography.control}"
    rounded: "{rounded.button}"
    padding: "0.7rem 1.4rem"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.button}"
    padding: "0.7rem 1.4rem"
  button-secondary-hover:
    backgroundColor: "{colors.action-tint}"
  text-link:
    textColor: "{colors.action}"
  section-heading:
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
  frame:
    backgroundColor: "{colors.frame}"
    rounded: "{rounded.frame}"
    padding: "6px"
  frame-mat:
    backgroundColor: "{colors.card}"
  appointment-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "1rem"
  appointment-card-wide:
    padding: "1.75rem"
  office-status-open:
    backgroundColor: "{colors.action}"
    size: "0.625rem"
  hours-today:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.ink}"
---

# Design System: Dr. Channing Hood

## Overview

**Creative North Star: "The Porcelain Gallery"**

The system presents a premium dermatology practice through warm, light surfaces and clear clinical information. Porcelain paper is the main ground. Warm stone bands separate groups. White appointment cards and near-black gallery frames give actions and evidence distinct forms. This follows the owner's direction recorded on 2026-11-14: refined, warm, professional, and still clinical.

Marcellus gives the physician's name and headings a quiet, formal character. Source Sans 3 keeps reading and controls clear. One blue-slate action family connects booking, links, current-day emphasis, and open-office status. The portrait's sky blue remains part of the photograph, not a second interface accent. **Owner decision: no green or brass palette.** This system replaces the rejected green-and-brass design; none of its plates, lettering rules, or color roles remain normative.

**Key Characteristics:**
- Porcelain paper, warm stone bands, white cards, and slate ink.
- One blue-slate action family with a darker hover and pale state tint.
- Mixed-case Marcellus names and headings; Source Sans 3 reading and controls.
- Thin, square gallery frames with white credential and portrait mats.
- One portrait entrance, with a visible static state when reduced motion is requested.

## Colors

Warm neutrals carry the page. Blue-slate marks actions and useful state, not decoration. The frontmatter preserves the stylesheet token names; `secondary-border` records the repeated button border from component CSS.

### Primary

- **Blue-Slate Action** (`action`): primary button fill, text links, directional strokes, light-surface focus outlines, the open-status dot, and the Today label.
- **Deep Blue-Slate Hover** (`action-hover`): primary button hover fill, with white text retained.
- **Pale Blue-Slate Tint** (`action-tint`): today's hours row, secondary-button hover fill, and text selection.

### Neutral

- **Porcelain Paper** (`paper`): main page ground and translucent header.
- **Warm Stone** (`stone`): section bands and quiet navigation hover surfaces.
- **Card White** (`card`): appointment cards, white mats, secondary controls, primary-button lettering, and footer links.
- **Slate Ink** (`ink`) and **Quiet Slate** (`ink-muted`): primary and supporting reading text on light surfaces.
- **Stone Rule** (`rule`): thin list, table, section, and card dividers.
- **Stone Button Border** (`secondary-border`): the secondary control's resting border.
- **Gallery Frame** (`frame`): near-black edges around the portrait, credentials, and map.
- **Night Slate** (`night`) and **Quiet Night Lettering** (`night-muted`): the dark footer and its supporting text. The footer is a neutral closing field, not an additional accent family.

### Named Rules

**The One Action Family Rule.** Use blue-slate for actions and useful state. Keep sky blue inside the portrait; do not introduce green or brass interface colors.

**The Surface Focus Rule.** Use the action color for focus on light surfaces and white for focus on the dark footer. Set the focus context on the surface that contains the control.

## Typography

**Display Font:** Marcellus, with ui-serif, Georgia, and serif fallbacks. The build loads the regular weight locally.

**Body Font:** Source Sans 3, with ui-sans-serif, system-ui, and sans-serif fallbacks. The build loads regular, semibold, and bold weights locally.

**Character:** Marcellus gives names, headings, credential inscriptions, and patient quotations a measured character. Source Sans 3 carries descriptions, labels, addresses, hours, and controls. Headings balance their lines; paragraphs use pretty wrapping.

### Hierarchy

- **Display:** the fluid `display` role names the physician. Use mixed case, normal weight, and slightly tight tracking. It is plain lettering on paper, not a plate.
- **Headline:** the fluid `headline` role names major sections. Keep the same mixed-case treatment when a heading wraps.
- **Title:** the `title` role heads appointment cards. It increases to (1.6rem) at the small breakpoint, with the same tight line height.
- **Body:** use the `body` role for reading. Many paragraphs use relaxed line height (1.625). Expanded question answers have a maximum measure of (65ch). The hero lede grows from (1rem) to (1.05rem), then (1.25rem) across the small and medium breakpoints.
- **Label:** the `label` role covers captions, sources, and compact supporting text. Some captions use a snug line height (1.375). Bold identifying words, not the full caption. Appointment explanations use (0.98rem), with the main explanation growing to (1.02rem) at the small breakpoint.
- **Control:** use semibold Source Sans 3. Standard buttons inherit the body size and line height; header controls use (0.95rem). Strong text inside explanations uses the loaded bold weight (700).
- **Credential inscription:** regular Marcellus, centered in a white mat. Standard names grow from (1rem) to (1.05rem); the featured name grows from (1.25rem) to (1.7rem) at the medium breakpoint. Patient quotations grow from (1.35rem) to (1.6rem).

### Named Rules

**The Mixed-Case Reading Rule.** Use mixed-case Marcellus for names and display headings, and Source Sans 3 for reading and controls. Do not add eyebrows, kickers, uppercase plates, or wide inscription tracking.

## Layout

Use a centered shell with width `min(72rem, calc(100% - 2.5rem))`. It leaves at least (1.25rem) on each side. The build uses the standard Tailwind small (40rem), medium (48rem), and large (64rem) thresholds. Anchor scroll padding is (5.5rem), to clear the sticky header.

Major sections use vertical padding of (4rem), increasing to (6rem) at the medium breakpoint. Related content uses the recorded spacing steps. Two-column reading and office sections commonly use gaps of (3rem–4rem) and stack on narrow screens. Thin rules separate list items without adding a card around each group.

The hero uses explicit grid areas. On narrow screens, the name spans the width; a compact portrait sits beside the lede; the appointment card follows at full width. The portrait column grows from (5.5rem) to (8rem) at the small breakpoint. At the medium breakpoint, the portrait becomes a right column between (16rem) and (21rem), beside the name, lede, and card. This is the built hero arrangement, not a required layout for every future surface.

Credential groups use unequal frame sizes: two columns on narrow screens (the featured credential spans both; the rest pair two per row) and twelve tracks at the medium breakpoint. Featured credentials span more tracks and can be taller. Preserve variation and clear gaps instead of making every object an identical card.

The appointment card stacks actions and explanations on narrow screens. At the small breakpoint, its main action and explanation form a row, and its alternatives form two columns. Navigation is compact: phone text appears from the small breakpoint, the header booking action from medium, and the location link from large. The phone control retains an accessible name when icon-only.

The mobile action bar uses a light translucent surface and safe-area bottom padding. It slides out of view (no slide when reduced motion is requested) and becomes inert when an appointment card intersects the viewport. Main and footer content retain bottom clearance (6rem) below the medium breakpoint.

## Elevation & Depth

Depth comes from tonal fields, thin dark frame edges, white mats, and soft cast shadows. Frames and appointment cards have distinct shadows. Buttons are flat at rest and on hover. Most reading groups remain on the page ground rather than becoming floating cards.

### Shadow Vocabulary

- **Gallery frame:** `0 1px 2px rgb(28 37 41 / 0.12), 0 18px 32px -20px rgb(28 37 41 / 0.45)`.
- **Mat edge:** `inset 0 0 0 1px #ebe6df`; a fine warm-neutral edge inside a white mat, not a colored fillet.
- **Appointment card:** `0 1px 2px rgb(28 37 41 / 0.06), 0 24px 48px -28px rgb(28 37 41 / 0.35)`.
- **Mobile action bar:** `0 -8px 24px -16px rgb(28 37 41 / 0.35)`.

### Named Rules

**The Evidence Frame Rule.** Frame the portrait, credentials, and map with a thin near-black edge. Keep reading lists and appointment cards outside that frame language.

## Shapes

Gallery frames and their contents have square corners. The portrait and map frame edge is (6px). Credential frames use the quieter edge (3px) with a softer shadow, so credentials support the portrait instead of competing with it. The portrait edge reduces to (3px) below the medium breakpoint. Its white mat uses padding of (6%), increasing to (8%) at the medium breakpoint. Credential mats use fixed horizontal padding and more vertical space. The map uses the dark frame edge directly around the embed; the build has no separate map-mat wrapper.

Appointment cards have soft corners using `rounded.card`. Buttons use `rounded.button`, not pill corners. Navigation hit areas use `rounded.navigation`. Focus outlines use `rounded.focus`. Status dots are circular. Fine straight rules structure quotations, lists, disclosures, and tables. Small stroke SVGs support actions; do not substitute text glyph icons.

## Components

### Buttons

Clear, soft-cornered controls distinguish the primary booking path from alternatives.

- **Primary:** action fill, white text, semibold reading type, and the frontmatter padding. Default minimum height is (3rem). Header variants reduce to (2.75rem) and use compact text and padding. Appointment-card primary controls use horizontal padding of (1.5rem).
- **Hover / active:** the primary fill darkens on hover. Press moves the primary control down (1px). Background and press transitions use (160ms ease-out). There is no button shadow.
- **Secondary:** white fill, slate text, and a stone border (1px). Hover changes the border to action and the fill to action tint. Border and background transitions use (160ms ease-out). Do not make secondary controls transparent or dark-filled at rest.
- **Text links:** semibold action text with an underline (1px), offset (0.2em). Underline color changes from a 35% current-color mix to full current color over (160ms ease-out). Footer links instead use white text and a 40% white underline, becoming fully white on hover.
- **Focus:** an outline (2px), offset (3px), with the color set by the immediate surface. The focus shape has its own radius; it does not replace the control's resting shape.

### Cards / Containers

The appointment card is a white reading and action surface, not a framed certificate.

- **Shape and depth:** use the card corner and appointment shadow.
- **Internal padding:** `appointment-card` on narrow screens and `appointment-card-wide` from the small breakpoint.
- **Structure:** a mixed-case Marcellus title; a blue-slate primary action and outcome explanation; then a thin stone rule above white secondary alternatives. Keep the distinction between an open-time booking path, a callback request, and a phone call explicit.
- **Focus context:** set the light-surface action outline within the card.
- **Reading:** use quiet slate for explanations and slate ink for selected strong phrases. Do not reduce the whole card to labels or icon tiles.

### Navigation

The sticky header uses paper at 90% opacity, a stone lower rule, and a medium backdrop blur. Its shell has a minimum height of (4rem). A mixed-case Marcellus name sits above a Source Sans 3 location line. Phone and location controls have rounded hit areas and warm-stone hover fills. The mobile bottom bar uses white at 95% opacity, a top rule, a soft upward shadow, and the normal primary and secondary controls.

The dark footer uses night slate, quiet night lettering, and white links. Its focus outline is white. Do not carry the footer's dark palette into the header or mobile bar.

### Gallery Frames

The portrait and credential frames combine a thin dark edge, white interior, and soft frame shadow. Credential inscriptions are centered and vary in scale with the frame size. Supporting text stays in Source Sans 3. The map uses the same outer edge without the credential mat treatment.

The portrait is the only staged entrance. `portrait-settle` runs once for (900ms), using `cubic-bezier(0.16, 1, 0.3, 1)` and a `both` fill mode. It starts (14px) below the final position with a smaller shadow, then settles to the normal frame. Apply it only within `prefers-reduced-motion: no-preference`. The default portrait remains visible without animation. Control-state transitions are not additional staged entrances.

### Ruled Disclosures and Lists

Use native disclosures with semibold reading-type labels, thin stone rules, and small stroke chevrons on the right. The chevron rotates (180deg) when open. Service summaries have a minimum height of (3rem); question summaries have a minimum height of (3.5rem). Answers use quiet slate beneath the label. Preserve native keyboard operation and the surface focus outline. Form links use similarly ruled rows with a small action-colored outward arrow.

### Office Status and Hours

Office status is an inline dot and text, not a colored badge. The dot is (0.625rem), with a gap of (0.5rem). The open-state dot uses action. Closed and initial states use the current text color at 60% and 40% opacity respectively. Keep the state in words and emphasize the state phrase; never rely on color alone. Status updates once per minute after hydration.

Hours use a simple ruled table with tabular numerals. Today's row has action tint and an action-colored Today label. Other rows remain neutral. The current-day row also uses `aria-current="date"`.

## Do's and Don'ts

### Do:
- **Do** use porcelain paper and warm stone to group content, with white cards for appointment actions.
- **Do** use the single blue-slate family for actions, links, current-day emphasis, and open status.
- **Do** keep Marcellus names and headings in mixed case and use Source Sans 3 for reading and controls.
- **Do** use thin near-black gallery edges and white mats for the portrait and credentials.
- **Do** set focus to action on light surfaces and white on the dark footer.
- **Do** keep the portrait visible when its single entrance is disabled.
- **Do** retain clear action labels, outcome explanations, native disclosures, and text status.

### Don't:
- **Don't** restore a green or brass palette; the owner rejected it.
- **Don't** promote the portrait's sky blue into a second interface accent.
- **Don't** add eyebrows, kickers, uppercase nameplates, or widely tracked display lettering.
- **Don't** make secondary controls dark, transparent, or pill-shaped at rest.
- **Don't** turn every reading group into a floating card or an identical gallery frame.
- **Don't** add staged entrances beyond the portrait's single settle.
- **Don't** replace stroke SVGs with glyph icons or communicate office state by color alone.
