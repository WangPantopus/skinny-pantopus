// The curated half of the token build: order, names, usage notes, and how
// each token maps across platforms. Values are NOT kept here when a platform
// source has them; lib/tokens.mjs reads those from globals.css, the theme
// package, the iOS asset catalog and Color.kt. Curated type styles carry a
// `source` needle (file + snippet) that the build re-checks, so a changed
// component shows up as a drift warning.
//
// Usage notes may embed {{fg|ground}}; the build replaces it with the
// measured contrast in every theme.

export const THEMES = [{"id": "light", "name": "Light"}, {"id": "dark", "name": "Dark"}, {"id": "dark-ios", "name": "Dark · iOS"}];

export const COLOR_NOTE = 'Light is shared by web, iOS and Android (AA-corrected Sept 2026). Dark is the web palette (prefers-color-scheme). Dark · iOS is the iOS asset catalogue; Android is light-only in practice and its dark Material scheme uses the same neutrals. Base semantic and identity tokens are label inks; -solid tokens are the fills white text sits on.';

// web: a CSS custom property of the same name in globals.css (light in :root,
//      dark in the prefers-color-scheme block).
// ios: the Theme.Color token (its asset-catalog colorset gives light + dark).
// android: the PantopusColors token (light only; cross-checked).
// alias: another token of this file.

export const COLORS = [
  { name: 'app-bg', web: true, ios: 'appBg', android: 'appBg', usage: 'Page ground behind every screen (body). Cards sit on it in app-surface. iOS/Android: appBg.' },
  { name: 'app-surface', web: true, ios: 'appSurface', android: 'appSurface', usage: 'Cards, sheets, top bar, inputs: the default container fill. iOS/Android: appSurface.' },
  { name: 'app-surface-raised', web: true, ios: 'appSurfaceRaised', android: 'appSurfaceRaised', usage: 'Slightly lifted panels and table or list headers inside a card. iOS/Android: appSurfaceRaised.' },
  { name: 'app-surface-sunken', web: true, ios: 'appSurfaceSunken', android: 'appSurfaceSunken', usage: 'Recessed wells: key-fact panels, nudge rows inside a card, neutral chips, icon discs, shimmer base. iOS/Android: appSurfaceSunken.' },
  { name: 'app-surface-muted', web: true, ios: 'appSurfaceMuted', android: 'appSurfaceMuted', usage: 'Quiet section bands and inactive filter pills. iOS/Android: appSurfaceMuted.' },
  { name: 'app-border', web: true, ios: 'appBorder', android: 'appBorder', usage: 'The 1px hairline on every card, input and divider (decorative: separation, not meaning). iOS/Android: appBorder.' },
  { name: 'app-border-strong', web: true, ios: 'appBorderStrong', android: 'appBorderStrong', usage: 'Emphasized outlines: unchecked checkboxes, hovered inputs, ring-app. iOS/Android: appBorderStrong.' },
  { name: 'app-border-subtle', web: true, ios: 'appBorderSubtle', android: 'appBorderSubtle', usage: 'Faint separators inside modals and dense lists. iOS/Android: appBorderSubtle.' },
  { name: 'app-text', web: true, ios: 'appText', android: 'appText', usage: 'Primary text and titles. On app-surface {{app-text|app-surface}}; on app-bg {{app-text|app-bg}}; on app-surface-sunken {{app-text|app-surface-sunken}}. iOS/Android: appText.' },
  { name: 'app-text-strong', web: true, ios: 'appTextStrong', android: 'appTextStrong', usage: 'Field labels, ghost-button labels, nudge copy. On app-surface {{app-text-strong|app-surface}}; on app-surface-sunken {{app-text-strong|app-surface-sunken}}. On web dark it is lighter than app-text by design. iOS/Android: appTextStrong.' },
  { name: 'app-text-secondary', web: true, ios: 'appTextSecondary', android: 'appTextSecondary', usage: 'Subtitles, metadata, overlines, inactive tabs. On app-surface {{app-text-secondary|app-surface}}; on app-surface-sunken {{app-text-secondary|app-surface-sunken}}; on app-surface-raised {{app-text-secondary|app-surface-raised}}. AA-corrected in Sept 2026 (was #6B7280). iOS/Android: appTextSecondary.' },
  { name: 'app-text-muted', web: true, ios: 'appTextMuted', android: 'appTextMuted', usage: 'Captions, "as of" stamps, placeholders, chevrons: the quietest readable tier. On app-surface {{app-text-muted|app-surface}}; on app-surface-sunken {{app-text-muted|app-surface-sunken}}; on app-surface-raised {{app-text-muted|app-surface-raised}}. AA-corrected (was #9CA3AF). iOS/Android: appTextMuted.' },
  { name: 'app-text-inverse', web: true, ios: 'appTextInverse', android: 'appTextInverse', usage: 'Text on a dark or saturated fill. Web flips it to ink in dark mode; iOS keeps white. For text on the -solid fills and primary buttons use literal white (text-white), as the components do. iOS/Android: appTextInverse.' },
  { name: 'app-hover', web: true, ios: 'appHover', android: 'appHover', usage: 'Hover and pressed wash on rows, ghost buttons and icon buttons. iOS/Android: appHover.' },
  { name: 'color-primary-25', ios: 'primary25', android: 'primary25', usage: 'Unread-notification row tint, between app-surface and primary-50. Native only (primary25); the web has no 25 step.' },
  { name: 'color-primary-50', web: true, ios: 'primary50', android: 'primary50', usage: 'Tinted callouts: the verify banner ground, default icon-tile wash in bill rows. The web keeps it light in dark mode.' },
  { name: 'color-primary-100', web: true, ios: 'primary100', android: 'primary100', usage: 'Primary chip fill, sky icon tiles, banner icon wells. primary-700 text on it: {{color-primary-700|color-primary-100}}; fails in Dark · iOS, where iOS darkens primary-100 but keeps primary-700 (flagged).' },
  { name: 'color-primary-200', web: true, ios: 'primary200', android: 'primary200', usage: 'Borders on sky callouts (verify banner), text-selection wash.' },
  { name: 'color-primary-300', web: true, ios: 'primary300', android: 'primary300', usage: 'Quiet chevrons on sky callouts; M3 inversePrimary. Decorative only: 1.56:1 on primary-50.' },
  { name: 'color-primary-400', web: true, ios: 'primary400', android: 'primary400', usage: 'The brand mark body in dark mode and active tab ink on dark grounds only: 8.33:1 on the web dark app-surface, 8.07:1 on the iOS one. Never on light grounds (2.14:1 on white).' },
  { name: 'color-primary-500', web: true, ios: 'primary500', android: 'primary500', usage: 'Focus rings (focus:ring-primary-500) and input focus borders. As a ring it measures {{color-primary-500|app-surface}} against app-surface: below 3:1 in Light, flagged.' },
  { name: 'color-primary-600', web: true, ios: 'primary600', android: 'primary600', usage: 'THE brand color: primary button fill, active tab underline, progress fill, the mark body, theme_color. White on it measures 4.10:1 (below AA for 14px labels, flagged). As text it measures {{color-primary-600|app-surface}} on app-surface, under 4.5:1 in every theme (flagged: the text buttons and active tabs still use it); color-link is the AA text ink. iOS/Android: primary600.' },
  { name: 'color-primary-700', web: true, ios: 'primary700', android: 'primary700', usage: 'Primary button hover/pressed fill (white on it 5.93:1); primary chip label; active mobile-tab ink in Light.' },
  { name: 'color-primary-800', web: true, ios: 'primary800', android: 'primary800', usage: 'Deep stop of the wallet balance gradient (native BalanceHero).' },
  { name: 'color-primary-900', web: true, ios: 'primary900', android: 'primary900', usage: 'Headline ink on sky callouts: on color-primary-50 {{color-primary-900|color-primary-50}}; fails in Dark · iOS, where only primary-50 darkens (flagged).' },
  { name: 'color-primary', alias: 'color-primary-600', usage: 'Alias of color-primary-600: the brand primary, marketing overlines and generic "primary" references.' },
  { name: 'color-link', web: true, usage: 'Interactive text and meaningful icons (a role, not a palette step). On app-surface {{color-link|app-surface}}; on app-bg {{color-link|app-bg}}; on color-info-bg {{color-link|color-info-bg}}. Web only: iOS and Android have no link token, so the Dark · iOS column shows the light value, which is NOT legible there; native uses primary-600/700.' },
  { name: 'color-success', web: true, ios: 'success', android: 'success', usage: 'Success label ink: chip text, valid-field check, success copy. On color-success-light {{color-success|color-success-light}}; on color-success-bg {{color-success|color-success-bg}}; on app-surface {{color-success|app-surface}}. Never a fill under white text; use color-success-solid.' },
  { name: 'color-success-solid', web: true, ios: 'successSolid', usage: 'Fill under white text or icons: success buttons, status dots, the verified dot. White on it 5.48:1 in every theme; frozen across themes on purpose.' },
  { name: 'color-success-light', web: true, ios: 'successLight', android: 'successLight', usage: 'Success chip fill and success card border.' },
  { name: 'color-success-bg', web: true, ios: 'successBg', android: 'successBg', usage: 'Success banner and callout ground.' },
  { name: 'color-warning', web: true, ios: 'warning', android: 'warning', usage: 'Warning label ink: alert chips, stale "as of" stamps, the Claimed pill. On color-warning-light {{color-warning|color-warning-light}}; on color-warning-bg {{color-warning|color-warning-bg}}; on app-surface {{color-warning|app-surface}}.' },
  { name: 'color-warning-solid', web: true, ios: 'warningSolid', usage: 'Fill under white: warning buttons, warning dots, the claimed-home badge. White on it 6.26:1 in every theme.' },
  { name: 'color-warning-light', web: true, ios: 'warningLight', android: 'warningLight', usage: 'Warning chip fill and warning card border.' },
  { name: 'color-warning-bg', web: true, ios: 'warningBg', android: 'warningBg', usage: 'Warning banner ground (info notes, offline banner, alert hero tile).' },
  { name: 'color-warning-strong', ios: 'warningStrong', android: 'warningStrong', usage: 'Native only (warningStrong), not used on web: title text on amber cards, with color-warning kept on the icon. On color-warning-bg {{color-warning-strong|color-warning-bg}}: iOS keeps the light value in dark, so it fails on both dark tints (flagged).' },
  { name: 'color-warning-deep', ios: 'warningDeep', android: 'warningDeep', usage: 'Native only (warningDeep), not used on web: body text on color-warning-bg {{color-warning-deep|color-warning-bg}}. Fails on both dark tints, like color-warning-strong (flagged).' },
  { name: 'color-error', web: true, ios: 'error', android: 'error', usage: 'Error label ink: field errors, required asterisks, error chips. On color-error-light {{color-error|color-error-light}}; on color-error-bg {{color-error|color-error-bg}}; on app-surface {{color-error|app-surface}}.' },
  { name: 'color-error-solid', web: true, ios: 'errorSolid', usage: 'Fill under white: destructive buttons and error dots. White on it 7.43:1 in every theme.' },
  { name: 'color-error-light', web: true, ios: 'errorLight', android: 'errorLight', usage: 'Error chip fill and error card border.' },
  { name: 'color-error-bg', web: true, ios: 'errorBg', android: 'errorBg', usage: 'Error banner ground.' },
  { name: 'color-info', web: true, ios: 'info', android: 'info', usage: 'Info label ink: "watch" chips and info notes. On color-info-light {{color-info|color-info-light}}; on color-info-bg {{color-info|color-info-bg}}; on app-surface {{color-info|app-surface}}.' },
  { name: 'color-info-solid', web: true, ios: 'infoSolid', usage: 'Fill under white for info emphasis. White on it 7.56:1 in every theme.' },
  { name: 'color-info-light', web: true, ios: 'infoLight', android: 'infoLight', usage: 'Info chip fill, info-note border, the "watch" icon tile.' },
  { name: 'color-info-bg', web: true, ios: 'infoBg', android: 'infoBg', usage: 'Info note ground.' },
  { name: 'color-live-badge', web: true, ios: 'liveBadge', android: 'liveBadge', usage: 'The Live Photo dot and LIVE replay pill. Drawn over photo content, never a themed surface, so it never changes. iOS systemYellow.' },
  { name: 'color-brand-check', web: true, ios: 'brandCheck', android: 'brandCheck', usage: 'The verification check inside the mark window, pinned to brand green in every theme (not color-identity-home, which darkens for text). As a graphic it measures 3.30:1 on white.' },
  { name: 'color-identity-personal', web: true, ios: 'personal', android: 'personal', usage: 'Personal pillar label ink (text, borders, rings). On color-identity-personal-bg {{color-identity-personal|color-identity-personal-bg}}; on app-surface {{color-identity-personal|app-surface}}. iOS/Android: personal.' },
  { name: 'color-identity-personal-solid', web: true, ios: 'personalSolid', usage: 'Personal fills under white: filled buttons, FABs, dots. White on it 5.93:1.' },
  { name: 'color-identity-personal-bg', web: true, ios: 'personalBg', android: 'personalBg', usage: 'Personal tint: identity chips, empty-state discs, wizard accent wash.' },
  { name: 'color-identity-home', web: true, ios: 'home', android: 'home', usage: 'Home pillar label ink and the Place accent (icon tiles, sparkline, density dots). On color-identity-home-bg {{color-identity-home|color-identity-home-bg}}; on app-surface {{color-identity-home|app-surface}}.' },
  { name: 'color-identity-home-solid', web: true, ios: 'homeSolid', usage: 'Home fills under white: the verified check badge, filled density dots, home CTAs. White on it 5.02:1. Also the dark stop of home banners (native homeDark).' },
  { name: 'color-identity-home-bg', web: true, ios: 'homeBg', android: 'homeBg', usage: 'Home tint: Place icon tiles, the all-clear hero tile, home chips.' },
  { name: 'color-identity-business', web: true, ios: 'business', android: 'business', usage: 'Business pillar label ink. On color-identity-business-bg {{color-identity-business|color-identity-business-bg}}; on app-surface {{color-identity-business|app-surface}}. A product state, never a brand color.' },
  { name: 'color-identity-business-solid', web: true, ios: 'businessSolid', usage: 'Business fills under white. White on it 5.70:1.' },
  { name: 'color-identity-business-bg', web: true, ios: 'businessBg', android: 'businessBg', usage: 'Business tint: chips, empty-state discs.' },
  { name: 'color-identity-business-dark', ios: 'businessDark', android: 'businessDark', usage: 'Native only (businessDark): dark stop of business-tinted banner gradients.' },
  { name: 'color-warm-amber', ios: 'warmAmber', android: 'warmAmber', usage: 'Native only (warmAmber): the "porch tone" accent for support-train and other warm wizards. On color-warm-amber-bg {{color-warm-amber|color-warm-amber-bg}}; fails in Dark · iOS (flagged).' },
  { name: 'color-warm-amber-bg', ios: 'warmAmberBg', android: 'warmAmberBg', usage: 'Native only (warmAmberBg): warm wizard tint.' },
  { name: 'color-magic', ios: 'magic', android: 'magic', usage: 'Native only (magic): marks AI-resolved metadata (Magic Task) so automated chrome never reads as a primary control. On color-magic-bg {{color-magic|color-magic-bg}}; iOS keeps it in dark, where it fails on the dark tint; flagged.' },
  { name: 'color-magic-bg', ios: 'magicBg', android: 'magicBg', usage: 'Native only (magicBg): AI chip and card tint.' },
  { name: 'color-magic-bg-soft', ios: 'magicBgSoft', android: 'magicBgSoft', usage: 'Native only (magicBgSoft): large AI panels.' },
  { name: 'color-magic-border', ios: 'magicBorder', android: 'magicBorder', usage: 'Native only (magicBorder): hairline around AI panels.' },
  { name: 'color-rose', ios: 'rose', android: 'rose', usage: 'Native only (rose): the Lost & Found intent chip. A lost-item post is not an error, so it is not color-error. On color-rose-bg {{color-rose|color-rose-bg}}; fails in Dark · iOS (flagged).' },
  { name: 'color-rose-bg', ios: 'roseBg', android: 'roseBg', usage: 'Native only (roseBg): Lost & Found chip fill.' },
  { name: 'color-slate', ios: 'slate', android: 'slate', usage: 'Native only (slate): the Announce intent chip, calmer than app-text-strong. On color-slate-bg {{color-slate|color-slate-bg}}.' },
  { name: 'color-slate-bg', ios: 'slateBg', android: 'slateBg', usage: 'Native only (slateBg): Announce chip fill.' },
  { name: 'color-star', ios: 'star', android: 'star', usage: 'Rating stars and histogram bars (web uses amber-400 #FBBF24 for stars). A rating is not a warning. A fill only: {{color-star|app-surface}} on white, so never text.' },
  { name: 'color-paper-cream', ios: 'paperCream', android: 'paperCream', usage: 'Native only (paperCream): postcard and archival paper stock.' },
  { name: 'cat-handyman', ios: 'handyman', android: 'handyman', usage: 'Handyman category pins and badges. A fill: white on it measures 2.80:1, so no text on it.' },
  { name: 'cat-cleaning', ios: 'cleaning', android: 'cleaning', usage: 'Cleaning category. White on it 2.87:1: no text on it.' },
  { name: 'cat-moving', ios: 'moving', android: 'moving', usage: 'Moving category. White on it 5.87:1.' },
  { name: 'cat-pet-care', ios: 'petCare', android: 'petCare', usage: 'Pet-care category. White on it 3.82:1: icons only.' },
  { name: 'cat-child-care', ios: 'childCare', android: 'childCare', usage: 'Child-care category. White on it 2.19:1: no text on it.' },
  { name: 'cat-tutoring', ios: 'tutoring', android: 'tutoring', usage: 'Tutoring category. White on it 4.30:1: icons and large text only.' },
  { name: 'cat-delivery', ios: 'delivery', android: 'delivery', usage: 'Delivery category. White on it 10.31:1.' },
  { name: 'cat-tech', ios: 'tech', android: 'tech', usage: 'Tech category. White on it 3.15:1: icons only.' },
  { name: 'cat-goods', ios: 'goods', android: 'goods', usage: 'Goods (marketplace) category. White on it 5.70:1.' },
  { name: 'cat-gigs', ios: 'gigs', android: 'gigs', usage: 'Gigs category (same hue as handyman). White on it 2.80:1: no text on it.' },
  { name: 'cat-rentals', ios: 'rentals', android: 'rentals', usage: 'Rentals category. White on it 3.30:1: icons only.' },
  { name: 'cat-vehicles', ios: 'vehicles', android: 'vehicles', usage: 'Vehicles category. White on it 4.83:1.' },
  { name: 'cat-party', ios: 'categoryParty', android: 'categoryParty', usage: 'Native only (categoryParty): party-invite mail and confetti rose.' },
  { name: 'cat-records', ios: 'categoryRecords', android: 'categoryRecords', usage: 'Native only (categoryRecords): records mail accent.' },
  { name: 'cat-records-bg', ios: 'categoryRecordsBg', android: 'categoryRecordsBg', usage: 'Native only: records mail card ground.' },
  { name: 'cat-records-border', ios: 'categoryRecordsBorder', android: 'categoryRecordsBorder', usage: 'Native only: records mail card border.' },
  { name: 'cat-records-deep', ios: 'categoryRecordsDeep', android: 'categoryRecordsDeep', usage: 'Native only: records mail heading ink (on cat-records-bg {{cat-records-deep|cat-records-bg}}; fails in Dark · iOS, flagged).' },
  { name: 'cat-stamps', ios: 'categoryStamps', android: 'categoryStamps', usage: 'Native only (categoryStamps): stamp-collection accent.' },
  { name: 'cat-translation', ios: 'categoryTranslation', android: 'categoryTranslation', usage: 'Native only (categoryTranslation): translated-mail accent.' },
  { name: 'cat-translation-bg', ios: 'categoryTranslationBg', android: 'categoryTranslationBg', usage: 'Native only: translated-mail tint.' },
  { name: 'cat-translation-ink', ios: 'categoryTranslationInk', android: 'categoryTranslationInk', usage: 'Native only: translated-mail label ink (on cat-translation-bg {{cat-translation-ink|cat-translation-bg}}; fails in Dark · iOS, flagged).' },
  { name: 'cat-translation-paper', ios: 'categoryTranslationPaper', android: 'categoryTranslationPaper', usage: 'Native only: translated-letter paper.' },
  { name: 'cat-translation-paper-ink', ios: 'categoryTranslationPaperInk', android: 'categoryTranslationPaperInk', usage: 'Native only: letter ink on cat-translation-paper {{cat-translation-paper-ink|cat-translation-paper}}.' },
  { name: 'cat-task', ios: 'categoryTask', android: 'categoryTask', usage: 'Native only (categoryTask): task-from-mail accent.' },
  { name: 'cat-unboxing', ios: 'categoryUnboxing', android: 'categoryUnboxing', usage: 'Native only (categoryUnboxing): package unboxing accent.' },
  { name: 'cat-unboxing-dark', ios: 'categoryUnboxingDark', android: 'categoryUnboxingDark', usage: 'Native only: unboxing gradient dark stop.' },
  { name: 'cat-unboxing-bg', ios: 'categoryUnboxingBg', android: 'categoryUnboxingBg', usage: 'Native only: unboxing tint.' },
  { name: 'cat-unboxing-border', ios: 'categoryUnboxingBorder', android: 'categoryUnboxingBorder', usage: 'Native only: unboxing card border.' },
  { name: 'paper', web: true, usage: 'Marketing homepage ground (.marketing-home). Light only: the homepage does not theme.' },
  { name: 'paper-cool', web: true, usage: 'Cool paper band on the homepage.' },
  { name: 'paper-warm', web: true, usage: 'Warm paper band on the homepage.' },
  { name: 'paper-pure', web: true, usage: 'Brightest paper: cards on the homepage.' },
  { name: 'ink-1', web: true, usage: 'Homepage headline and body ink. On paper {{ink-1|paper}}.' },
  { name: 'ink-2', web: true, usage: 'Homepage lede and body copy. On paper {{ink-2|paper}}; on paper-cool {{ink-2|paper-cool}}.' },
  { name: 'ink-3', web: true, usage: 'Homepage captions. On paper {{ink-3|paper}}: below 4.5:1 for small text, flagged; keep it at 18px+ or use ink-2.' },
  { name: 'ink-4', web: true, usage: 'Homepage decorative marks only ({{ink-4|paper}} on paper).' },
  { name: 'rule', web: true, usage: 'Homepage hairlines.' },
  { name: 'rule-strong', web: true, usage: 'Homepage emphasized rules.' },
];

// Platform tokens deliberately left out of the system, with the reason.
// Anything else a platform defines and this file doesn't map is reported.
export const IGNORED = {
  web: {},
  ios: {
    successDk: 'same value as successSolid (a legacy name for high-emphasis numerals)',
    homeDark: 'same value as homeSolid (banner gradient stop)',
    stripeBrand: 'a third-party brand color, not a Pantopus token',
  },
  android: {
    homeDark: 'same value as home',
    warmAmberSoft: 'same value as warningBg',
    warmAmberBorder: 'same value as warningLight',
    appBgDark: 'dark Material scheme twin; checked against the iOS dark value',
    appSurfaceDark: 'dark Material scheme twin; checked against the iOS dark value',
    appSurfaceRaisedDark: 'dark Material scheme twin; checked against the iOS dark value',
    appSurfaceSunkenDark: 'dark Material scheme twin; checked against the iOS dark value',
    appBorderDark: 'dark Material scheme twin; checked against the iOS dark value',
    appBorderStrongDark: 'dark Material scheme twin; checked against the iOS dark value',
    appTextDark: 'dark Material scheme twin; checked against the iOS dark value',
    appTextStrongDark: 'dark Material scheme twin; checked against the iOS dark value',
    appTextSecondaryDark: 'dark Material scheme twin; checked against the iOS dark value',
  },
};

// sans and mono come from Tailwind's default theme (what the web renders);
// serif from globals.css --font-serif.
export const FAMILIES = { sans: { tailwind: 'sans' }, serif: { webVar: 'font-serif' }, mono: { tailwind: 'mono' } };

export const TYPE_GROUPS = [
  {
    name: 'Ramp',
    family: 'sans',
    note: 'The shared ramp: @pantopus/theme typography on web, PantopusTextStyle on iOS and Android. System faces only (SF Pro, Roboto, the OS UI font); no webfont ships.',
    // Values from frontend/packages/theme/src/typography.ts; tracking from
    // PantopusTextStyle in Typography.kt (the theme object has none).
    derived: true,
    styles: [
      { name: 'heading1', native: 'h1', sample: 'See what’s true about your address', usage: 'Screen titles. Native h1.' },
      { name: 'heading2', native: 'h2', sample: 'Risk & readiness', usage: 'Section titles on long screens. Native h2.' },
      { name: 'heading3', native: 'h3', sample: 'You haven’t added a place yet', usage: 'Empty-state headlines, sheet titles. Native h3.' },
      { name: 'body', native: 'body', sample: 'Public records, local risks, and who’s verified nearby.', usage: 'Default reading text; native button labels.' },
      { name: 'bodyMedium', sample: 'Zone X — minimal flood risk', usage: 'Emphasised body values.' },
      { name: 'bodySmall', native: 'small', sample: 'Verify your address to message neighbors.', usage: 'Dense UI copy, descriptions, subcopy. Native small.' },
      { name: 'bodySmallMedium', sample: 'Pickup days, tax dates, hearings', usage: 'Row titles and tab labels.' },
      { name: 'caption', native: 'caption', sample: 'FEMA National Flood Hazard Layer · May 2026', usage: 'Metadata, sources, helper text.' },
      { name: 'captionMedium', sample: 'Updated 9:40 AM', usage: 'Emphasised metadata.' },
      { name: 'overline', native: 'overline', sample: 'YOUR HOME', usage: 'Uppercase section label, always set in capitals (native callers uppercase the string). app-text-secondary.' },
      { name: 'label', sample: 'Your monthly rent', usage: 'Form field labels.' },
    ],
  },
  {
    name: 'Place dashboard',
    family: 'sans',
    note: 'The denser rhythm of the address-led Place archetype, used on web and mirrored natively with inline sizes.',
    styles: [
      { name: 'placeTitle', fontSize: '28px', lineHeight: '32px', fontWeight: 700, letterSpacing: '-0.02em', sample: 'Your Place', usage: 'The Place header title.', source: ['frontend/apps/web/src/components/archetypes/place/PlaceHeader.tsx', 'text-[28px] leading-8 font-bold -tracking-[0.02em]'] },
      { name: 'detailTitle', fontSize: '20px', lineHeight: '24px', fontWeight: 700, letterSpacing: '-0.02em', sample: 'Risk & readiness', usage: 'Sticky detail-page header title.', source: ['frontend/apps/web/src/components/archetypes/place/detail.tsx', 'text-[20px] leading-6 font-bold -tracking-[0.02em]'] },
      { name: 'cardHeadline', fontSize: '17px', lineHeight: '23px', fontWeight: 600, letterSpacing: '-0.012em', sample: 'Quiet on every layer today.', usage: 'Hero and Aha card headlines.', source: ['frontend/apps/web/src/components/archetypes/place/HeroCard.tsx', 'text-[17px] font-semibold text-app-text leading-[23px] -tracking-[0.012em]'] },
      { name: 'cardTitle', fontSize: '15px', lineHeight: 1.5, fontWeight: 600, letterSpacing: '-0.01em', sample: 'Drinking water', usage: 'Section-card titles, sentence case.', source: ['frontend/apps/web/src/components/archetypes/place/SectionCard.tsx', 'text-[15px] font-semibold text-app-text -tracking-[0.01em]'] },
      { name: 'cardValue', fontSize: '15px', lineHeight: '21px', fontWeight: 500, sample: 'Zone X — minimal flood risk', usage: 'The primary reading on a section card.', source: ['frontend/apps/web/src/components/archetypes/place/SectionCard.tsx', 'text-[15px] font-medium text-app-text leading-[21px]'] },
      { name: 'nudge', fontSize: '13.5px', lineHeight: '19px', fontWeight: 400, sample: 'Trash pickup moved to Thursday this week.', usage: 'Nudge rows and card detail lines.', source: ['frontend/apps/web/src/components/archetypes/place/HeroCard.tsx', 'text-[13.5px] text-app-text-strong leading-[19px]'] },
      { name: 'cardCaption', fontSize: '12.5px', lineHeight: '18px', fontWeight: 400, sample: 'Screening, not a diagnosis', usage: 'Quiet supporting lines, info notes, address lines. app-text-muted.', source: ['frontend/apps/web/src/components/archetypes/place/detail.tsx', 'text-[12.5px] leading-[18px]'] },
      { name: 'pulseEyebrow', fontSize: '11px', lineHeight: 1.5, fontWeight: 700, letterSpacing: '0.07em', sample: 'TODAY’S PULSE', usage: 'Card eyebrows (Today’s pulse, What stands out). Uppercase.', source: ['frontend/apps/web/src/components/archetypes/place/HeroCard.tsx', 'text-[11px] font-bold uppercase tracking-[0.07em]'] },
      { name: 'groupLabel', fontSize: '11px', lineHeight: '16px', fontWeight: 600, letterSpacing: '0.08em', sample: 'RISK & READINESS', usage: 'Dashboard group labels, app-text-muted. Detail-page labels use weight 700.', source: ['frontend/apps/web/src/components/archetypes/place/Group.tsx', 'tracking-[0.08em] text-app-text-muted'] },
    ],
  },
  {
    name: 'Controls',
    family: 'sans',
    styles: [
      { name: 'pageTitle', fontSize: '22px', lineHeight: 1.25, fontWeight: 700, letterSpacing: '-0.01em', sample: 'Bills', usage: 'Archetype page-header title on web.', source: ['frontend/apps/web/src/components/archetypes/primitives/ArchetypePageHeader.tsx', 'text-[22px] leading-tight font-bold text-app-text -tracking-[0.01em]'] },
      { name: 'button', fontSize: '14px', lineHeight: '20px', fontWeight: 600, sample: 'Verify address', usage: 'Web button and text-button labels. Native full-width buttons use body (16px).', source: ['frontend/apps/web/src/components/archetypes/primitives/ArchetypePageHeader.tsx', 'h-10 px-4 rounded-lg text-sm font-semibold'] },
      { name: 'tab', fontSize: '14px', lineHeight: '20px', fontWeight: 500, sample: 'Upcoming (3)', usage: 'Tab labels; the active tab switches to 600.', source: ['frontend/apps/web/src/components/archetypes/primitives/TabStrip.tsx', '\'px-4 py-3 text-sm transition'] },
      { name: 'chip', fontSize: '11px', lineHeight: 1.5, fontWeight: 600, sample: 'Verified', usage: 'Small chips (Chip size sm). Size md is 12px.', source: ['frontend/apps/web/src/components/archetypes/primitives/Chip.tsx', 'text-[11px] px-2 py-0.5 gap-1'] },
      { name: 'amount', fontSize: '15px', lineHeight: 1.5, fontWeight: 700, letterSpacing: '-0.01em', sample: '$142.18', usage: 'Money in list rows.', source: ['frontend/apps/web/src/components/archetypes/primitives/StatusChipRow.tsx', 'text-[15px] font-bold text-app-text -tracking-[0.01em]'] },
      { name: 'tabBar', fontSize: '11px', lineHeight: 1, fontWeight: 500, sample: 'Nearby', usage: 'Bottom tab-bar labels on phone-width web.', source: ['frontend/apps/web/src/components/MobileTabBar.tsx', 'text-[11px] font-medium leading-none'] },
    ],
  },
  {
    name: 'Data',
    family: 'mono',
    styles: [
      { name: 'factValue', fontSize: '13px', lineHeight: 1.5, fontWeight: 500, sample: 'APN 986-043-122', usage: 'IDs and codes in key-fact panels (copyable).', source: ['frontend/apps/web/src/components/archetypes/primitives/KeyFactsPanel.tsx', '\'font-mono text-[13px]\''] },
    ],
  },
  {
    name: 'Marketing',
    family: 'serif',
    note: 'Homepage only (.marketing-home), on paper with ink. The display sizes are fluid on web: clamp() shown at its maximum.',
    styles: [
      { name: 'heroDisplay', fontSize: '112px', lineHeight: 0.98, fontWeight: 500, letterSpacing: '-0.028em', sample: 'Your address, verified.', usage: 'mh-display-hero: clamp(56px, 7.6vw, 112px).', source: ['frontend/apps/web/src/app/globals.css', 'font-size: clamp(56px, 7.6vw, 112px);'] },
      { name: 'theatreDisplay', fontSize: '100px', lineHeight: 1.02, fontWeight: 500, letterSpacing: '-0.028em', sample: 'Mail, made real.', usage: 'mh-display-theatre: clamp(56px, 6.8vw, 100px), balanced.', source: ['frontend/apps/web/src/app/globals.css', 'font-size: clamp(56px, 6.8vw, 100px);'] },
      { name: 'sectionHeading', fontSize: '50px', lineHeight: 1.06, fontWeight: 500, letterSpacing: '-0.022em', sample: 'Know your block.', usage: 'mh-h2: clamp(36px, 3.2vw, 50px), balanced.', source: ['frontend/apps/web/src/app/globals.css', 'font-size: clamp(36px, 3.2vw, 50px);'] },
      { name: 'lede', family: 'sans', fontSize: '22px', lineHeight: '32px', fontWeight: 400, letterSpacing: '-0.005em', sample: 'Look up any U.S. address, then save your place to get daily updates.', usage: 'mh-lede, ink-2.', source: ['frontend/apps/web/src/app/globals.css', 'font-size: 22px;'] },
      { name: 'marketingBody', family: 'sans', fontSize: '18px', lineHeight: '30px', fontWeight: 400, sample: 'Free, no account.', usage: 'mh-body, ink-2.', source: ['frontend/apps/web/src/app/globals.css', '.mh-body  { font-size: 18px; line-height: 30px;'] },
      { name: 'marketingOverline', family: 'sans', fontSize: '11px', lineHeight: '16px', fontWeight: 600, letterSpacing: '0.08em', sample: 'PUBLIC PREVIEW', usage: 'mh-overline, uppercase, color-primary.', source: ['frontend/apps/web/src/app/globals.css', 'letter-spacing: 0.08em;'] },
    ],
  },
];

// Values from frontend/packages/theme/src/spacing.ts, cross-checked against
// globals.css and the native Spacing enums.
export const SPACING = {
  note: '4px base with jumps (no 7, 9, 11 or 14 steps). Native: Spacing.s0–s16 in pt/dp; CI rejects raw on-scale literals in feature code.',
  usage: {
    'spacing-0': 'No gap.',
    'spacing-1': 'Icon-to-label gaps, chip vertical padding.',
    'spacing-2': 'Chip horizontal padding, gaps between stacked cards in a group.',
    'spacing-3': 'Gap between an icon tile and its text; input horizontal padding; row gaps.',
    'spacing-4': 'Card padding, list-row padding, page side gutter.',
    'spacing-5': 'Secondary-button horizontal padding, sheet header padding.',
    'spacing-6': 'Space between dashboard groups; modal padding; primary-button horizontal padding.',
    'spacing-8': 'Space between form field groups; empty-state side padding.',
    'spacing-10': 'Large section breaks; native toast bottom offset.',
    'spacing-12': 'Hero and page-level breathing room.',
    'spacing-16': 'The largest step: marketing section spacing.',
  },
};

// Values from frontend/packages/theme/src/radii.ts (web 2xl/3xl = native xl2/xl3).
export const RADIUS = {
  note: 'Web Tailwind rounded-* maps to these (rounded-2xl is 20px here, not Tailwind’s 16px). Native: Radii.xs–xl, xl2, xl3, pill. Icon tiles use an off-scale 9px.',
  usage: {
    'radius-none': 'Full-bleed media.',
    'radius-xs': 'Tiny badges, code spans, the Pro badge and shimmer bars (web rounded, which stays 4px).',
    'radius-sm': 'Native checkboxes and shimmer placeholders (Radii.sm).',
    'radius-md': 'Inputs, bill-row icon tiles, copy and kebab buttons, native compact buttons.',
    'radius-lg': 'Buttons (web rounded-lg, native Radii.lg), icon buttons, search inputs.',
    'radius-xl': 'Nudge rows, info notes, 42px hero tiles, key-fact panels, web toasts.',
    'radius-2xl': 'THE card radius: every section card, row card and sheet (rounded-2xl).',
    'radius-3xl': 'Large marketing panels.',
    'radius-pill': 'Chips, pills, filter toggles, progress segments.',
    'radius-full': 'Avatars, status dots, round icon discs.',
  },
};

// from: theme:<cssShadows key> | web:<css var> | ios:<PantopusShadow> | android:<PantopusElevations>.
// ios / android name the native twins the value is cross-checked against.
export const SHADOWS = {
  note: 'The elevation scale in @pantopus/theme (cssShadows), mirrored as PantopusShadow (iOS) and PantopusElevations (Android). Same in every theme. Web Tailwind shadow-* utilities still resolve to Tailwind defaults (shadow-sm is 0 1px 2px 0 rgb(0 0 0 / 0.05)).',
  tokens: [
    { name: 'shadow-sm', from: 'theme:sm', ios: 'sm', android: 'sm', usage: 'Cards at rest, ghost buttons: always paired with a 1px app-border.' },
    { name: 'shadow-md', from: 'theme:md', ios: 'md', android: 'md', usage: 'Hover lift on tappable row cards.' },
    { name: 'shadow-lg', from: 'theme:lg', ios: 'lg', android: 'lg', usage: 'Toasts and floating popovers.' },
    { name: 'shadow-xl', from: 'theme:xl', ios: 'xl', android: 'xl', usage: 'Drawers and dialogs.' },
    { name: 'shadow-primary', from: 'web:shadow-primary', ios: 'primary', android: 'primary', usage: 'Native primary buttons and active action chips; the web primary glow.' },
    { name: 'shadow-primary-deep', from: 'ios:primaryDeep', usage: 'iOS only: add-to-calendar CTAs.' },
    { name: 'shadow-fab', from: 'android:fab', usage: 'Native floating buttons (back-to-top).' },
  ],
};
