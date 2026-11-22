---
name: web-visual-design
description: Create and refine polished, distinctive, production-ready web interfaces using intentional layout, typography, spacing, imagery, interaction, and design systems without relying on generic AI styling or prescribing a fixed color palette.
---

# Web Visual Design Skill

## Purpose

Use this skill when creating, redesigning, or refining a website's visual interface. The goal is to produce interfaces that feel intentionally art-directed, coherent, usable, and production-ready—not like a generic AI-generated template.

The visual direction is informed by modern editorial websites and premium creative platforms: confident typography, strong composition, deliberate whitespace, varied layouts, purposeful imagery, restrained details, and clear hierarchy.

**This is a visual-design method, not a fixed theme.** Do not copy another website's brand identity, color palette, exact layout, assets, or signature elements. In particular, do not automatically use a dark background, neon green, oversized hero text, or any color scheme from a reference. Adapt the visual language to the actual product, audience, brand, content, and existing project.

## Core outcome

Every design decision should improve at least one of these qualities:

1. **Clarity:** users can understand the page and its next action.
2. **Hierarchy:** the most important content attracts attention first.
3. **Identity:** the interface has a recognisable visual character.
4. **Consistency:** related components behave and look related.
5. **Usability:** the interface works across devices, input methods, and accessibility needs.
6. **Craft:** spacing, alignment, typography, states, and details feel deliberate.

Do not add visual decoration merely to make a page look more complex.

---

# 1. Non-negotiable design principles

## 1.1 Composition before effects

Make the layout interesting before adding shadows, gradients, blur, glows, borders, or animation.

Prefer, in this order:

- A clear content hierarchy.
- A deliberate grid and alignment system.
- Varied but coherent section composition.
- Strong typography and image selection.
- Thoughtful spacing and rhythm.
- Subtle surface treatments.
- Decorative effects only when they serve a clear purpose.

If a page feels flat, first inspect its hierarchy, proportions, density, contrast, and imagery. Do not immediately add a glow or gradient.

## 1.2 One visual identity per product

Before styling, identify the product's visual character. Examples include editorial, technical, playful, institutional, premium, utilitarian, cultural, or commerce-focused. These are possible directions, not preset themes.

The interface should have a consistent visual language across pages, while allowing different page types to have different compositions.

## 1.3 Distinction without randomness

Avoid making every section different just to appear creative. Variation must be controlled by a consistent grid, spacing scale, typography system, color roles, and component language.

## 1.4 Content is part of the design

Do not use arbitrary filler copy, meaningless labels, fake statistics, or unrelated imagery to fill empty space. Work with the real content and product purpose. When content is unavailable, use realistic neutral placeholders and make their placeholder status clear.

## 1.5 Restraint is intentional

Not every element needs a card, border, background panel, icon, badge, shadow, or animation. Use visual emphasis selectively so important elements remain important.

---

# 2. Mandatory workflow

Follow this workflow before making substantial UI changes.

## Step 1 — Inspect the project

Read the existing codebase before editing. Identify:

- Framework, routing structure, rendering approach, and build tooling.
- Existing page layouts and shared components.
- Styling approach: CSS, CSS Modules, Tailwind, Sass, CSS-in-JS, component library, or a combination.
- Existing design tokens, theme files, typography, icons, and asset conventions.
- Existing brand colors and any logo or visual identity assets.
- Responsive breakpoints and layout patterns.
- Current interactions, loading states, error states, and form behavior.
- Tests, lint rules, accessibility conventions, and formatting rules.

Search for existing components and tokens before creating replacements. Do not introduce a second design system when one already exists.

## Step 2 — Understand the page and user goal

Determine:

- What is this page for?
- Who is using it?
- What is the primary user task?
- What information is most important?
- What is the primary action?
- What content must be visible immediately?
- What states and edge cases does the page need?

Use the product context to choose the visual direction. A finance dashboard, creative portfolio, travel booking site, school portal, and editorial landing page should not all look alike.

## Step 3 — Establish the visual direction

Write a short internal design brief before implementation. It should define:

- Visual personality in 3–5 adjectives.
- Layout strategy (for example, editorial grid, compact application shell, or image-led landing page).
- Typography roles.
- Color roles based on the existing brand or product context.
- Surface and border treatment.
- Image/art direction.
- Interaction and motion tone.

Do not choose colors by copying a screenshot or reference brand. If the project already has a coherent palette, preserve it. If it has no clear palette, derive a restrained palette from the product's identity and content, then centralize it as tokens. Do not scatter arbitrary hex values through components.

## Step 4 — Design the hierarchy and layout

Plan the page from large structure to small detail:

1. Page regions and navigation.
2. Primary content hierarchy.
3. Grid, columns, max-width, and alignment.
4. Section composition and spacing rhythm.
5. Component structure.
6. Typography scale.
7. Color and surface roles.
8. Borders, shadows, imagery, and decorative details.
9. Interaction states and motion.

Do not start by polishing individual buttons while the overall page composition is unresolved.

## Step 5 — Implement incrementally

Build or refine the page in coherent sections. Reuse existing components and conventions. Keep the implementation responsive and semantic from the beginning rather than treating mobile as a later patch.

Preserve application behavior unless the task explicitly requires changing it. Visual redesign is not permission to remove features, alter business logic, rename API contracts, or replace working flows with static mockups.

## Step 6 — Verify the result

Inspect the actual rendered page at relevant viewport sizes. Do not rely only on reading the code.

Check visual hierarchy, clipping, overflow, alignment, text wrapping, image crops, component states, keyboard access, and responsive behavior. Fix the root cause rather than applying one-off offsets that break other viewports.

---

# 3. Design system rules

## 3.1 Color system: semantic, not prescriptive

Never assume a fixed palette or mode. The site may be light, dark, colorful, monochrome, or brand-led.

Define semantic roles instead of naming tokens after a specific hue:

- `--color-bg`: main page background.
- `--color-surface`: standard component surface.
- `--color-surface-raised`: elevated or layered surface, when needed.
- `--color-text`: primary text.
- `--color-text-muted`: secondary text.
- `--color-border`: default divider and outline.
- `--color-primary`: primary brand/action color.
- `--color-primary-contrast`: readable text/icon color on primary.
- `--color-accent`: optional secondary emphasis color.
- `--color-success`, `--color-warning`, `--color-danger`, `--color-info`: status roles.

Rules:

- Use the existing brand palette when it is coherent and accessible.
- Choose colors based on brand, audience, content, and context—not trend alone.
- Keep semantic status colors distinct from decorative accent colors.
- Ensure text and interactive controls have sufficient contrast.
- Avoid using color as the only way to communicate status.
- Avoid introducing a new accent color for every section.
- Use gradients only when they reinforce brand identity or communicate a meaningful visual layer.
- Keep gradients local and controlled; do not use them as a default background for every card, heading, or button.
- Check color behavior in all supported themes, if the project has more than one.

## 3.2 Typography system

Typography should establish hierarchy and personality without sacrificing readability.

Define roles such as:

- Display / hero.
- Page title.
- Section heading.
- Component heading.
- Body.
- Supporting text.
- Metadata / caption.
- Numeric or code content, where appropriate.

Rules:

- Use no more typefaces than the product needs. One well-chosen family with a considered weight range is often enough.
- Pair typefaces only when the contrast is intentional and consistent.
- Use responsive type sizes with `clamp()` where helpful.
- Keep body copy comfortable to read; avoid excessively small text.
- Set line-height according to role: tighter for large display headings, more open for paragraphs.
- Control paragraph measure; long lines reduce readability.
- Use weight, size, spacing, and position to form hierarchy—not color alone.
- Avoid making every heading extra-bold or oversized.
- Do not use decorative/script fonts for functional labels or long text.
- Check real text wrapping, including long names, translations, and numeric values.

## 3.3 Spacing and rhythm

Create a consistent spacing scale and apply it across the interface. Use the project's existing scale when available.

A possible neutral scale is based on a 4px or 8px rhythm, but do not force it if the project already uses another coherent system.

Rules:

- Group related elements more closely than unrelated elements.
- Use larger spacing to distinguish sections and content groups.
- Align content to a consistent grid.
- Avoid arbitrary margin values used to fix individual screenshots.
- Maintain consistent padding within similar components.
- Let whitespace establish hierarchy; do not fill every empty area with decoration.
- Avoid both cramped density and excessive empty space that hides important information.

## 3.4 Layout and grid

Use a layout that matches the page's purpose. Useful patterns include:

- Editorial grid for content-led and brand-led pages.
- Asymmetric grid for visual storytelling and selected feature areas.
- Split layout for text-plus-visual storytelling.
- Consistent card grid for comparable items.
- Sidebar and content shell for complex applications.
- Full-width image or feature bands for deliberate focal moments.
- Narrow reading column for long-form content.

Rules:

- Establish a predictable container width and alignment system.
- Use CSS Grid and Flexbox according to the relationship between elements.
- Use asymmetry with intention; retain alignment anchors.
- Vary section composition where it improves narrative and hierarchy.
- Do not use the same centered heading plus three cards pattern for every section.
- Do not turn every content block into a card.
- Avoid unnecessary nesting of cards inside cards.
- Keep primary actions near the content or decision they relate to.
- Prevent horizontal overflow at narrow widths.

## 3.5 Surfaces, borders, shadows, and depth

Use elevation only when it helps users understand layering or interaction.

Preferred baseline:

- Clear surface/background contrast.
- Subtle, consistent borders when separation is needed.
- Minimal shadow for genuinely elevated elements such as menus, popovers, or dialogs.
- Consistent radius scale based on the product's character.

Avoid:

- Strong shadow on every card.
- Neon glow around ordinary components.
- Multiple stacked shadows without a clear layering reason.
- Glassmorphism as a default treatment.
- Large blur fields behind unrelated content.
- Random border colors that do not map to the design system.
- Excessively rounded controls when the rest of the product is restrained.

Use shadows and blur sparingly. A flat interface can still feel premium when spacing, typography, and composition are strong.

## 3.6 Shape and iconography

- Use one consistent icon family whenever possible.
- Keep icon size and stroke weight consistent within the same context.
- Use icons to clarify actions or status, not to decorate every heading.
- Prefer familiar, recognisable icons for common actions.
- Pair ambiguous icons with visible labels or accessible names.
- Do not mix filled, outline, emoji, and custom icon styles randomly.
- Use a consistent radius language for cards, fields, buttons, and overlays.

---

# 4. Composition and anti-generic design

## 4.1 Build a focal point

Each page or section should have a clear focal point. This may be a headline, key metric, product image, data visualisation, featured item, or primary action.

Use size, position, contrast, whitespace, and imagery to create emphasis. Do not make every item equally loud.

## 4.2 Create visual rhythm

Alternate between content densities and compositions where appropriate:

- Text-led section.
- Image-led section.
- Split section.
- Data or feature section.
- Quiet transition or whitespace.

Do not alternate mechanically. Follow the content's natural story.

## 4.3 Avoid common AI-generated patterns

Do not apply these patterns by default:

- A giant gradient headline on every page.
- A centered hero followed by three identical glowing cards.
- Repeated pill badges for ordinary labels.
- Random blobs, floating orbs, sparkles, grid backgrounds, and decorative circles.
- Glass cards on top of a blurred gradient background.
- Excessively rounded cards and buttons everywhere.
- Icons inside colored circles for every feature.
- Unnecessary metrics, fake testimonials, or invented customer logos.
- A generic dashboard layout when the product does not need one.
- Repeated sections with identical heading, paragraph, and card arrangements.
- Arbitrary animation on every element.

These patterns are not forbidden in every context. Use one only when it fits the product's identity and has a clear design reason. Never combine them all into a default template.

## 4.4 Use references intelligently

When a reference website or screenshot is provided:

- Identify the underlying principles: hierarchy, image treatment, layout, density, rhythm, typography, and interaction.
- Adapt those principles to the current product.
- Do not copy its brand colors, logo, wording, illustrations, distinctive assets, or exact composition unless the user explicitly owns and requests those elements.
- Do not assume the reference's visual style is appropriate for every page.
- Preserve the project's own brand and content requirements.

---

# 5. Imagery and media direction

Images should contribute meaning, atmosphere, or hierarchy.

Rules:

- Prefer project-owned, licensed, or otherwise approved assets.
- Use images relevant to the actual content and audience.
- Maintain a consistent art direction: lighting, subject matter, color treatment, and photographic or illustrative style.
- Crop intentionally with `object-fit` and `object-position`.
- Define appropriate aspect ratios for repeated media types.
- Do not stretch images or use unrelated stock photography just to fill a layout.
- Avoid unnecessary overlays. Add an overlay only when text contrast or a deliberate treatment requires it.
- Provide meaningful alt text for informative images and empty alt text for purely decorative images.
- Prevent layout shift by defining image dimensions or aspect ratios.
- Use responsive image sizing and appropriate formats supported by the project.
- Respect existing asset pipelines and content management conventions.

If image assets are missing, do not invent a fake visual identity with random images. Use a restrained placeholder treatment and explain which assets are needed when reporting the work.

---

# 6. Component design and states

Components must be designed as systems, not isolated screenshots.

For each interactive component, account for the states that apply:

- Default.
- Hover (for hover-capable devices).
- Focus-visible.
- Active / pressed.
- Disabled.
- Loading.
- Success.
- Error.
- Empty.
- Selected / expanded, where relevant.

## Buttons

- Make the primary action visually distinct from secondary and tertiary actions.
- Use clear action labels; avoid vague labels such as "Click here".
- Keep button height, padding, radius, and icon spacing consistent.
- Provide visible keyboard focus.
- Do not make every button a high-emphasis primary button.
- Avoid oversized buttons unless the context calls for them.

## Forms

- Use persistent labels; placeholders are not substitutes for labels.
- Associate validation messages with the relevant field.
- Show required and optional states clearly.
- Make errors specific and actionable.
- Preserve entered values when validation fails.
- Ensure controls are usable with keyboard and touch.
- Avoid relying on color alone to communicate validation.

## Cards and lists

- Use cards when content items are distinct, actionable, or need grouping.
- Use open layouts, dividers, or typography instead when cards add unnecessary visual weight.
- Keep comparable cards consistent in structure.
- Do not force equal heights if doing so harms content flow; use a deliberate grid strategy.
- Make interactive areas and affordances clear.

## Navigation

- Make the current location or active section clear.
- Keep navigation labels understandable.
- Do not hide essential navigation behind an unfamiliar icon.
- Support keyboard navigation and appropriate expanded states.
- On small screens, choose a mobile navigation model that suits the information architecture.

## Data-heavy interfaces

- Prioritise scanability, alignment, and clear labels.
- Align numeric values consistently.
- Use tabular numerals where useful.
- Keep tables usable on narrow screens; do not simply shrink text until it becomes unreadable.
- Provide empty, loading, error, and no-results states.
- Use chart colors consistently and avoid decorative chart effects that obscure data.

---

# 7. Responsive design

Responsive design is a change in composition, not merely a smaller desktop layout.

Test at minimum:

- Small mobile: approximately 320–375 CSS px.
- Typical mobile: approximately 390–430 CSS px.
- Tablet: approximately 768–1024 CSS px.
- Desktop: approximately 1280–1440 CSS px.
- Wide desktop where the project needs it.

Rules:

- Use fluid sizing where appropriate and controlled breakpoints where the composition must change.
- Reorder content only when the reading or task sequence remains logical.
- Reduce decorative complexity on small screens before reducing readability.
- Ensure touch targets are comfortably usable.
- Avoid fixed widths that cause overflow.
- Check navigation, dialogs, dropdowns, tables, forms, and media on mobile.
- Keep headings from overflowing or wrapping into awkward fragments.
- Ensure important content and actions are not pushed too far below the fold.
- Respect safe areas where relevant.

Do not treat a page as responsive simply because the CSS contains media queries.

---

# 8. Motion and interaction

Motion should communicate state, cause and effect, continuity, or feedback.

Good uses include:

- Short transitions for hover and focus feedback.
- Menu and dialog entrance/exit.
- Expand/collapse feedback.
- A restrained image hover treatment.
- Loading indicators that clarify progress.
- Subtle page transitions when they improve orientation.

Rules:

- Keep motion short and purposeful.
- Use consistent easing and duration tokens.
- Avoid animating large numbers of unrelated elements at once.
- Avoid infinite motion unless it communicates ongoing activity.
- Avoid cursor-following glow, excessive parallax, scroll hijacking, and attention-seeking effects by default.
- Do not make essential information dependent on animation.
- Support `prefers-reduced-motion` and provide a reduced-motion experience.
- Ensure motion does not cause layout shifts or interfere with controls.

A useful principle: the interaction should feel responsive, not theatrical.

---

# 9. Accessibility and usability requirements

Treat accessibility as part of visual quality, not a separate final pass.

- Use semantic HTML elements and landmarks.
- Maintain logical heading order.
- Ensure sufficient contrast for text, icons, borders, and focus indicators.
- Provide visible `:focus-visible` states.
- Ensure all interactive functionality is keyboard-accessible.
- Give controls accessible names.
- Use labels and descriptions for form fields.
- Do not communicate information through color alone.
- Provide alt text appropriate to image purpose.
- Support zoom and text resizing without content loss.
- Respect reduced-motion preferences.
- Ensure dialogs and menus manage focus correctly.
- Use correct button and link semantics; do not use clickable `div` elements when a button or link is appropriate.

Do not reduce accessibility to a plugin score. Manually inspect important interaction paths.

---

# 10. Technical implementation standards

- Follow the framework and architecture already used in the repository.
- Reuse existing components, utilities, tokens, and dependencies where appropriate.
- Do not install a new UI library or animation package without a clear need.
- Avoid duplicating global styles or introducing conflicting resets.
- Prefer reusable tokens and component variants over scattered one-off values.
- Keep components focused and avoid turning every small element into an abstraction.
- Keep styling maintainable and scoped according to project conventions.
- Avoid excessive `!important`, deeply nested selectors, and fragile positional selectors.
- Avoid hardcoded pixel offsets used to patch a single viewport.
- Keep content and presentation appropriately separated.
- Preserve routing, data fetching, API contracts, validation, permissions, and business logic.
- Do not replace functional behavior with static demonstration content.
- Do not remove error handling, loading behavior, or empty states during redesign.
- Use the project's existing lint, type-check, test, and build commands when available.

When creating tokens, centralise them in the existing theme or styling entry point. Example token names are semantic guidance only; adapt naming to the project.

---

# 11. Page-specific guidance

Use these as adaptable patterns, not rigid templates.

## Landing pages

- Make the value proposition clear early.
- Give the hero one primary focal point and one primary action.
- Use imagery only when it reinforces the product story.
- Establish trust with real evidence, not invented metrics or testimonials.
- Vary section layouts according to the content narrative.
- Keep calls to action clear and appropriately repeated.

## Dashboards and admin applications

- Prioritise information density, navigation, and task efficiency over dramatic editorial effects.
- Establish a stable application shell.
- Use typography and spacing to distinguish metrics, labels, filters, and data.
- Make tables, forms, and states highly legible.
- Keep decorative visuals secondary to operational content.

## E-commerce

- Prioritise product imagery, price, availability, variants, and purchase actions.
- Keep product cards consistent enough for comparison.
- Make filters, sorting, cart feedback, and checkout states obvious.
- Do not obscure product information with decorative overlays.
- Ensure mobile browsing and purchase actions are straightforward.

## Portfolio and creative websites

- Let selected work lead the composition.
- Use a clear project-image hierarchy and consistent presentation of project details.
- Make the creator's role, process, and outcomes easy to find.
- Use expressive typography and asymmetric layouts selectively.
- Avoid decorative motion that competes with the work itself.

## Editorial and content websites

- Prioritise reading comfort and typographic rhythm.
- Use a controlled reading width and clear heading structure.
- Keep metadata visually secondary.
- Treat images, captions, quotations, and pull-outs as editorial elements.
- Do not interrupt long-form reading with excessive cards or calls to action.

---

# 12. Visual quality assurance checklist

Before considering the task complete, verify the following.

## Identity and hierarchy

- [ ] The visual direction fits the product and audience.
- [ ] Existing brand identity has been preserved or intentionally refined.
- [ ] The page has a clear focal point.
- [ ] Typography hierarchy is obvious and readable.
- [ ] The layout has deliberate alignment and spacing.
- [ ] Section compositions support the content rather than repeat mechanically.

## Visual restraint

- [ ] No fixed or copied reference palette has been imposed without reason.
- [ ] Gradients, shadows, blur, and glow are used only with purpose.
- [ ] Not every element is inside a card.
- [ ] Decorative icons, badges, and shapes are not excessive.
- [ ] Images have a coherent art direction and useful crops.
- [ ] Empty space is intentional, not accidental.

## Interaction and accessibility

- [ ] Buttons, links, forms, menus, and dialogs have appropriate states.
- [ ] Keyboard focus is visible.
- [ ] Contrast and text readability are sufficient.
- [ ] Controls have accessible names and labels.
- [ ] Reduced-motion preferences are respected.
- [ ] Empty, loading, error, and disabled states are considered.

## Responsive behavior

- [ ] Small mobile has been checked.
- [ ] Tablet has been checked where relevant.
- [ ] Desktop has been checked.
- [ ] No unintended horizontal overflow exists.
- [ ] Text, images, navigation, and actions adapt intentionally.

## Engineering integrity

- [ ] Existing features and business logic still work.
- [ ] Existing project conventions and components have been reused.
- [ ] No unnecessary dependencies were added.
- [ ] No fragile viewport-specific patches were introduced.
- [ ] Relevant checks, tests, or build commands were run where available.

---

# 13. How to report completed work

When finished, provide a concise implementation summary containing:

1. **Design direction:** what visual approach was used and why it fits the product.
2. **Key changes:** the most important layout, typography, component, and responsive improvements.
3. **Files changed:** the relevant files or components.
4. **Behavior preserved:** confirm which existing interactions and flows were retained, based on actual verification.
5. **Validation:** viewports inspected and checks/tests/build commands actually run.
6. **Known gaps:** missing assets, untested states, or issues that remain.

Never claim that a page was tested, built, or verified unless the relevant check was actually performed.

---

# 14. Final decision rule

When choosing between two visual treatments, prefer the one that:

- Makes the content easier to understand.
- Better reflects the product's identity.
- Creates stronger hierarchy with fewer decorative effects.
- Is more consistent with the existing design system.
- Works better across devices and accessibility needs.
- Is simpler to maintain.

**The target is not a website that looks more decorated. The target is a website that looks more considered.**
