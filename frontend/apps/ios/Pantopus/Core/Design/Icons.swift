//
//  Icons.swift
//  Pantopus
//
//  Typed icon system. Feature code MUST reference icons through
//  `PantopusIcon` — direct `Image(systemName:)` calls in feature code will
//  be rejected by `make verify-icons`.
//
//  The icon inventory mirrors every `data-lucide="…"` reference in the
//  design archetype JSX. Rendering currently maps each case to the closest
//  SF Symbol; swapping to a Lucide SVG renderer later changes only
//  `Icon.body`, not the call sites.
//

import SwiftUI

// swiftlint:disable file_length type_body_length

/// Every icon the Pantopus design language uses. Cases are the raw Lucide
/// token names (kebab-case preserved in `rawValue`).
public enum PantopusIcon: String, CaseIterable, Sendable {
    case home
    case map
    case inbox
    case user
    case bell
    case menu
    case shieldCheck = "shield-check"
    case x
    case plusCircle = "plus-circle"
    case camera
    case scanLine = "scan-line"
    case plusSquare = "plus-square"
    case sun
    case sunDim = "sun-dim"
    case chevronRight = "chevron-right"
    case chevronLeft = "chevron-left"
    case megaphone
    case shoppingBag = "shopping-bag"
    case hammer
    case mailbox
    case search
    case userPlus = "user-plus"
    case file
    case copy
    case check
    case moreHorizontal = "more-horizontal"
    case arrowLeft = "arrow-left"
    case arrowRight = "arrow-right"
    case send
    case chevronDown = "chevron-down"
    case chevronUp = "chevron-up"
    case trash2 = "trash-2"
    case edit2 = "edit-2"
    case upload
    case shield
    case lock
    case checkCircle = "check-circle"
    case alertCircle = "alert-circle"
    case circle
    case info
    case wifiOff = "wifi-off"
    case heart
    case thumbsUp = "thumbs-up"
    case star
    case starFill = "star-fill"
    case helpCircle = "help-circle"
    case calendar
    case calendarCheck = "calendar-check"
    case lightbulb
    case eye
    case share
    case radio
    case rss
    case mapPin = "map-pin"
    case pencil
    case briefcase
    case gavel
    case slidersHorizontal = "sliders-horizontal"
    case messageCircle = "message-circle"
    case atSign = "at-sign"
    case badgeCheck = "badge-check"
    case tag
    case shieldAlert = "shield-alert"
    case checkCheck = "check-check"
    case history
    case receipt
    case clock
    case users
    case dollarSign = "dollar-sign"
    // T5.2.1 — Pets species iconography. Gradient-tinted backgrounds in
    // `SpeciesPalette` carry the per-species hue; these icons render in
    // white on top.
    case dog
    case cat
    case bird
    case fish
    case turtle
    case pawPrint = "paw-print"
    // T5.2.4 — Offers cross-listing iconography.
    case sparkles
    case timer
    /// Lucide `repeat`. Named `arrowsRepeat` to dodge Swift's `repeat`
    /// keyword while preserving the upstream token in `rawValue`.
    case arrowsRepeat = "repeat"
    case hourglass
    // A17.11 Stamps — `gauge` backs the Elf "~2 stamps / week" rate
    // bullet; `infinity` backs the book's "Never expires" validity badge.
    case gauge
    case infinity
    case handCoins = "hand-coins"
    case package
    case flower
    case compass
    case filter

    // T5.3.1 My bids — bid lifecycle chip icons + "View details" footer.
    case crown
    case trendingDown = "trending-down"
    case ban
    case fileText = "file-text"

    // A10.10 Wallet — BalanceHero "This month" trend indicator + Withdraw CTA glyph.
    case trendingUp = "trending-up"
    case arrowDownToLine = "arrow-down-to-line"

    // T5.3.2 My tasks V2 — poster-side chip + footer icons.
    case plus
    case rocket
    case clipboardList = "clipboard-list"
    case clockPlus = "clock-plus"
    case circleSlash = "circle-slash"
    case play
    /// T6.5d voice-postscript player toggle (play / pause).
    case pause

    // T5.3.3 My posts — archive chip + empty-state compose icon.
    case archive
    case messageSquarePlus = "message-square-plus"

    /// T5.3.4 Listing offers — listing-context header icons.
    case bookmark

    // T6.0a Bills — utility category iconography + banner/auto-pay markers.
    case zap
    case flame
    case droplet
    case wifi
    case building2 = "building-2"
    case smartphone
    case wallet
    case hash

    // T6.0b My tasks V2 — Magic Task archetype tile icons + engagement-mode
    // badge icons + empty-state quick-prompt arrow.
    case tv
    case laptop
    case monitor
    case shuffle
    case wandSparkles = "wand-sparkles"
    case arrowUpRight = "arrow-up-right"

    // T6.4c Home calendar — event-type palette + banner illustration.
    case wrench
    case usersRound = "users-round"
    case gift
    case partyPopper = "party-popper"
    case graduationCap = "graduation-cap"
    case stethoscope
    case calendarDays = "calendar-days"
    case link
    // T6.4b Emergency info — per-category tile glyphs (shutoff / contact /
    // evac / medical) + row action icons (phoneCall / image / mapPin) +
    // banner CTA + pinned marker + empty-state quick-prompt.
    case pin
    case power
    case phoneCall = "phone-call"
    case phone
    case navigation
    case heartPulse = "heart-pulse"
    case siren
    case cross
    case flag
    case userRound = "user-round"
    case flaskConical = "flask-conical"
    case flameKindling = "flame-kindling"
    case printer
    /// Plain bulleted list — the A19 legal "Jump to section" TOC header.
    case list
    case listChecks = "list-checks"
    case alertTriangle = "alert-triangle"

    // T6.4b Documents — file-type tile glyphs (pdf / image / doc / sheet /
    // archive / scan) + category section icons (lease / insurance /
    // warranty / tax / permit / hoa / id) + banner / row chip glyphs.
    case image
    case imagePlus = "image-plus"
    case fileType = "file-type"
    case fileSpreadsheet = "file-spreadsheet"
    case fileSignature = "file-signature"
    case landmark
    case stamp
    case idCard = "id-card"
    case folderLock = "folder-lock"
    case uploadCloud = "upload-cloud"
    case calendarClock = "calendar-clock"
    case download
    // T6.4a Access codes — tap-to-reveal hide icon + empty-state key disc.
    case eyeOff = "eye-off"
    case keyRound = "key-round"

    // T6.3c Household tasks — chore-category iconography + banner glyph.
    case leaf
    case utensils
    case baby

    // T6.3b Maintenance — per-home maintenance task category iconography.
    // Same rationale as the Bills T6.0a additions: the design's
    // category-tinted leading tiles need glyphs that aren't on the
    // existing icon menu. Fallbacks are documented inline in
    // `sfSymbolName` for icons SF Symbols doesn't ship 1:1.
    case fan
    case cloudOff = "cloud-off"
    case cloudRain = "cloud-rain"
    case refrigerator
    case bug
    case trees
    case paintRoller = "paint-roller"
    case bellRing = "bell-ring"

    // Place Intelligence dashboard section glyphs (W3). Lucide tokens
    // from the design kit + web presentation.tsx SECTION_CONFIG.
    case sunrise
    case waves
    case activity
    case testTube = "test-tube"
    case factory
    case badgePercent = "badge-percent"
    case vote
    case lifeBuoy = "life-buoy"
    case hardHat = "hard-hat"
    case triangleAlert = "triangle-alert"
    case cloud
    case sunset
    case flower2 = "flower-2"
    case trash
    case zapOff = "zap-off"
    case fileSearch = "file-search"

    // T6.5e Mailbox Vault — folder palette + mail-type tile glyphs + FAB
    // glyph. Distinct from existing `mailbox` (mail.stack) so the new
    // Mailbox surfaces can render the closed-envelope and open-envelope
    // states from the design palette.
    case mail
    case mailOpen = "mail-open"
    // A18.1 Verify email sent — envelope-with-check halo glyph.
    case mailCheck = "mail-check"
    case folderPlus = "folder-plus"
    case piggyBank = "piggy-bank"
    case plane
    case receiptText = "receipt-text"
    case paperclip
    case arrowDownUp = "arrow-down-up"

    // T6.6b Chat conversation refresh — header trailing (phone / video /
    // more-vertical for person; history / more-vertical for AI) + empty-
    // state "Introduce yourself" quick-chip.
    case video
    case moreVertical = "more-vertical"
    case hand
    case smile
    case arrowUp = "arrow-up"

    // P1.3 Broadcast detail — sticky-footer Reply CTA + radio-tower
    // "reach" cell glyph borrowed from the audience-frames design.
    case reply
    case radioTower = "radio-tower"

    // P6.5 Public profile · Persona vs Local — `message-square` for the
    // Local visitor's "Message" CTA, `globe` for the persona broadcast's
    // "Free" visibility chip.
    case messageSquare = "message-square"
    case globe

    // P2.10 Document detail — sticky-footer action icons (Open externally
    // / Replace) that don't map to anything already in the enum.
    case externalLink = "external-link"
    case refreshCw = "refresh-cw"

    // A10.3 Today briefing — weather + transit glyphs from `today-frames.jsx`
    // (hero condition glyph, Wind chip, transit signals).
    case snowflake
    case wind
    case bus
    case droplets

    // A.5 (A13.11) Professional profile — certification seal glyph, portfolio
    // host glyphs (palette / play-circle for Behance / YouTube previews),
    // skill-chip glyphs (grid-3x3 / square), and the drag-reorder handle.
    // SF Symbols ships near-1:1 equivalents; `grip-vertical` has no native
    // drag-handle glyph so it falls back to `line.3.horizontal`.
    case ribbon
    case palette
    case playCircle = "play-circle"
    case gripVertical = "grip-vertical"
    case grid3x3 = "grid-3x3"
    case square

    // A13.1 Add guest — "Allowed areas" guest-pass chip iconography.
    // Mirrors the `data-lucide` tokens in the Add Guest design
    // (`door-open` / `car` / `warehouse`). `warehouse` backs the
    // "Garden shed" chip; SF Symbols has no warehouse glyph so it maps
    // to the closest small-building vector.
    case doorOpen = "door-open"
    case car
    case warehouse

    /// A15.3 AI Assistant — the conversation AI avatar + "Pantopus AI" reply
    /// tag glyph. SF Symbols ships no robot/`bot` glyph, so this falls back
    /// to `sparkles` (the house AI/magic glyph); Android renders the truer
    /// `SmartToy` robot. Kept a distinct case so the call sites read as the
    /// Lucide `bot` token and can swap to a real vector later.
    case bot

    // A13.4 Transfer ownership — Face ID confirmation glyph (`scan-face`),
    // sticky-CTA bidirectional arrow (`arrow-right-left`), and the diff-
    // direction "After" caret (`arrow-down`).
    case scanFace = "scan-face"
    case arrowRightLeft = "arrow-right-left"
    case arrowDown = "arrow-down"

    // A12.10 Create Business — category tile glyphs. `cpu` backs the Tech &
    // Repair tile; `truck` backs the Delivery & Errands tile.
    case cpu
    case truck

    /// P5.2 / A14.6 Payments — the inline-empty hero disc inside the
    /// Payment methods card uses Lucide's `credit-card` glyph.
    case creditCard = "credit-card"

    // A13.13 — Manage train. `bar-chart-3` paints the Analytics row's icon
    // tile; `calendar-cog` paints the Edit-dates-&-slots row.
    case barChart3 = "bar-chart-3"
    case calendarCog = "calendar-cog"

    // A13.15 — Disambiguate. `user-check` backs the "This is me" quick-action
    // chip; `forward` backs "Route to…"; `keyboard` + `undo-2` back the
    // unclear-frame fallback rows (Type recipient name / Return to sender).
    case userCheck = "user-check"
    case forward
    case keyboard
    case undo2 = "undo-2"
    // A17.9 Party — invite chrome glyphs that weren't on the icon menu yet:
    // dress / forecast vibe rows, ± plus-one stepper, RSVP cluster Can't
    // chip, calendar-plus CTA, and the bell-off mute affordance.
    case quote
    case cloudSun = "cloud-sun"
    case shirt
    case xCircle = "x-circle"
    case bellOff = "bell-off"
    case minus
    case userMinus = "user-minus"
    case calendarPlus = "calendar-plus"

    // A18.4 Waiting room — the persistent claim room's more-info halo glyph
    // (`file-warning`) and the "Update evidence" inline-action glyph
    // (`file-plus-2`).
    case filePlus2 = "file-plus-2"
    case fileWarning = "file-warning"

    /// A15.3 AI Assistant header — the "New chat" trailing action uses
    /// Lucide's `square-pen` (pen inside a square frame).
    case squarePen = "square-pen"

    // A11.1 Tasks map — map-control glyphs (`locate-fixed`, `layers`,
    // `maximize` for fit-all-pins) and the empty-state hero
    // (`map-pin-off`).
    case locateFixed = "locate-fixed"
    case layers
    case maximize
    case mapPinOff = "map-pin-off"

    // A12.8 Magic Task wizard — describe-card mic, manual-picker ghost
    // CTA (`layout-grid`), and the engagement tiles (`circle-dot` /
    // `repeat-2`; Open-ended reuses `infinity`).
    case mic
    case layoutGrid = "layout-grid"
    case circleDot = "circle-dot"
    case repeat2 = "repeat-2"

    // Calendarly (scheduling) — every `data-lucide` token used across the
    // booking / event-type / availability / payments / automations design
    // suite that wasn't already on the icon menu. SF Symbols ships near-1:1
    // glyphs for most; the few it lacks (calendar-sync, search-x, ticket-check,
    // share-2) fall back to the closest available glyph, noted inline.
    case store
    case qrCode = "qr-code"
    case settings
    case settings2 = "settings-2"
    case workflow
    case moon
    case calendarSync = "calendar-sync"
    case calendarOff = "calendar-off"
    case calendarX = "calendar-x"
    case calendarCheck2 = "calendar-check-2"
    case calendarRange = "calendar-range"
    case searchX = "search-x"
    case ticket
    case ticketCheck = "ticket-check"
    case shieldPlus = "shield-plus"
    case userX = "user-x"
    case rotateCcw = "rotate-ccw"
    case rotateCw = "rotate-cw"
    case packageOpen = "package-open"
    case tentTree = "tent-tree"
    case share2 = "share-2"
    case bellPlus = "bell-plus"
    case percent
    case scissors
    case scale
    case coffee
    case bedDouble = "bed-double"
    case house
    case move
    case ellipsis
    case ellipsisVertical = "ellipsis-vertical"
    case circleAlert = "circle-alert"
    case circleCheck = "circle-check"
    case checkCircle2 = "check-circle-2"
    case clockAlert = "clock-alert"
    case pauseCircle = "pause-circle"
    case listOrdered = "list-ordered"
    case loaderCircle = "loader-circle"
    case messageSquareText = "message-square-text"
    case layoutTemplate = "layout-template"
    case panelBottom = "panel-bottom"
    case squareMousePointer = "square-mouse-pointer"
    case textCursorInput = "text-cursor-input"
    case handPointer = "hand-pointer"
    case wand2 = "wand-2"
    // Calendarly (scheduling) — second batch surfaced during the per-screen
    // parity sweep. SF lacks a broken-link and a calendar+search glyph, noted
    // inline.
    case arrowRightCircle = "arrow-right-circle"
    case link2Off = "link-2-off"
    case calendarSearch = "calendar-search"
    case gitMerge = "git-merge"

    /// SF Symbol name used to render this icon. Chosen for closest visual
    /// parity with the Lucide source; designers can later swap the
    /// rendering layer without changing call sites.
    public var sfSymbolName: String {
        switch self {
        case .home: "house"
        case .map: "map"
        case .inbox: "tray"
        case .user: "person"
        case .bell: "bell"
        case .menu: "line.3.horizontal"
        case .shieldCheck: "checkmark.shield"
        case .x: "xmark"
        case .plusCircle: "plus.circle"
        case .camera: "camera"
        case .scanLine: "barcode.viewfinder"
        case .plusSquare: "plus.square"
        case .sun: "sun.max"
        case .sunDim: "sun.max"
        case .chevronRight: "chevron.right"
        case .chevronLeft: "chevron.left"
        case .megaphone: "megaphone"
        case .shoppingBag: "bag"
        case .hammer: "hammer"
        case .mailbox: "mail.stack"
        case .search: "magnifyingglass"
        case .userPlus: "person.badge.plus"
        case .file: "doc"
        case .copy: "doc.on.doc"
        case .check: "checkmark"
        case .moreHorizontal: "ellipsis"
        case .arrowLeft: "arrow.left"
        case .arrowRight: "arrow.right"
        case .send: "paperplane"
        case .chevronDown: "chevron.down"
        case .chevronUp: "chevron.up"
        case .trash2: "trash"
        case .edit2: "pencil"
        case .upload: "square.and.arrow.up"
        case .shield: "shield"
        case .lock: "lock"
        case .checkCircle: "checkmark.circle"
        case .alertCircle: "exclamationmark.circle"
        case .circle: "circle"
        case .info: "info.circle"
        case .wifiOff: "wifi.slash"
        case .heart: "heart"
        case .thumbsUp: "hand.thumbsup"
        case .star: "star"
        case .starFill: "star.fill"
        case .helpCircle: "questionmark.circle"
        case .calendar: "calendar"
        case .calendarCheck: "calendar.badge.checkmark"
        case .lightbulb: "lightbulb"
        case .eye: "eye"
        case .share: "square.and.arrow.up"
        case .radio: "antenna.radiowaves.left.and.right"
        case .rss: "dot.radiowaves.up.forward"
        case .mapPin: "mappin"
        case .pencil: "pencil"
        case .briefcase: "briefcase"
        case .gavel: "hammer.fill"
        case .slidersHorizontal: "slider.horizontal.3"
        case .messageCircle: "bubble.left"
        case .atSign: "at"
        case .badgeCheck: "checkmark.seal"
        case .tag: "tag"
        case .shieldAlert: "exclamationmark.shield"
        case .checkCheck: "checkmark.circle"
        case .history: "clock.arrow.circlepath"
        case .receipt: "doc.text"
        case .clock: "clock"
        case .users: "person.2"
        case .dollarSign: "dollarsign"
        case .dog: "dog"
        case .cat: "cat"
        case .bird: "bird"
        case .fish: "fish"
        case .turtle: "tortoise"
        case .pawPrint: "pawprint"
        case .sparkles: "sparkles"
        case .timer: "timer"
        case .arrowsRepeat: "arrow.triangle.2.circlepath"
        case .hourglass: "hourglass"
        case .gauge: "gauge.medium"
        case .infinity: "infinity"
        case .handCoins: "hand.raised"
        case .package: "shippingbox"
        case .flower: "camera.macro"
        case .compass: "safari"
        case .filter: "line.3.horizontal.decrease"
        case .crown: "crown"
        case .trendingDown: "chart.line.downtrend.xyaxis"
        case .ban: "nosign"
        case .fileText: "doc.text"
        case .trendingUp: "chart.line.uptrend.xyaxis"
        case .arrowDownToLine: "arrow.down.to.line"
        case .plus: "plus"
        case .rocket: "paperplane.fill"
        case .clipboardList: "list.clipboard"
        case .clockPlus: "clock.arrow.circlepath"
        case .circleSlash: "circle.slash"
        case .play: "play.fill"
        case .pause: "pause.fill"
        case .archive: "archivebox"
        case .messageSquarePlus: "bubble.left.and.text.bubble.right"
        case .bookmark: "bookmark"
        case .zap: "bolt"
        case .flame: "flame"
        case .droplet: "drop"
        case .wifi: "wifi"
        case .building2: "building.2"
        case .smartphone: "iphone"
        case .wallet: "wallet.pass"
        case .hash: "number"
        case .tv: "tv"
        case .laptop: "laptopcomputer"
        case .monitor: "display"
        case .shuffle: "shuffle"
        case .wandSparkles: "wand.and.stars"
        case .arrowUpRight: "arrow.up.right"
        case .wrench: "wrench.adjustable"
        case .usersRound: "person.3"
        case .gift: "gift"
        case .partyPopper: "party.popper"
        case .graduationCap: "graduationcap"
        case .stethoscope: "stethoscope"
        case .calendarDays: "calendar"
        case .link: "link"
        // T6.4b Emergency info
        case .pin: "pin"
        case .power: "power"
        case .phoneCall: "phone.fill"
        case .phone: "phone"
        case .navigation: "location.north.fill"
        case .heartPulse: "waveform.path.ecg"
        case .siren: "exclamationmark.octagon.fill"
        case .cross: "cross.fill"
        case .flag: "flag.fill"
        case .userRound: "person.crop.circle.fill"
        case .flaskConical: "testtube.2"
        case .flameKindling: "flame.fill"
        case .printer: "printer"
        case .list: "list.bullet"
        case .listChecks: "checklist"
        case .alertTriangle: "exclamationmark.triangle"
        // T6.4b Documents
        case .image: "photo"
        case .imagePlus: "photo.badge.plus"
        case .fileType: "doc.fill"
        case .fileSpreadsheet: "tablecells"
        case .fileSignature: "doc.text.fill"
        case .landmark: "building.columns"
        case .stamp: "checkmark.seal.fill"
        case .idCard: "person.text.rectangle"
        case .folderLock: "lock.doc"
        case .uploadCloud: "icloud.and.arrow.up"
        case .calendarClock: "calendar.badge.clock"
        case .download: "arrow.down.circle"
        case .eyeOff: "eye.slash"
        case .keyRound: "key"
        case .leaf: "leaf"
        case .utensils: "fork.knife"
        case .baby: "figure.child"
        // T6.3b Maintenance. SF Symbols ships direct equivalents for most
        // — only `paint-roller` and `bell-ring` lack 1:1 glyphs, fall back
        // to `paintbrush.pointed` and `bell.badge` respectively.
        case .fan: "fan"
        case .cloudOff: "icloud.slash"
        case .cloudRain: "cloud.rain"
        case .refrigerator: "refrigerator"
        case .bug: "ant"
        case .trees: "tree"
        case .paintRoller: "paintbrush.pointed"
        case .bellRing: "bell.badge"
        // Place Intelligence dashboard glyphs. SF Symbols lacks 1:1 for
        // `test-tube` / `life-buoy` / `hard-hat` / `radio-tower`; fall back
        // to the closest system glyphs.
        case .sunrise: "sunrise"
        case .waves: "water.waves"
        case .activity: "waveform.path.ecg"
        case .testTube: "testtube.2"
        case .factory: "building.2"
        case .badgePercent: "percent"
        case .vote: "checkmark.seal"
        case .lifeBuoy: "lifepreserver"
        case .hardHat: "shield.lefthalf.filled"
        case .triangleAlert: "exclamationmark.triangle"
        case .cloud: "cloud"
        case .sunset: "sunset"
        case .flower2: "leaf"
        case .trash: "trash"
        case .zapOff: "bolt.slash"
        case .fileSearch: "doc.text.magnifyingglass"
        // T6.5e Mailbox Vault. SF Symbols has direct envelope glyphs;
        // `piggy-bank` and `arrow-down-up` lack 1:1 equivalents so fall
        // back to `dollarsign.circle` and `arrow.up.arrow.down` glyphs.
        case .mail: "envelope"
        case .mailOpen: "envelope.open"
        case .mailCheck: "envelope.badge"
        case .folderPlus: "folder.badge.plus"
        case .piggyBank: "dollarsign.circle"
        case .plane: "airplane"
        case .receiptText: "doc.plaintext"
        case .paperclip: "paperclip"
        case .arrowDownUp: "arrow.up.arrow.down"
        // T6.6b Chat conversation refresh. SF Symbols ships direct
        // `video` and a `hand.wave` glyph (iOS 17+); no native
        // `ellipsis.vertical` exists, so `moreVertical` collapses to the
        // standard `ellipsis` glyph — Swift sizes it the same and
        // visually distinguishing horizontal vs vertical ellipsis isn't
        // worth a custom drawable today.
        case .video: "video"
        case .moreVertical: "ellipsis"
        case .hand: "hand.wave"
        case .smile: "face.smiling"
        case .arrowUp: "arrow.up"
        // P1.3 Broadcast detail.
        case .reply: "arrowshape.turn.up.left"
        case .radioTower: "antenna.radiowaves.left.and.right"
        // P6.5 Public profile · Persona vs Local. `message-square` maps
        // to `message` (filled-bubble) for visual parity with the design;
        // `globe` maps directly.
        case .messageSquare: "message"
        case .globe: "globe"
        // P2.10 Document detail.
        case .externalLink: "arrow.up.right.square"
        case .refreshCw: "arrow.triangle.2.circlepath"
        // A10.3 Today briefing.
        case .snowflake: "snowflake"
        case .wind: "wind"
        case .bus: "bus.fill"
        case .droplets: "drop"
        // A.5 Professional profile. `rosette` is the closest cert-seal glyph;
        // `grip-vertical` collapses to the hamburger `line.3.horizontal`
        // since SF Symbols has no 2-column drag-dot handle.
        case .ribbon: "rosette"
        case .palette: "paintpalette"
        case .playCircle: "play.circle"
        case .gripVertical: "line.3.horizontal"
        case .grid3x3: "square.grid.3x3"
        case .square: "square"
        // A13.1 Add guest — allowed-areas chips.
        case .doorOpen: "door.left.hand.open"
        case .car: "car"
        case .warehouse: "house.lodge"
        // A15.3 AI Assistant. SF Symbols has no robot glyph; `bot` falls
        // back to `sparkles`, the house AI/magic glyph.
        case .bot: "sparkles"
        // A13.4 Transfer ownership. SF Symbols ships a true `faceid` glyph;
        // `arrow.left.arrow.right` matches Lucide's left/right swap arrows;
        // `arrow.down` is a direct match.
        case .scanFace: "faceid"
        case .arrowRightLeft: "arrow.left.arrow.right"
        case .arrowDown: "arrow.down"
        // A12.10 Create Business — SF Symbols ships direct `cpu` and
        // `box.truck` glyphs.
        case .cpu: "cpu"
        case .truck: "box.truck"
        // P5.2 / A14.6 Payments — SF Symbols ships `creditcard`.
        case .creditCard: "creditcard"
        // A13.13 Manage train. `chart.bar` paints the analytics row;
        // `calendar.badge.clock` is the closest "calendar with gear" glyph
        // (no native `calendar.gearshape`), used on the Edit-dates row.
        case .barChart3: "chart.bar"
        case .calendarCog: "calendar.badge.clock"
        // A13.15 Disambiguate. SF Symbols ships direct equivalents:
        // `person.crop.circle.badge.checkmark` for user-check, the share /
        // forward turn-arrow for `forward`, `keyboard`, and the u-turn
        // backward arrow for `undo-2`.
        case .userCheck: "person.crop.circle.badge.checkmark"
        case .forward: "arrowshape.turn.up.right"
        case .keyboard: "keyboard"
        case .undo2: "arrow.uturn.backward"
        // A17.9 Party. SF Symbols ships direct quote / cloud.sun /
        // tshirt.fill / xmark.circle / bell.slash / minus glyphs;
        // user-minus collapses to `person.badge.minus`; calendar-plus maps
        // onto the badge-plus variant.
        case .quote: "quote.bubble"
        case .cloudSun: "cloud.sun"
        case .shirt: "tshirt.fill"
        case .xCircle: "xmark.circle"
        case .bellOff: "bell.slash"
        case .minus: "minus"
        case .userMinus: "person.badge.minus"
        case .calendarPlus: "calendar.badge.plus"
        // A18.4 Waiting room. `doc.badge.plus` is the file-with-plus glyph;
        // SF Symbols ships no doc-with-warning glyph, so `file-warning`
        // falls back to the generic warning triangle.
        case .filePlus2: "doc.badge.plus"
        case .fileWarning: "exclamationmark.triangle"
        case .squarePen: "square.and.pencil"
        case .locateFixed: "scope"
        case .layers: "square.3.layers.3d"
        case .maximize: "arrow.up.left.and.arrow.down.right"
        case .mapPinOff: "mappin.slash"
        // A12.8 Magic Task wizard. `mic` and `circle-dot` have direct SF
        // equivalents; `layout-grid` maps to the 2×2 grid; `repeat-2`
        // collapses onto the same cycle glyph as `repeat`.
        case .mic: "mic"
        case .layoutGrid: "square.grid.2x2"
        case .circleDot: "smallcircle.filled.circle"
        case .repeat2: "arrow.triangle.2.circlepath"
        // Calendarly (scheduling). SF Symbols ships direct glyphs for most;
        // `calendar-sync` (no calendar+sync glyph → reuses the calendar+clock
        // vector), `search-x` (no magnifyingglass.slash → plain glass),
        // `ticket-check` (no ticket+check → plain ticket), and `share-2` (no
        // node-share graph → iOS share-up) fall back to the closest match.
        case .store: "storefront"
        case .qrCode: "qrcode"
        case .settings: "gearshape"
        case .settings2: "gearshape.2"
        case .workflow: "arrow.triangle.branch"
        case .moon: "moon"
        case .calendarSync: "calendar.badge.clock"
        case .calendarOff: "calendar.badge.minus"
        case .calendarX: "calendar.badge.exclamationmark"
        case .calendarCheck2: "calendar.badge.checkmark"
        case .calendarRange: "calendar.day.timeline.left"
        case .searchX: "magnifyingglass"
        case .ticket: "ticket"
        case .ticketCheck: "ticket"
        case .shieldPlus: "lock.shield"
        case .userX: "person.crop.circle.badge.xmark"
        case .rotateCcw: "arrow.counterclockwise"
        case .rotateCw: "arrow.clockwise"
        case .packageOpen: "shippingbox"
        case .tentTree: "tent"
        case .share2: "square.and.arrow.up"
        case .bellPlus: "bell.badge"
        case .percent: "percent"
        case .scissors: "scissors"
        case .scale: "scalemass"
        case .coffee: "cup.and.saucer"
        case .bedDouble: "bed.double"
        case .house: "house"
        case .move: "arrow.up.and.down.and.arrow.left.and.right"
        case .ellipsis: "ellipsis"
        case .ellipsisVertical: "ellipsis"
        case .circleAlert: "exclamationmark.circle"
        case .circleCheck: "checkmark.circle"
        case .checkCircle2: "checkmark.circle.fill"
        case .clockAlert: "clock.badge.exclamationmark"
        case .pauseCircle: "pause.circle"
        case .listOrdered: "list.number"
        case .loaderCircle: "circle.dotted"
        case .messageSquareText: "text.bubble"
        case .layoutTemplate: "rectangle.3.group"
        case .panelBottom: "dock.rectangle"
        case .squareMousePointer: "cursorarrow.rays"
        case .textCursorInput: "character.cursor.ibeam"
        case .handPointer: "hand.point.up.left"
        case .wand2: "wand.and.rays"
        // Calendarly — second batch. `link-2-off` (broken link) and
        // `calendar-search` have no SF equivalent; they fall back to the
        // closest glyph (plain link / magnifier).
        case .arrowRightCircle: "arrow.right.circle"
        case .link2Off: "link"
        case .calendarSearch: "magnifyingglass"
        case .gitMerge: "arrow.triangle.merge"
        }
    }
}

/// A Pantopus icon rendered at the requested size, stroke, and color.
///
/// Call sites MUST use this view — feature code never calls
/// `Image(systemName:)` directly. The verify-icons make target enforces
/// this.
///
/// - Parameters:
///   - icon: The icon to render.
///   - size: Target glyph size in points. Defaults to 20 to match the
///     design system's default inline icon.
///   - strokeWidth: Stroke width hint. SF Symbols map this to font weight
///     (thin/regular/bold) via `symbolRenderingMode(.monochrome)`; a true
///     variable-stroke implementation lands when we swap to Lucide SVGs.
///   - color: Tint color. Defaults to the primary text color.
///   - accessibilityLabel: Optional spoken label. Pass `nil` to hide the
///     icon from VoiceOver (decorative icons).
public struct Icon: View {
    private let icon: PantopusIcon
    private let size: CGFloat
    private let strokeWidth: CGFloat
    private let color: Color
    private let accessibilityLabel: String?

    public init(
        _ icon: PantopusIcon,
        size: CGFloat = 20,
        strokeWidth: CGFloat = 2,
        color: Color = Theme.Color.appText,
        accessibilityLabel: String? = nil
    ) {
        self.icon = icon
        self.size = size
        self.strokeWidth = strokeWidth
        self.color = color
        self.accessibilityLabel = accessibilityLabel
    }

    public var body: some View {
        Image(systemName: icon.sfSymbolName)
            .font(.system(size: size, weight: weight))
            .foregroundStyle(color)
            .frame(width: size, height: size)
            .accessibilityLabel(accessibilityLabel ?? "")
            .accessibilityHidden(accessibilityLabel == nil)
    }

    /// Map the numeric Lucide stroke width onto SF Symbol font weights.
    private var weight: Font.Weight {
        switch strokeWidth {
        case ..<1.5: .light
        case 1.5..<2.25: .regular
        case 2.25..<2.75: .medium
        default: .bold
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        Icon(.home)
        Icon(.bell, size: 28, color: Theme.Color.primary600)
        Icon(.shieldCheck, size: 32, strokeWidth: 2.5, color: Theme.Color.success)
        Icon(.trash2, size: 20, color: Theme.Color.error, accessibilityLabel: "Delete")
    }
    .padding()
    .background(Theme.Color.appSurface)
}
