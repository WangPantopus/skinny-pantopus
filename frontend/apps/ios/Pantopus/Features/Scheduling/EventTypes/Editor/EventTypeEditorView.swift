//
//  EventTypeEditorView.swift
//  Pantopus
//
//  Stream I2 — B2 Event Type / Service Editor (full screen). One sectioned
//  FormShell for create + edit: basics + colour, durations, location,
//  availability link, business assignment, collapsible advanced limits,
//  visibility toggles, the flagged pricing card, and link-out rows to intake
//  questions / booking limits / reminders.
//

// swiftlint:disable file_length
import SwiftUI

// swiftlint:disable:next type_body_length
struct EventTypeEditorView: View {
    @State private var viewModel: EventTypeEditorViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: EventTypeEditorViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    private var isReady: Bool {
        if case .ready = viewModel.phase { return true }
        return false
    }

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .navigationTitle("Event type")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(isReady ? .hidden : .visible, for: .navigationBar)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .task { await viewModel.load() }
            .accessibilityIdentifier("scheduling.eventType.editor")
            .alert("Couldn't save", isPresented: saveErrorPresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.saveError ?? "")
            }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .loading:
            loadingSkeleton
        case let .error(message):
            ErrorState(headline: "Couldn't load this event type", message: message) {
                await viewModel.reload()
            }
        case .ready:
            editor
        }
    }

    private var editor: some View {
        FormShell(
            title: "Event type",
            leading: .back,
            rightActionLabel: "Save",
            isValid: viewModel.formValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: { dismiss() },
            onCommit: { Task { if await viewModel.save() { dismiss() } } },
            content: {
                Group {
                    Group {
                        identityPill
                        basicsGroup
                        durationGroup
                        locationGroup
                        if viewModel.isEditing {
                            availabilityGroup
                        }
                    }
                    if viewModel.showsAssignment { assignmentGroup }
                    if viewModel.isEditing {
                        advancedGroup
                        visibilityGroup
                    }
                    pricingGroup
                    if viewModel.isEditing { moreGroup }
                }
                .disabled(viewModel.isSaving)
            },
            stickyBottom: {
                AnyView(
                    EventTypeSaveBar(
                        label: viewModel.saveBarLabel,
                        isEnabled: viewModel.formValid && viewModel.isDirty && !viewModel.isSaving,
                        isSaving: viewModel.isSaving
                    ) { Task { if await viewModel.save() { dismiss() } } }
                )
            }
        )
    }

    private var accent: Color {
        viewModel.owner.theme.accent
    }

    // MARK: Identity pill

    private var identityPill: some View {
        let theme = viewModel.owner.theme
        return HStack(spacing: 5) {
            Icon(theme.icon, size: 11, strokeWidth: 2.4, color: theme.accent)
            Text(theme.title.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(theme.accent)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 3)
        .background(theme.accentBg)
        .clipShape(Capsule())
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s4)
    }

    // MARK: Basics

    /// Design `BasicsCard` — Name, Description (multiline), Colour. The booking
    /// link slug is auto-derived from the name (the design omits a slug field),
    /// so the only slug affordance is its auto-derivation; a SLUG_TAKEN error
    /// surfaces under the name (resolve by renaming).
    private var basicsGroup: some View {
        PillarFieldGroup("Basics", accent: accent) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                BorderedTextField(label: "Name", isError: viewModel.nameError != nil || viewModel.slugError != nil) {
                    TextField("e.g. Intro call", text: Binding(
                        get: { viewModel.name },
                        set: { viewModel.updateName($0) }
                    ))
                    .accessibilityIdentifier("scheduling.eventType.nameField")
                }
                if let nameError = viewModel.nameError {
                    fieldError(nameError)
                } else if let slugError = viewModel.slugError {
                    fieldError(slugError)
                }
            }
            BorderedTextField(label: "Description") {
                TextField("What should people expect?", text: $viewModel.detailDescription, axis: .vertical)
                    .lineLimit(2...4)
                    .accessibilityIdentifier("scheduling.eventType.descriptionField")
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Color")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextStrong)
                EventTypeColorPicker(selection: $viewModel.swatch)
            }
        }
    }

    // MARK: Duration

    private var durationGroup: some View {
        PillarFieldGroup("Duration", accent: accent) {
            EventTypeSegmented(
                options: [DurationMode.single, .multiple],
                selection: Binding(
                    get: { viewModel.durationMode },
                    set: { viewModel.setDurationMode($0) }
                ),
                label: { $0 == .single ? "Single" : "Multiple" },
                accessibilityID: "scheduling.eventType.durationMode"
            )
            if viewModel.durationMode == .single {
                singleDuration
            } else {
                multipleDurations
            }
        }
    }

    /// Design `DurationCard` single mode — a "Length" label over a wrap row that
    /// holds the compact bordered stepper inline with the 15/45/60 quick chips.
    private var singleDuration: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Length")
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appTextStrong)
            HStack(spacing: Spacing.s2) {
                CompactDurationStepper(value: singleDurationBinding)
                    .accessibilityIdentifier("scheduling.eventType.singleDuration")
                ForEach([15, 45, 60], id: \.self) { minutes in
                    QuickDurationChip(minutes: minutes) {
                        viewModel.setSingleDuration(minutes)
                    }
                }
                Spacer(minLength: Spacing.s0)
            }
            if let durationError = viewModel.durationError { fieldError(durationError) }
        }
    }

    private var multipleDurations: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(durationOptions, id: \.self) { minutes in
                        DurationChip(
                            minutes: minutes,
                            isSelected: viewModel.durations.contains(minutes),
                            isDefault: viewModel.defaultDuration == minutes && viewModel.durations.contains(minutes)
                        ) { viewModel.selectDuration(minutes) }
                    }
                }
            }
            Text("Tap to offer a length; tap a selected one to make it the default.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            if let durationError = viewModel.durationError { fieldError(durationError) }
        }
    }

    // MARK: Location

    private var locationGroup: some View {
        PillarFieldGroup("Location", accent: accent) {
            EventTypeSegmented(
                options: locationOptions,
                selection: $viewModel.location,
                label: { $0.label },
                accessibilityID: "scheduling.eventType.location"
            )
            if let field = viewModel.location.detailField {
                // Design `LocationCard` renders the detail as a labelled
                // `TextInput` (label above, 1.5px bordered box) — not a bare
                // field. Mirrors Android's `EtTextField(label = …)`.
                BorderedTextField(label: field.label) {
                    TextField(field.placeholder, text: $viewModel.locationDetail)
                        .accessibilityLabel(field.label)
                        .accessibilityIdentifier("scheduling.eventType.locationDetail")
                }
            }
        }
    }

    // MARK: Availability

    private var availabilityGroup: some View {
        PillarFieldGroup("Availability", accent: accent) {
            EventTypeNavRow(
                icon: .calendarClock,
                title: "Schedule",
                subtitle: "Working hours"
            ) { viewModel.openAvailability() }
        }
    }

    // MARK: Assignment (business)

    private var assignmentGroup: some View {
        PillarFieldGroup("Assignment", accent: accent) {
            // Design `AssignmentCard` segment is 3 options — Anyone / Specific /
            // Collective — mapped to backend modes (round_robin / one_on_one /
            // collective), matching Android's ASSIGNMENT_OPTIONS. The backend
            // `group` mode is not surfaced in this segment (design omits it).
            EventTypeSegmented(
                options: EventAssignmentMode.segmentOptions,
                selection: $viewModel.assignment,
                label: { $0.segmentLabel },
                accessibilityID: "scheduling.eventType.assignment"
            )
            if viewModel.assignment == .collective {
                collectiveControls
            } else {
                Text(viewModel.assignment.caption)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            if viewModel.assignment == .group {
                LabeledStepper(
                    title: "Seats per slot",
                    caption: "How many people can take the same time.",
                    value: $viewModel.seatCap,
                    range: 1...1000
                ) { "\($0)" }
            }
        }
    }

    private var collectiveControls: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Everyone must be free. The booking goes on every required host's calendar.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            LabeledStepper(
                title: "Required hosts",
                caption: "How many hosts must be available for a slot to open.",
                value: $viewModel.requiredHosts,
                range: 1...50
            ) { "\($0)" }
            // Design `MemberAvatars` row (event-editor-frames.jsx:129) — overlapping
            // avatar discs; all shown discs represent required hosts (total member
            // count is not yet surfaced by the event-type DTO; real initials can be
            // wired in once the API exposes a `members` array on the event type).
            CollectiveMemberAvatarStack(
                totalCount: viewModel.requiredHosts,
                requiredCount: viewModel.requiredHosts,
                accent: accent
            )
        }
    }

    // MARK: Advanced (collapsible)

    private var advancedGroup: some View {
        PillarFieldGroup(
            "Advanced",
            accent: accent,
            isExpanded: viewModel.advancedExpanded,
            onToggle: {
                withAnimation(.easeInOut(duration: 0.2)) { viewModel.advancedExpanded.toggle() }
            },
            content: {
                if viewModel.advancedExpanded { advancedControls }
            }
        )
    }

    private var advancedControls: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                LabeledStepper(title: "Buffer before", value: $viewModel.bufferBeforeMin, range: 0...240, step: 5) {
                    "\($0) min"
                }
                LabeledStepper(title: "Buffer after", value: $viewModel.bufferAfterMin, range: 0...240, step: 5) {
                    "\($0) min"
                }
            }
            LabeledStepper(
                title: "Minimum notice",
                caption: "Can't be booked inside this window.",
                value: $viewModel.minNoticeHours,
                range: 0...168
            ) { "\($0) \($0 == 1 ? "hour" : "hours")" }
            LabeledStepper(
                title: "Booking horizon",
                caption: "How far ahead people can book.",
                value: $viewModel.maxHorizonDays,
                range: 1...730
            ) { "\($0) days" }
            LabeledStepper(
                title: "Per-day cap",
                caption: "0 means no daily limit.",
                value: $viewModel.dailyCap,
                range: 0...50
            ) { $0 == 0 ? "No limit" : "\($0)/day" }
        }
    }

    // MARK: Visibility

    private var visibilityGroup: some View {
        PillarFieldGroup(nil, accent: accent) {
            IconToggleRow(
                icon: .userCheck,
                title: "Require approval",
                subtitle: "Approve each booking before it's confirmed.",
                isOn: $viewModel.requiresApproval
            )
            Divider().background(Theme.Color.appBorderSubtle)
            IconToggleRow(
                icon: .eyeOff,
                title: "Unlisted (link only)",
                subtitle: "Hidden from your public page.",
                isOn: $viewModel.visibilitySecret
            )
            Divider().background(Theme.Color.appBorderSubtle)
            IconToggleRow(
                icon: .circleCheck,
                title: "Active",
                subtitle: "People can book this right now.",
                isOn: $viewModel.isActiveField
            )
        }
    }

    // MARK: Pricing (flagged)

    @ViewBuilder
    private var pricingGroup: some View {
        if viewModel.paidVisible {
            PillarFieldGroup("Pricing & payment", accent: accent) {
                CaptionToggle(
                    title: "Charge for this booking",
                    caption: "Collect payment when someone books.",
                    isOn: $viewModel.chargeEnabled
                )
                if viewModel.chargeEnabled { pricingControls }
            }
        }
    }

    private var pricingControls: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Divider().background(Theme.Color.appBorderSubtle)
            if viewModel.stripeConnected == false {
                StripeConnectCard { viewModel.connectStripe() }
            } else {
                HStack(alignment: .bottom, spacing: Spacing.s3) {
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Text("Price")
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appTextStrong)
                        TextField("0", text: $viewModel.priceDollars)
                            .font(.system(size: 13, weight: .medium, design: .monospaced))
                            .foregroundStyle(Theme.Color.appText)
                            .keyboardType(.decimalPad)
                            .accessibilityIdentifier("scheduling.eventType.price")
                    }
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Text("Currency")
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appTextStrong)
                        EventTypeSegmented(
                            options: ["USD", "EUR"],
                            selection: $viewModel.currency,
                            label: { $0 },
                            accessibilityID: "scheduling.eventType.currency"
                        )
                        .frame(maxWidth: 130)
                    }
                }
                // Design `PricingCard` "Collect" segmented — Full amount / Deposit.
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text("Collect")
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextStrong)
                    EventTypeSegmented(
                        options: CollectMode.allCases,
                        selection: $viewModel.collectMode,
                        label: { $0.label },
                        accessibilityID: "scheduling.eventType.collect"
                    )
                }
            }
        }
    }

    // MARK: More (link-outs)

    private var moreGroup: some View {
        PillarFieldGroup(nil, accent: accent) {
            EventTypeNavRow(
                icon: .listChecks,
                title: "Intake questions",
                subtitle: linkSubtitle(viewModel.intakeQuestionsValue),
                isEnabled: viewModel.isEditing
            ) { viewModel.openIntakeQuestions() }
            Divider().background(Theme.Color.appBorderSubtle)
            EventTypeNavRow(
                icon: .gauge,
                title: "Booking limits",
                subtitle: linkSubtitle(viewModel.bookingLimitsValue),
                isEnabled: viewModel.isEditing
            ) { viewModel.openBookingLimits() }
            Divider().background(Theme.Color.appBorderSubtle)
            EventTypeNavRow(
                icon: .bell,
                title: "Reminders",
                subtitle: "Default"
            ) { viewModel.openReminders() }
        }
    }

    private func linkSubtitle(_ base: String) -> String {
        viewModel.isEditing ? base : "Save first to set these up"
    }

    // MARK: Helpers

    private func fieldError(_ message: String) -> some View {
        Text(message)
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.error)
    }

    private var singleDurationBinding: Binding<Int> {
        Binding(get: { viewModel.durations.first ?? 30 }, set: { viewModel.setSingleDuration($0) })
    }

    private var durationOptions: [Int] {
        Array(Set(EventTypeEditorViewModel.durationPresets + viewModel.durations)).sorted()
    }

    private var locationOptions: [EventLocationMode] {
        // Design `LocationCard` order: In person / Phone / Video / Custom (matches Android).
        var options: [EventLocationMode] = [.inPerson, .phone, .video, .custom]
        if viewModel.location == .ask { options.append(.ask) }
        return options
    }

    private var loadingSkeleton: some View {
        ScrollView {
            VStack(spacing: Spacing.s5) {
                ForEach(0..<4, id: \.self) { _ in
                    Shimmer(height: 96, cornerRadius: Radii.lg)
                        .padding(.horizontal, Spacing.s4)
                }
            }
            .padding(.vertical, Spacing.s4)
        }
    }

    private var saveErrorPresented: Binding<Bool> {
        Binding(get: { viewModel.saveError != nil }, set: { if !$0 { viewModel.saveError = nil } })
    }
}
