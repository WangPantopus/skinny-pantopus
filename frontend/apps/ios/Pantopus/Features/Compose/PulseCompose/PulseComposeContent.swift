//
//  PulseComposeContent.swift
//  Pantopus
//
//  Pure-presentation content for the Pulse compose form. Mirrors the
//  EditProfileLoaded pattern: a struct of inputs the view-model feeds in,
//  exposed as its own composable so snapshot fixtures can render it
//  without touching the network layer.
//
// swiftlint:disable file_length type_body_length

import SwiftUI

/// Pure-data snapshot the content view renders against. Mirrors the
/// fields a `PulseComposeViewModel` exposes so the layout can be
/// driven by fixture data in tests.
@MainActor
public struct PulseComposeContentState: Equatable {
    public var activeIntent: PulseComposeIntent
    public var identity: PulseComposeIdentity
    public var visibility: PulseComposeVisibility
    public var lostFoundKind: PulseLostFoundKind
    public var lostFoundContactPref: PulseLostFoundContactPref
    public var announceAudience: PulseAnnounceAudience
    public var safetyAlertKind: PulseSafetyAlertKind
    public var askCategory: PulseAskCategory
    public var recommendRating: Int
    public var dealExpiresAt: Date
    public var eligibilityWarning: String?
    /// Soft nudge from `POST /api/posts/precheck` — dismissible.
    public var precheckNudge: String?
    /// Cooldown copy when the viewer is rate-limited / restricted.
    public var precheckCooldown: String?
    /// True when the precheck classified this as a visitor post.
    public var isVisitorPost: Bool
    public var fields: [PulseComposeField: FormFieldState]
    public var photos: [PulseComposePhoto]
    /// Explicitly tagged place — renders the filled location row.
    public var selectedPlaceTag: PostPlaceTag?
    /// True when the intent picker should render as a non-interactive
    /// chip row (edit mode — `post_type` is fixed at create time).
    public var isIntentLocked: Bool
    /// Three-step flow — hides inline intent/identity pickers.
    public var isFlowMode: Bool
    public var composePurpose: PulseComposePurpose?
    public var postingTargetLabel: String?

    public init(
        activeIntent: PulseComposeIntent,
        identity: PulseComposeIdentity = .personal,
        visibility: PulseComposeVisibility = .neighbors,
        lostFoundKind: PulseLostFoundKind = .lost,
        lostFoundContactPref: PulseLostFoundContactPref = .dm,
        announceAudience: PulseAnnounceAudience = .neighbors,
        safetyAlertKind: PulseSafetyAlertKind = .theft,
        askCategory: PulseAskCategory = .handyman,
        recommendRating: Int = 5,
        dealExpiresAt: Date = Date().addingTimeInterval(7 * 86400),
        eligibilityWarning: String? = nil,
        precheckNudge: String? = nil,
        precheckCooldown: String? = nil,
        isVisitorPost: Bool = false,
        fields: [PulseComposeField: FormFieldState] = [:],
        photos: [PulseComposePhoto] = [],
        selectedPlaceTag: PostPlaceTag? = nil,
        isIntentLocked: Bool = false,
        isFlowMode: Bool = false,
        composePurpose: PulseComposePurpose? = nil,
        postingTargetLabel: String? = nil
    ) {
        self.activeIntent = activeIntent
        self.identity = identity
        self.visibility = visibility
        self.lostFoundKind = lostFoundKind
        self.lostFoundContactPref = lostFoundContactPref
        self.announceAudience = announceAudience
        self.safetyAlertKind = safetyAlertKind
        self.askCategory = askCategory
        self.recommendRating = recommendRating
        self.dealExpiresAt = dealExpiresAt
        self.eligibilityWarning = eligibilityWarning
        self.precheckNudge = precheckNudge
        self.precheckCooldown = precheckCooldown
        self.isVisitorPost = isVisitorPost
        self.fields = fields
        self.photos = photos
        self.selectedPlaceTag = selectedPlaceTag
        self.isIntentLocked = isIntentLocked
        self.isFlowMode = isFlowMode
        self.composePurpose = composePurpose
        self.postingTargetLabel = postingTargetLabel
    }
}

/// Action callbacks the content view bubbles up to the view-model.
public struct PulseComposeContentActions {
    public var onSelectIntent: (PulseComposeIntent) -> Void
    public var onSelectIdentity: (PulseComposeIdentity) -> Void
    public var onSelectVisibility: (PulseComposeVisibility) -> Void
    public var onSelectLostFoundKind: (PulseLostFoundKind) -> Void
    public var onSelectContactPref: (PulseLostFoundContactPref) -> Void
    public var onSelectAnnounceAudience: (PulseAnnounceAudience) -> Void
    public var onSelectSafetyAlertKind: (PulseSafetyAlertKind) -> Void
    public var onSelectAskCategory: (PulseAskCategory) -> Void
    public var onSelectRecommendRating: (Int) -> Void
    public var onSelectDealExpires: (Date) -> Void
    public var onUpdateField: (PulseComposeField, String) -> Void
    public var onPickPhotos: () -> Void
    public var onRemovePhoto: (UUID) -> Void
    /// Body-field blur — runs `POST /api/posts/precheck`.
    public var onBodyEditingEnded: () -> Void
    /// X on the precheck nudge banner.
    public var onDismissPrecheckNudge: () -> Void
    /// "Add location" row (also re-opens the picker when a tag is set).
    public var onAddLocation: () -> Void
    /// ✕ on the filled location row.
    public var onClearLocation: () -> Void

    public init(
        onSelectIntent: @escaping (PulseComposeIntent) -> Void = { _ in },
        onSelectIdentity: @escaping (PulseComposeIdentity) -> Void = { _ in },
        onSelectVisibility: @escaping (PulseComposeVisibility) -> Void = { _ in },
        onSelectLostFoundKind: @escaping (PulseLostFoundKind) -> Void = { _ in },
        onSelectContactPref: @escaping (PulseLostFoundContactPref) -> Void = { _ in },
        onSelectAnnounceAudience: @escaping (PulseAnnounceAudience) -> Void = { _ in },
        onSelectSafetyAlertKind: @escaping (PulseSafetyAlertKind) -> Void = { _ in },
        onSelectAskCategory: @escaping (PulseAskCategory) -> Void = { _ in },
        onSelectRecommendRating: @escaping (Int) -> Void = { _ in },
        onSelectDealExpires: @escaping (Date) -> Void = { _ in },
        onUpdateField: @escaping (PulseComposeField, String) -> Void = { _, _ in },
        onPickPhotos: @escaping () -> Void = {},
        onRemovePhoto: @escaping (UUID) -> Void = { _ in },
        onBodyEditingEnded: @escaping () -> Void = {},
        onDismissPrecheckNudge: @escaping () -> Void = {},
        onAddLocation: @escaping () -> Void = {},
        onClearLocation: @escaping () -> Void = {}
    ) {
        self.onSelectIntent = onSelectIntent
        self.onSelectIdentity = onSelectIdentity
        self.onSelectVisibility = onSelectVisibility
        self.onSelectLostFoundKind = onSelectLostFoundKind
        self.onSelectContactPref = onSelectContactPref
        self.onSelectAnnounceAudience = onSelectAnnounceAudience
        self.onSelectSafetyAlertKind = onSelectSafetyAlertKind
        self.onSelectAskCategory = onSelectAskCategory
        self.onSelectRecommendRating = onSelectRecommendRating
        self.onSelectDealExpires = onSelectDealExpires
        self.onUpdateField = onUpdateField
        self.onPickPhotos = onPickPhotos
        self.onRemovePhoto = onRemovePhoto
        self.onBodyEditingEnded = onBodyEditingEnded
        self.onDismissPrecheckNudge = onDismissPrecheckNudge
        self.onAddLocation = onAddLocation
        self.onClearLocation = onClearLocation
    }
}

/// Body content of the Pulse compose form. Each intent reconfigures the
/// per-intent section below the shared selectors. Pure presentation —
/// no networking or persistence.
@MainActor
public struct PulseComposeContent: View {
    private let state: PulseComposeContentState
    private let actions: PulseComposeContentActions
    @FocusState private var isBodyFieldFocused: Bool

    public init(state: PulseComposeContentState, actions: PulseComposeContentActions) {
        self.state = state
        self.actions = actions
    }

    public var body: some View {
        // Single container — `.toolbar(placement: .keyboard)` on a `Group`
        // registers once per child and stacks duplicate Done buttons.
        VStack(alignment: .leading, spacing: Spacing.s5) {
            if state.isFlowMode {
                flowContextHeader
            } else {
                intentPicker
                identitySection
            }
            precheckBanners
            intentSpecificSection
            photosSection
            // Place tags are create-only (PostUpdateRequest carries no
            // location fields), so hide the row in edit mode — offering a
            // picker whose input the Save path drops would lose data.
            if !state.isIntentLocked {
                locationSection
            }
            if !state.isFlowMode || state.visibility != .connections {
                visibilitySection
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { isBodyFieldFocused = false }
                    .font(.system(size: 16, weight: .semibold))
                    .accessibilityIdentifier("composePulseBodyKeyboardDone")
            }
        }
    }

    @ViewBuilder
    private var flowContextHeader: some View {
        if let purpose = state.composePurpose {
            HStack(spacing: Spacing.s2) {
                Icon(purposeFlowIcon(purpose), size: 16, strokeWidth: 2, color: Theme.Color.primary600)
                Text(purpose.label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
            }
            .padding(.horizontal, Spacing.s4)
            .accessibilityIdentifier("composePulsePurposeBadge")
        }
        if let label = state.postingTargetLabel {
            HStack(spacing: Spacing.s2) {
                Icon(.mapPin, size: 14, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                Text("Posting to \(label)")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.s4)
            .accessibilityIdentifier("composePulsePostingBanner")
        }
        if let warning = state.eligibilityWarning {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.alertCircle, size: 16, strokeWidth: 2, color: Theme.Color.warning)
                Text(warning)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.warningBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .padding(.horizontal, Spacing.s4)
            .accessibilityIdentifier("composePulseEligibilityWarning")
        }
    }

    /// The three precheck outcomes RN renders above the body field:
    /// the hard cooldown block, the visitor badge, and the soft nudge
    /// (`PostComposerModal.tsx:617-657`).
    @ViewBuilder
    private var precheckBanners: some View {
        if let cooldown = state.precheckCooldown {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.ban, size: 16, strokeWidth: 2, color: Theme.Color.error)
                Text(cooldown)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.errorBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .padding(.horizontal, Spacing.s4)
            .accessibilityIdentifier("composePulsePrecheckCooldown")
        }
        if state.isVisitorPost {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.plane, size: 16, strokeWidth: 2, color: Theme.Color.success)
                Text("You're posting as a visitor. Your post will show a visitor badge.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.success)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.successBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .padding(.horizontal, Spacing.s4)
            .accessibilityIdentifier("composePulseVisitorBanner")
        }
        if let nudge = state.precheckNudge {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.lightbulb, size: 16, strokeWidth: 2, color: Theme.Color.warmAmber)
                Text(nudge)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: actions.onDismissPrecheckNudge) {
                    Icon(.x, size: 14, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Dismiss suggestion")
                .accessibilityIdentifier("composePulsePrecheckNudgeDismiss")
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.warmAmberBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .padding(.horizontal, Spacing.s4)
            .accessibilityIdentifier("composePulsePrecheckNudge")
        }
    }

    private func purposeFlowIcon(_ purpose: PulseComposePurpose) -> PantopusIcon {
        switch purpose {
        case .ask: .helpCircle
        case .headsUp: .megaphone
        case .recommend: .star
        case .lostFound: .search
        case .localUpdate: .fileText
        case .neighborhoodWin: .crown
        case .visitorGuide: .compass
        case .event: .calendar
        case .deal: .tag
        }
    }

    // MARK: - Intent picker

    private var intentPicker: some View {
        FormFieldGroup("Post type") {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(PulseComposeIntent.allCases, id: \.rawValue) { intent in
                        intentChip(intent)
                    }
                }
            }
            .accessibilityIdentifier("composePulseIntentPicker")
        }
    }

    private func intentChip(_ intent: PulseComposeIntent) -> some View {
        let active = state.activeIntent == intent
        let locked = state.isIntentLocked
        let textColor = active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong
        return Button { actions.onSelectIntent(intent) } label: {
            HStack(spacing: Spacing.s1) {
                Icon(
                    intent.icon,
                    size: 14,
                    strokeWidth: 2,
                    color: textColor
                )
                Text(intent.label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(textColor)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 32)
            .background(active ? Theme.Color.primary600 : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                    .stroke(active ? .clear : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(locked)
        .opacity(locked && !active ? 0.4 : 1)
        .accessibilityLabel("\(intent.label) post")
        .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("composePulseIntentChip_\(intent.rawValue)")
    }

    // MARK: - Identity

    private var identitySection: some View {
        FormFieldGroup("Posting as") {
            HStack(spacing: Spacing.s2) {
                ForEach(PulseComposeIdentity.allCases, id: \.rawValue) { identity in
                    identityChip(identity)
                }
            }
            .accessibilityIdentifier("composePulseIdentityPicker")
        }
    }

    private func identityChip(_ identity: PulseComposeIdentity) -> some View {
        let active = state.identity == identity
        let accent = identityAccent(for: identity)
        let fill = active ? accent.bg : Theme.Color.appSurface
        return Button { actions.onSelectIdentity(identity) } label: {
            HStack(spacing: Spacing.s1) {
                Circle().fill(accent.fg).frame(width: 8, height: 8)
                Text(identity.label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(active ? accent.fg : Theme.Color.appText)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 36)
            .frame(maxWidth: .infinity)
            .background(fill)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(active ? accent.fg : Theme.Color.appBorder, lineWidth: active ? 1.5 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(identity.label) identity")
        .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("composePulseIdentityChip_\(identity.rawValue)")
    }

    private struct IdentityAccent {
        let fg: Color
        let bg: Color
    }

    private func identityAccent(for identity: PulseComposeIdentity) -> IdentityAccent {
        switch identity {
        case .personal: IdentityAccent(fg: Theme.Color.personal, bg: Theme.Color.personalBg)
        case .home: IdentityAccent(fg: Theme.Color.home, bg: Theme.Color.homeBg)
        case .business: IdentityAccent(fg: Theme.Color.business, bg: Theme.Color.businessBg)
        }
    }

    // MARK: - Intent-specific section

    @ViewBuilder
    private var intentSpecificSection: some View {
        switch state.activeIntent {
        case .ask: askSection
        case .recommend: recommendSection
        case .event: eventSection
        case .lost: lostSection
        case .announce:
            switch state.composePurpose {
            case .headsUp: headsUpSection
            case .deal: dealSection
            default: announceSection
            }
        }
    }

    private var askSection: some View {
        FormFieldGroup("Ask") {
            textField(.title, label: "Title", placeholder: "What do you need?")
            categoryChipRow
            bodyField(label: "Details", placeholder: "Share what you're looking for…", minHeight: 96)
        }
    }

    private var categoryChipRow: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Category")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                ForEach(PulseAskCategory.allCases, id: \.rawValue) { cat in
                    chipPill(
                        label: cat.label,
                        isActive: state.askCategory == cat,
                        identifier: "composePulseAskCategory_\(cat.rawValue)"
                    ) {
                        actions.onSelectAskCategory(cat)
                    }
                }
            }
        }
    }

    private var recommendSection: some View {
        FormFieldGroup("Recommend") {
            textField(.recommendBusiness, label: "Business name", placeholder: "Search or type…")
            ratingPicker
            bodyField(label: "Why you recommend it", placeholder: "Share your experience…", minHeight: 96)
        }
    }

    private var ratingPicker: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Rating")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                ForEach(1...5, id: \.self) { value in
                    Button {
                        isBodyFieldFocused = false
                        actions.onSelectRecommendRating(value)
                    } label: {
                        Icon(
                            value <= state.recommendRating ? .starFill : .star,
                            size: 28,
                            strokeWidth: 2,
                            color: value <= state.recommendRating ? Theme.Color.warning : Theme.Color.appTextMuted
                        )
                        .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(value) star\(value == 1 ? "" : "s")")
                    .accessibilityAddTraits(value == state.recommendRating ? [.isButton, .isSelected] : .isButton)
                    .accessibilityIdentifier("composePulseRecommendStar_\(value)")
                }
                Spacer()
            }
        }
    }

    private var eventSection: some View {
        FormFieldGroup("Event") {
            textField(.title, label: "Title", placeholder: "What's happening?")
            dateField
            eventEndDateField
            textField(.eventLocation, label: "Location", placeholder: "Where?")
            bodyField(label: "Details", placeholder: "Add anything attendees should know…", minHeight: 96)
        }
    }

    @ViewBuilder private var eventEndDateField: some View {
        let snapshot = state.fields[.eventEndDate] ?? FormFieldState(id: "eventEndDate", originalValue: "")
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack {
                Text("End time (optional)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                if !snapshot.value.isEmpty {
                    Button("Clear") { actions.onUpdateField(.eventEndDate, "") }
                        .font(Theme.Font.role(.caption))
                        .foregroundStyle(Theme.Color.primary600)
                        .accessibilityIdentifier("composePulseField_eventEndDate_clear")
                }
            }
            DatePicker(
                "End time",
                selection: Binding(
                    get: { Self.parseDate(snapshot.value) ?? Date() },
                    set: { actions.onUpdateField(.eventEndDate, Self.formatDate($0)) }
                ),
                in: Date()...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .labelsHidden()
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        snapshot.error != nil ? Theme.Color.error : Theme.Color.appBorder,
                        lineWidth: 1
                    )
            )
            .opacity(snapshot.value.isEmpty ? 0.65 : 1)
            .accessibilityIdentifier("composePulseField_eventEndDate")
            if let error = snapshot.error {
                Text(error)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
            }
        }
    }

    @ViewBuilder private var dateField: some View {
        let snapshot = state.fields[.eventDate] ?? FormFieldState(id: "eventDate", originalValue: "")
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Date & time")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            DatePicker(
                "Date & time",
                selection: Binding(
                    get: { Self.parseDate(snapshot.value) ?? Date() },
                    set: { actions.onUpdateField(.eventDate, Self.formatDate($0)) }
                ),
                in: Date()...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .labelsHidden()
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        snapshot.error != nil ? Theme.Color.error : Theme.Color.appBorder,
                        lineWidth: 1
                    )
            )
            .accessibilityIdentifier("composePulseField_eventDate")
            if let error = snapshot.error {
                Text(error)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
            }
        }
    }

    private var lostSection: some View {
        FormFieldGroup("Lost & Found") {
            lostFoundToggle
            bodyField(label: "Description", placeholder: "Describe the item…", minHeight: 96)
            textField(.lostLastSeenLocation, label: "Last seen location", placeholder: "Where?")
            lastSeenDateField
            contactPrefRow
            if state.lostFoundContactPref == .phone {
                textField(.contactPhone, label: "Phone number", placeholder: "(555) 555-0123", keyboardType: .phonePad)
            }
        }
    }

    private var contactPrefRow: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("How should people contact you?")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                ForEach(PulseLostFoundContactPref.allCases, id: \.rawValue) { pref in
                    chipPill(
                        label: pref.label,
                        isActive: state.lostFoundContactPref == pref,
                        identifier: "composePulseContactPref_\(pref.rawValue)"
                    ) {
                        actions.onSelectContactPref(pref)
                    }
                }
            }
        }
    }

    private var dealSection: some View {
        FormFieldGroup("Deal") {
            textField(.title, label: "Headline", placeholder: "What's the deal?")
            textField(.dealBusinessName, label: "Business (optional)", placeholder: "Who's offering it?")
            dealExpiryField
            bodyField(label: "Details", placeholder: "Describe the deal and where to find it…", minHeight: 96)
        }
    }

    private var dealExpiryField: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Deal ends")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            DatePicker(
                "Deal ends",
                selection: Binding(
                    get: { state.dealExpiresAt },
                    set: { actions.onSelectDealExpires($0) }
                ),
                in: Date()...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .labelsHidden()
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityIdentifier("composePulseField_dealExpires")
        }
    }

    private var lostFoundToggle: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Type")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s0) {
                ForEach(PulseLostFoundKind.allCases, id: \.rawValue) { kind in
                    Button { actions.onSelectLostFoundKind(kind) } label: {
                        Text(kind.rawValue.capitalized)
                            .font(.system(size: 14, weight: .semibold))
                            .frame(maxWidth: .infinity, minHeight: 36)
                            .background(state.lostFoundKind == kind ? Theme.Color.primary600 : Theme.Color.appSurface)
                            .foregroundStyle(state.lostFoundKind == kind ? Theme.Color.appTextInverse : Theme.Color.appText)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(kind.rawValue.capitalized) item")
                    .accessibilityAddTraits(state.lostFoundKind == kind ? [.isButton, .isSelected] : .isButton)
                    .accessibilityIdentifier("composePulseLostFoundKind_\(kind.rawValue)")
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
    }

    @ViewBuilder private var lastSeenDateField: some View {
        let snapshot = state.fields[.lostLastSeenDate] ?? FormFieldState(id: "lostLastSeenDate", originalValue: "")
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack {
                Text("Last seen date (optional)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                if !snapshot.value.isEmpty {
                    Button("Clear") { actions.onUpdateField(.lostLastSeenDate, "") }
                        .font(Theme.Font.role(.caption))
                        .foregroundStyle(Theme.Color.primary600)
                        .accessibilityIdentifier("composePulseField_lostLastSeenDate_clear")
                }
            }
            DatePicker(
                "Last seen date",
                selection: Binding(
                    get: { Self.parseISO(snapshot.value) ?? Date() },
                    set: { actions.onUpdateField(.lostLastSeenDate, Self.formatISO($0)) }
                ),
                in: ...Date(),
                displayedComponents: .date
            )
            .labelsHidden()
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityIdentifier("composePulseField_lostLastSeenDate")
        }
    }

    private var headsUpSection: some View {
        FormFieldGroup("Heads Up") {
            safetyKindChipRow
            textField(.title, label: "Headline", placeholder: "What should people nearby know?")
            if !state.isFlowMode {
                audienceChipRow
            }
            bodyField(label: "Details", placeholder: "Describe what happened…", minHeight: 96)
        }
    }

    private var safetyKindChipRow: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Alert type")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(PulseSafetyAlertKind.allCases, id: \.rawValue) { kind in
                        chipPill(
                            label: kind.label,
                            isActive: state.safetyAlertKind == kind,
                            identifier: "composePulseSafetyKind_\(kind.rawValue)"
                        ) {
                            actions.onSelectSafetyAlertKind(kind)
                        }
                    }
                }
            }
        }
    }

    private var announceSection: some View {
        FormFieldGroup(announceSectionTitle) {
            textField(.title, label: "Headline", placeholder: "What's the news?")
            if !state.isFlowMode {
                audienceChipRow
            }
            bodyField(label: "Details", placeholder: announceBodyPlaceholder, minHeight: 96)
        }
    }

    private var announceSectionTitle: String {
        switch state.composePurpose {
        case .localUpdate: "Local Update"
        case .neighborhoodWin: "Neighborhood Win"
        case .visitorGuide: "Visitor Guide"
        default: "Announcement"
        }
    }

    private var announceBodyPlaceholder: String {
        state.composePurpose?.placeholder ?? "Share what your neighbors should know…"
    }

    private var audienceChipRow: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Audience")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                ForEach(PulseAnnounceAudience.allCases, id: \.rawValue) { audience in
                    chipPill(
                        label: audience.label,
                        isActive: state.announceAudience == audience,
                        identifier: "composePulseAnnounceAudience_\(audience.rawValue)"
                    ) {
                        actions.onSelectAnnounceAudience(audience)
                    }
                }
            }
        }
    }

    // MARK: - Photos

    private var photosSection: some View {
        FormFieldGroup("Photos (optional)") {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack(spacing: Spacing.s2) {
                    ForEach(state.photos) { photo in
                        photoThumbnail(photo)
                    }
                    if state.photos.count < pulseComposeMaxPhotos {
                        addPhotoTile
                    }
                }
                Text("Up to \(pulseComposeMaxPhotos) images. Tap a photo to remove it.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private func photoThumbnail(_ photo: PulseComposePhoto) -> some View {
        Button { actions.onRemovePhoto(photo.id) } label: {
            ZStack(alignment: .topTrailing) {
                if let image = UIImage(data: photo.data) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 64, height: 64)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                } else {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.appSurfaceSunken)
                        .frame(width: 64, height: 64)
                }
                Circle()
                    .fill(Theme.Color.appText.opacity(0.7))
                    .frame(width: 18, height: 18)
                    .overlay(
                        Icon(.x, size: 10, strokeWidth: 2.5, color: Theme.Color.appTextInverse)
                    )
                    .padding(2)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Remove photo")
        .accessibilityIdentifier("composePulsePhotoThumb_\(photo.id.uuidString)")
    }

    private var addPhotoTile: some View {
        Button { actions.onPickPhotos() } label: {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                .frame(width: 64, height: 64)
                .overlay(
                    VStack(spacing: 2) {
                        Icon(.camera, size: 18, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                        Text("Add")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add photo")
        .accessibilityIdentifier("composePulseAddPhoto")
    }

    // MARK: - Location

    /// Instagram-style place tag — `PlacePickerSheet` feeds the tag.
    private var locationSection: some View {
        FormFieldGroup("Location (optional)") {
            if let tag = state.selectedPlaceTag {
                selectedLocationRow(tag)
            } else {
                addLocationRow
            }
        }
    }

    private var addLocationRow: some View {
        Button(action: actions.onAddLocation) {
            HStack(spacing: Spacing.s2) {
                Icon(.mapPin, size: 16, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                Text("Add location")
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 14, strokeWidth: 2, color: Theme.Color.appTextMuted)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add location")
        .accessibilityIdentifier("composePulseAddLocationRow")
    }

    private func selectedLocationRow(_ tag: PostPlaceTag) -> some View {
        HStack(spacing: Spacing.s2) {
            // Row body re-opens the picker to swap the tag.
            Button(action: actions.onAddLocation) {
                HStack(spacing: Spacing.s2) {
                    Icon(.mapPin, size: 16, strokeWidth: 2, color: Theme.Color.primary600)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(tag.name)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        if let address = tag.address, !address.isEmpty {
                            Text(address)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: Spacing.s2)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Change location, \(tag.name)")
            .accessibilityIdentifier("composePulseAddLocationRow")
            Button(action: actions.onClearLocation) {
                Icon(.x, size: 16, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove location")
            .accessibilityIdentifier("composePulseClearLocationButton")
        }
        .frame(minHeight: 44)
    }

    // MARK: - Visibility

    private var visibilitySection: some View {
        FormFieldGroup("Who can see this") {
            VStack(spacing: Spacing.s2) {
                ForEach(PulseComposeVisibility.allCases, id: \.rawValue) { option in
                    visibilityRow(option)
                }
            }
        }
    }

    private func visibilityRow(_ option: PulseComposeVisibility) -> some View {
        let active = state.visibility == option
        return Button { actions.onSelectVisibility(option) } label: {
            HStack(spacing: Spacing.s2) {
                ZStack {
                    Circle()
                        .stroke(active ? Theme.Color.primary600 : Theme.Color.appBorderStrong, lineWidth: 2)
                        .frame(width: 20, height: 20)
                    if active {
                        Circle()
                            .fill(Theme.Color.primary600)
                            .frame(width: 10, height: 10)
                    }
                }
                Text(option.label)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
            }
            .padding(.horizontal, Spacing.s2)
            .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(option.label)
        .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("composePulseVisibility_\(option.rawValue)")
    }

    // MARK: - Field builders

    private func textField(
        _ key: PulseComposeField,
        label: String,
        placeholder: String = "",
        keyboardType: UIKeyboardType = .default
    ) -> some View {
        let snapshot = state.fields[key] ?? FormFieldState(id: key.rawValue, originalValue: "")
        let binding = Binding<String>(
            get: { snapshot.value },
            set: { actions.onUpdateField(key, $0) }
        )
        return PantopusTextField(
            label,
            text: binding,
            placeholder: placeholder,
            state: fieldState(for: snapshot),
            keyboardType: keyboardType,
            identifier: "composePulseField_\(key.rawValue)"
        )
    }

    @ViewBuilder
    private func bodyField(label: String, placeholder: String, minHeight: CGFloat) -> some View {
        let snapshot = state.fields[.body] ?? FormFieldState(id: "body", originalValue: "")
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: Binding(
                    get: { snapshot.value },
                    set: { actions.onUpdateField(.body, $0) }
                ))
                .focused($isBodyFieldFocused)
                // RN runs the pre-post safety precheck on body blur
                // (`PostComposerModal.tsx:801`).
                .onChange(of: isBodyFieldFocused) { _, focused in
                    if !focused { actions.onBodyEditingEnded() }
                }
                .scrollContentBackground(.hidden)
                .frame(minHeight: minHeight)
                .padding(Spacing.s2)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(
                            snapshot.error != nil ? Theme.Color.error : Theme.Color.appBorder,
                            lineWidth: 1
                        )
                )
                if snapshot.value.isEmpty {
                    Text(placeholder)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, Spacing.s3)
                        .allowsHitTesting(false)
                }
            }
            if let error = snapshot.error {
                Text(error)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
            }
        }
        .accessibilityIdentifier("composePulseField_body")
    }

    private func chipPill(label: String, isActive: Bool, identifier: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                .padding(.horizontal, Spacing.s3)
                .frame(minHeight: 30)
                .background(isActive ? Theme.Color.primary600 : Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                        .stroke(isActive ? .clear : Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier(identifier)
    }

    private func fieldState(for snapshot: FormFieldState) -> PantopusFieldState {
        if let error = snapshot.error { return .error(error) }
        if snapshot.touched, snapshot.isDirty { return .valid }
        return .default
    }

    // MARK: - Date helpers

    private static func makeISOFormatter() -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }

    private static func parseISO(_ value: String) -> Date? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        return makeISOFormatter().date(from: trimmed)
    }

    private static func formatISO(_ date: Date) -> String {
        makeISOFormatter().string(from: date)
    }

    /// Date+time encoder for the Event picker. Emits a `yyyy-MM-dd HH:mm`
    /// shape the view-model recognises and converts to ISO-8601 before
    /// submit.
    private static func parseDate(_ value: String) -> Date? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return formatter.date(from: trimmed)
    }

    private static func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return formatter.string(from: date)
    }
}
