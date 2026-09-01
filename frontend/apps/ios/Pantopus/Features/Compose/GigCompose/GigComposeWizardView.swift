//
//  GigComposeWizardView.swift
//  Pantopus
//
//  A12.8 Post-a-Task wizard. Four-step describe-first flow (Describe →
//  Fill gaps → Budget & mode → Review) + terminal success step with a
//  10-second undo window, built on the shared `WizardShell`. Mirrors
//  `AddHomeWizardView`'s structure: a `@SceneStorage` mirror of the
//  form, an `onChange` persist hook, and a `pendingEvent` handler that
//  bridges back to the navigation host.
//

// swiftlint:disable file_length

import PhotosUI
import SwiftUI

/// Pushed onto a tab stack from the Gigs FAB (Hub) and the You tab's
/// "Post a task" / "Repost" entry points. On success the host pops the
/// wizard and routes to the new gig's detail via `onOpenGigDetail`.
public struct GigComposeWizardView: View {
    @State private var viewModel: GigComposeViewModel
    // V2 — the A12.8 4-step form shape; stale 6-step V1 snapshots fail
    // decoding and are discarded.
    @SceneStorage("composeGigWizardFormV2") private var storedForm: String = ""
    @State private var hasRestored = false
    @Environment(\.dismiss) private var dismiss

    private let preselectedCategory: GigComposeCategory?
    private let onOpenGigDetail: (String) -> Void

    init(
        preselectedCategoryKey: String? = nil,
        viewModel: GigComposeViewModel? = nil,
        onOpenGigDetail: @escaping (String) -> Void
    ) {
        preselectedCategory = GigComposeCategory.from(rawKey: preselectedCategoryKey)
        self.onOpenGigDetail = onOpenGigDetail
        // Always start with `.empty` so the SceneStorage restore can win
        // when the user backgrounds + resumes mid-wizard. The
        // preselected category is applied in `onAppear` only when the
        // restored snapshot is empty (or absent).
        if let viewModel {
            _viewModel = State(initialValue: viewModel)
        } else {
            _viewModel = State(initialValue: GigComposeViewModel(initialState: .empty))
        }
    }

    public var body: some View {
        // `@Bindable` projects a binding to the `@Observable` model's
        // `activePickerSheet` so the E.1 picker sheets present via
        // `.sheet(item:)`.
        @Bindable var bindable = viewModel
        return WizardShell(model: viewModel) {
            stepContent
            if let info = viewModel.infoMessage {
                GigComposeInfoBanner(message: info)
            }
            if let error = viewModel.errorMessage {
                GigComposeErrorBanner(message: error)
            }
        }
        .onAppear {
            restoreIfNeeded()
            if let stepNumber = viewModel.currentStep.stepNumber {
                Analytics.track(
                    .screenComposeGigWizardStepViewed(
                        stepNumber: stepNumber,
                        stepName: String(describing: viewModel.currentStep)
                    )
                )
            }
        }
        .onChange(of: viewModel.form) { _, _ in persist() }
        .onChange(of: viewModel.pendingEvent) { _, event in handle(event) }
        // P6c — fetch business seats once so the identity chip can offer
        // persona switching (silent no-op for business-less users).
        .task { await viewModel.loadIdentitiesIfNeeded() }
        .accessibilityIdentifier("composeGigWizard")
        .sheet(item: $bindable.activePickerSheet) { sheet in
            GigPickerSheetHost(sheet: sheet, viewModel: viewModel)
        }
    }

    @ViewBuilder
    private var stepContent: some View {
        switch viewModel.currentStep {
        case .describe:
            // Step 1 renders Magic describe (default) or the manual
            // category picker, toggled by `form.composeMode`.
            if viewModel.form.composeMode == .magic {
                MagicDescribeStep(viewModel: viewModel)
                    .task { await viewModel.loadTemplatesIfNeeded() }
            } else {
                ManualPickerStep(viewModel: viewModel)
            }
        case .fillGaps: FillGapsStep(viewModel: viewModel)
        case .budget: BudgetStep(viewModel: viewModel)
        case .review: ReviewStep(viewModel: viewModel)
        case .success: SuccessStep(viewModel: viewModel)
        }
    }

    private func restoreIfNeeded() {
        guard !hasRestored else { return }
        hasRestored = true
        if let data = storedForm.data(using: .utf8),
           let snapshot = try? JSONDecoder().decode(GigComposeFormState.self, from: data) {
            viewModel.restore(from: snapshot)
        }
        // Apply the route's preselected category last — `restore(from:)`
        // is a no-op if a snapshot already populated the form, so we
        // only seed the category when the user is starting fresh. A
        // preselected category means the user already chose one, so land
        // on the manual picker (tile pre-selected) rather than Magic.
        if let preselected = preselectedCategory, viewModel.form == .empty {
            viewModel.setComposeMode(.manual)
            viewModel.selectCategory(preselected)
        }
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(viewModel.form),
              let json = String(data: data, encoding: .utf8)
        else { return }
        storedForm = json
    }

    private func handle(_ event: GigComposeOutboundEvent?) {
        guard let event else { return }
        switch event {
        case .dismiss:
            storedForm = ""
            dismiss()
        case let .openGigDetail(gigId):
            storedForm = ""
            onOpenGigDetail(gigId)
        }
        viewModel.pendingEvent = nil
    }
}

// MARK: - Step 2: Fill gaps

/// Title + description (AI-prefilled, editable) + photos + the When /
/// Where pickers + the active archetype's module field group.
private struct FillGapsStep: View {
    @Bindable var viewModel: GigComposeViewModel
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showsPhotosPicker = false

    var body: some View {
        HeadlineBlock("Fill in the gaps")
        SubcopyBlock("Check what Pantopus drafted, add photos, and answer the questions that matter for this kind of task.")
        FormFieldsBlock {
            PantopusTextField(
                "Title",
                text: titleBinding,
                placeholder: "Hang 3 shelves in the living room",
                identifier: "composeGig_title"
            )
            DescriptionField(text: descriptionBinding)
            CharacterCounter(
                current: viewModel.form.description.count,
                min: GigComposeLimits.descriptionMin,
                max: GigComposeLimits.descriptionMax
            )
        }
        // P15.5 — real photo pipeline: PhotosPicker selection → immediate
        // background upload per photo with per-tile state (spinner /
        // tap-to-retry / uploaded). First photo is the cover.
        PhotoSlotsRow(
            attachments: viewModel.attachments,
            max: GigComposeLimits.maxPhotos,
            onAdd: { showsPhotosPicker = true },
            onRetry: { viewModel.retryUpload(id: $0) },
            onRemove: { viewModel.removeAttachment(id: $0) }
        )
        .photosPicker(
            isPresented: $showsPhotosPicker,
            selection: $pickerItems,
            maxSelectionCount: max(1, GigComposeLimits.maxPhotos - viewModel.attachments.count),
            matching: .images
        )
        .onChange(of: pickerItems) { _, newItems in
            handlePicked(newItems)
        }
        WhenFields(viewModel: viewModel)
        WhereFields(viewModel: viewModel)
        ModuleGroupFields(viewModel: viewModel)
        if viewModel.form.isUrgent {
            UrgentModuleFields(viewModel: viewModel)
        }
    }

    private func handlePicked(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        Task {
            for item in items {
                if let data = try? await item.loadTransferable(type: Data.self), !data.isEmpty {
                    viewModel.addPhotoData(data)
                }
            }
            pickerItems = []
        }
    }

    private var titleBinding: Binding<String> {
        Binding(
            get: { viewModel.form.title },
            set: { viewModel.setTitle($0) }
        )
    }

    private var descriptionBinding: Binding<String> {
        Binding(
            get: { viewModel.form.description },
            set: { viewModel.setDescription($0) }
        )
    }
}

/// When — schedule-type radios + the one-time date picker.
private struct WhenFields: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline("WHEN")
            ForEach(GigComposeScheduleType.allCases, id: \.self) { type in
                RadioRow(
                    label: type.label,
                    subcopy: subcopy(for: type),
                    isSelected: viewModel.form.scheduleType == type,
                    identifier: "composeGig_schedule_\(type.rawValue)"
                ) {
                    viewModel.selectScheduleType(type)
                }
            }
            if viewModel.form.scheduleType == .oneTime {
                OneTimeDatePicker(viewModel: viewModel)
            }
        }
    }

    private func subcopy(for type: GigComposeScheduleType) -> String {
        switch type {
        case .oneTime: "A single date and time."
        case .recurring: "Repeats on a regular cadence."
        case .flexible: "Whenever works for both of you."
        }
    }
}

/// Where — location-mode radios + the "a place" address fields.
private struct WhereFields: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline("WHERE")
            ForEach(GigComposeLocationMode.allCases, id: \.self) { mode in
                RadioRow(
                    label: mode.label,
                    subcopy: mode.subcopy,
                    isSelected: viewModel.form.locationMode == mode,
                    identifier: "composeGig_location_\(mode.rawValue)"
                ) {
                    viewModel.selectLocationMode(mode)
                }
            }
            if viewModel.form.locationMode == .aPlace {
                FormFieldsBlock {
                    PantopusTextField(
                        "Street",
                        text: line1Binding,
                        placeholder: "123 Main St",
                        contentType: .streetAddressLine1,
                        identifier: "composeGig_place_line1"
                    )
                    PantopusTextField(
                        "City",
                        text: cityBinding,
                        contentType: .addressCity,
                        identifier: "composeGig_place_city"
                    )
                    HStack(alignment: .top, spacing: Spacing.s2) {
                        PantopusTextField(
                            "State",
                            text: stateBinding,
                            contentType: .addressState,
                            identifier: "composeGig_place_state"
                        )
                        PantopusTextField(
                            "ZIP",
                            text: zipBinding,
                            keyboardType: .numbersAndPunctuation,
                            contentType: .postalCode,
                            identifier: "composeGig_place_zip"
                        )
                    }
                }
            }
        }
    }

    private var line1Binding: Binding<String> {
        Binding(
            get: { viewModel.form.placeAddress.line1 },
            set: { viewModel.updatePlaceAddress(line1: $0) }
        )
    }

    private var cityBinding: Binding<String> {
        Binding(
            get: { viewModel.form.placeAddress.city },
            set: { viewModel.updatePlaceAddress(city: $0) }
        )
    }

    private var stateBinding: Binding<String> {
        Binding(
            get: { viewModel.form.placeAddress.state },
            set: { viewModel.updatePlaceAddress(state: $0) }
        )
    }

    private var zipBinding: Binding<String> {
        Binding(
            get: { viewModel.form.placeAddress.zip },
            set: { viewModel.updatePlaceAddress(zip: $0) }
        )
    }
}

private struct OneTimeDatePicker: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        FormFieldsBlock {
            DatePicker(
                "When",
                selection: dateBinding,
                in: Date().addingTimeInterval(60)...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .datePickerStyle(.compact)
            .tint(Theme.Color.primary600)
            .accessibilityIdentifier("composeGig_scheduledStart")
        }
    }

    private var dateBinding: Binding<Date> {
        Binding(
            get: {
                if let iso = viewModel.form.scheduledStartISO,
                   let date = ISO8601DateFormatter().date(from: iso) {
                    return date
                }
                // Default to "now + 1 hour" so the picker opens on a
                // plausible value but the form only counts as valid once
                // the user actually taps it (we only mirror the binding
                // setter, never the getter, into the form state).
                return Date().addingTimeInterval(3600)
            },
            set: { viewModel.setScheduledStart($0) }
        )
    }
}

// MARK: - A12.8 archetype module field groups

/// Renders the field group for the active archetype (care / logistics /
/// remote / event / items). Compact plain-field patterns per the design.
private struct ModuleGroupFields: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        // Container ids mirror Android's `gigCompose.module.<group>` tags.
        switch viewModel.activeModuleGroup {
        case .care:
            CareModuleFields(viewModel: viewModel)
                .accessibilityIdentifier("gigCompose.module.care")
        case .logistics:
            LogisticsModuleFields(viewModel: viewModel)
                .accessibilityIdentifier("gigCompose.module.logistics")
        case .remote:
            RemoteModuleFields(viewModel: viewModel)
                .accessibilityIdentifier("gigCompose.module.remote")
        case .event:
            EventModuleFields(viewModel: viewModel)
                .accessibilityIdentifier("gigCompose.module.event")
        case .delivery:
            DeliveryModuleFields(viewModel: viewModel)
                .accessibilityIdentifier("gigCompose.module.delivery")
        case .proService:
            ProServiceModuleFields(viewModel: viewModel)
                .accessibilityIdentifier("gigCompose.module.proService")
        case nil:
            EmptyView()
        }
    }
}

private struct CareModuleFields: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline("CARE DETAILS")
            ModuleChipsRow(
                title: "Care type",
                options: ["child", "pet", "elder", "other"],
                selected: viewModel.form.careDetails?.careType,
                identifierPrefix: "composeGig_care_type"
            ) { value in
                viewModel.updateForm { form in
                    var details = form.careDetails ?? GigCareDetails()
                    details.careType = value
                    form.careDetails = details
                }
            }
            ModuleStepperRow(
                title: "How many",
                value: viewModel.form.careDetails?.count ?? 1,
                range: 1...10,
                identifier: "gigCompose.module.care.count"
            ) { value in
                viewModel.updateForm { form in
                    var details = form.careDetails ?? GigCareDetails()
                    details.count = value
                    form.careDetails = details
                }
            }
            PantopusTextField(
                "Ages / details",
                text: moduleText(\.careDetails, get: { $0?.agesOrDetails }, set: { details, value in
                    details.agesOrDetails = value
                }),
                placeholder: "e.g. 2 kids, ages 4 and 7",
                identifier: "gigCompose.module.care.ages"
            )
            PantopusTextField(
                "Special needs (optional)",
                text: moduleText(\.careDetails, get: { $0?.specialNeeds }, set: { details, value in
                    details.specialNeeds = value
                }),
                identifier: "composeGig_care_specialNeeds"
            )
        }
    }

    private func moduleText(
        _ keyPath: KeyPath<GigComposeFormState, GigCareDetails?>,
        get: @escaping (GigCareDetails?) -> String?,
        set: @escaping (inout GigCareDetails, String) -> Void
    ) -> Binding<String> {
        Binding(
            get: { get(viewModel.form[keyPath: keyPath]) ?? "" },
            set: { newValue in
                viewModel.updateForm { form in
                    var details = form.careDetails ?? GigCareDetails()
                    set(&details, newValue)
                    form.careDetails = details
                }
            }
        )
    }
}

private struct LogisticsModuleFields: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline("LOGISTICS")
            ModuleStepperRow(
                title: "Helpers needed",
                value: viewModel.form.logisticsDetails?.workerCount ?? 1,
                range: 1...10,
                identifier: "gigCompose.module.logistics.workers"
            ) { value in
                update { $0.workerCount = value }
            }
            ModuleToggleRow(
                title: "Vehicle needed",
                isOn: viewModel.form.logisticsDetails?.vehicleNeeded ?? false,
                identifier: "gigCompose.module.logistics.vehicle"
            ) { value in
                update { $0.vehicleNeeded = value }
            }
            ModuleToggleRow(
                title: "Heavy lifting",
                isOn: viewModel.form.logisticsDetails?.heavyLifting ?? false,
                identifier: "gigCompose.module.logistics.heavy"
            ) { value in
                update { $0.heavyLifting = value }
            }
            ModuleChipsRow(
                title: "Stairs",
                options: ["none", "few_steps", "multiple_flights"],
                selected: viewModel.form.logisticsDetails?.stairsInfo,
                identifierPrefix: "composeGig_logistics_stairs"
            ) { value in
                update { $0.stairsInfo = value }
            }
            PantopusTextField(
                "Access instructions (optional)",
                text: Binding(
                    get: { viewModel.form.logisticsDetails?.accessInstructions ?? "" },
                    set: { newValue in update { $0.accessInstructions = newValue } }
                ),
                placeholder: "Gate code, parking, etc.",
                identifier: "composeGig_logistics_access"
            )
        }
    }

    private func update(_ mutate: (inout GigLogisticsDetails) -> Void) {
        viewModel.updateForm { form in
            var details = form.logisticsDetails ?? GigLogisticsDetails()
            mutate(&details)
            form.logisticsDetails = details
        }
    }
}

private struct RemoteModuleFields: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline("REMOTE TASK")
            ModuleChipsRow(
                title: "Deliverable",
                options: ["document", "design", "code", "video", "other"],
                selected: viewModel.form.remoteDetails?.deliverableType,
                identifierPrefix: "composeGig_remote_deliverable"
            ) { value in
                update { $0.deliverableType = value }
            }
            ModuleStepperRow(
                title: "Revisions",
                value: viewModel.form.remoteDetails?.revisionCount ?? 1,
                range: 1...10,
                identifier: "composeGig_remote_revisions"
            ) { value in
                update { $0.revisionCount = value }
            }
            ModuleToggleRow(
                title: "Kickoff call needed",
                isOn: viewModel.form.remoteDetails?.meetingRequired ?? false,
                identifier: "gigCompose.module.remote.meeting"
            ) { value in
                update { $0.meetingRequired = value }
            }
            PantopusTextField(
                "Timezone (optional)",
                text: Binding(
                    get: { viewModel.form.remoteDetails?.timezone ?? "" },
                    set: { newValue in update { $0.timezone = newValue } }
                ),
                placeholder: "e.g. PT",
                identifier: "composeGig_remote_timezone"
            )
        }
    }

    private func update(_ mutate: (inout GigRemoteDetails) -> Void) {
        viewModel.updateForm { form in
            var details = form.remoteDetails ?? GigRemoteDetails()
            mutate(&details)
            form.remoteDetails = details
        }
    }
}

private struct EventModuleFields: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline("EVENT SHIFT")
            ModuleChipsRow(
                title: "Event type",
                options: ["party", "wedding", "corporate", "community", "other"],
                selected: viewModel.form.eventDetails?.eventType,
                identifierPrefix: "composeGig_event_type"
            ) { value in
                update { $0.eventType = value }
            }
            ModuleChipsRow(
                title: "Role",
                options: ["setup", "serving", "bartending", "cleanup", "general"],
                selected: viewModel.form.eventDetails?.roleType,
                identifierPrefix: "composeGig_event_role"
            ) { value in
                update { $0.roleType = value }
            }
            PantopusTextField(
                "Guest count (optional)",
                text: Binding(
                    get: { viewModel.form.eventDetails?.guestCount.map(String.init) ?? "" },
                    set: { newValue in update { $0.guestCount = Int(newValue) } }
                ),
                keyboardType: .numberPad,
                identifier: "gigCompose.module.event.guests"
            )
            PantopusTextField(
                "Dress code (optional)",
                text: Binding(
                    get: { viewModel.form.eventDetails?.dressCode ?? "" },
                    set: { newValue in update { $0.dressCode = newValue } }
                ),
                identifier: "composeGig_event_dressCode"
            )
        }
    }

    private func update(_ mutate: (inout GigEventDetails) -> Void) {
        viewModel.updateForm { form in
            var details = form.eventDetails ?? GigEventDetails()
            mutate(&details)
            form.eventDetails = details
        }
    }
}

/// delivery_errand — pickup → drop-off route (flat `pickup_*` /
/// `dropoff_*` gig columns), the shopping list, and the proof-photo
/// toggle. Mirrors RN's `DeliveryModule.tsx`.
private struct DeliveryModuleFields: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline("DELIVERY DETAILS")
            PantopusTextField(
                "Pickup address",
                text: field(get: { $0?.pickupAddress }, set: { $0.pickupAddress = $1 }),
                placeholder: "Pickup address",
                identifier: "gigCompose.module.delivery.pickupAddress"
            )
            PantopusTextField(
                "Pickup notes (optional)",
                text: field(get: { $0?.pickupNotes }, set: { $0.pickupNotes = $1 }),
                placeholder: "e.g. Ask for John at the counter",
                identifier: "gigCompose.module.delivery.pickupNotes"
            )
            PantopusTextField(
                "Drop-off address",
                text: field(get: { $0?.dropoffAddress }, set: { $0.dropoffAddress = $1 }),
                placeholder: "Drop-off address (defaults to your home)",
                identifier: "gigCompose.module.delivery.dropoffAddress"
            )
            PantopusTextField(
                "Drop-off notes (optional)",
                text: field(get: { $0?.dropoffNotes }, set: { $0.dropoffNotes = $1 }),
                placeholder: "e.g. Leave on the front porch",
                identifier: "gigCompose.module.delivery.dropoffNotes"
            )
            ModuleToggleRow(
                title: "Require delivery proof photo",
                isOn: viewModel.form.deliveryDetails?.proofRequired ?? false,
                identifier: "gigCompose.module.delivery.proof"
            ) { value in
                update { $0.proofRequired = value }
            }
            ItemsModuleFields(viewModel: viewModel)
                .accessibilityIdentifier("gigCompose.module.items")
        }
    }

    private func field(
        get: @escaping (GigDeliveryDetails?) -> String?,
        set: @escaping (inout GigDeliveryDetails, String) -> Void
    ) -> Binding<String> {
        Binding(
            get: { get(viewModel.form.deliveryDetails) ?? "" },
            set: { newValue in update { set(&$0, newValue) } }
        )
    }

    private func update(_ mutate: (inout GigDeliveryDetails) -> Void) {
        viewModel.updateForm { form in
            var details = form.deliveryDetails ?? GigDeliveryDetails()
            mutate(&details)
            form.deliveryDetails = details
        }
    }
}

/// pro_service_quote — licence / insurance / scope / deposit. Mirrors
/// RN's `ProServicesModule.tsx`; the deposit amount is required once
/// the toggle is on (gate lives on `hasValidModules`).
private struct ProServiceModuleFields: View {
    @Bindable var viewModel: GigComposeViewModel

    private var details: GigProServiceDetails? {
        viewModel.form.proServiceDetails
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline("PROFESSIONAL REQUIREMENTS")
            ModuleToggleRow(
                title: "Requires license",
                isOn: details?.requiresLicense ?? false,
                identifier: "gigCompose.module.pro.license"
            ) { value in
                update { $0.requiresLicense = value }
            }
            if details?.requiresLicense == true {
                PantopusTextField(
                    "License type",
                    text: field(get: { $0?.licenseType }, set: { $0.licenseType = $1 }),
                    placeholder: "e.g. Licensed Plumber",
                    identifier: "gigCompose.module.pro.licenseType"
                )
            }
            ModuleToggleRow(
                title: "Requires insurance",
                isOn: details?.requiresInsurance ?? false,
                identifier: "gigCompose.module.pro.insurance"
            ) { value in
                update { $0.requiresInsurance = value }
            }
            ModuleMultilineField(
                label: "Scope of work",
                placeholder: "Describe the scope of work needed…",
                text: field(get: { $0?.scopeDescription }, set: { $0.scopeDescription = $1 }),
                identifier: "gigCompose.module.pro.scope"
            )
            ModuleToggleRow(
                title: "Require deposit",
                isOn: details?.depositRequired ?? false,
                identifier: "gigCompose.module.pro.deposit"
            ) { value in
                update { $0.depositRequired = value }
            }
            if details?.depositRequired == true {
                PantopusTextField(
                    "Deposit amount ($)",
                    text: field(get: { $0?.depositAmount }, set: { $0.depositAmount = $1 }),
                    placeholder: "0",
                    state: details?.isDepositAmountMissing == true
                        ? .error("Enter a deposit amount, or turn the deposit off.")
                        : .default,
                    keyboardType: .decimalPad,
                    identifier: "gigCompose.module.pro.depositAmount"
                )
            }
        }
    }

    private func field(
        get: @escaping (GigProServiceDetails?) -> String?,
        set: @escaping (inout GigProServiceDetails, String) -> Void
    ) -> Binding<String> {
        Binding(
            get: { get(viewModel.form.proServiceDetails) ?? "" },
            set: { newValue in update { set(&$0, newValue) } }
        )
    }

    private func update(_ mutate: (inout GigProServiceDetails) -> Void) {
        viewModel.updateForm { form in
            var details = form.proServiceDetails ?? GigProServiceDetails()
            mutate(&details)
            form.proServiceDetails = details
        }
    }
}

/// Multi-line module input — same chrome as `DescriptionField` but with
/// a caller-supplied label / placeholder / identifier.
private struct ModuleMultilineField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    let identifier: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text(placeholder)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, Spacing.s3)
                        .padding(.top, Spacing.s3)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $text)
                    .font(Theme.Font.body)
                    .foregroundStyle(Theme.Color.appText)
                    .frame(minHeight: 80)
                    .scrollContentBackground(.hidden)
                    .padding(Spacing.s2)
                    .accessibilityIdentifier(identifier)
                    .accessibilityLabel(label)
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
    }
}

/// Delivery/errand shopping items — name + notes per row, add/remove.
private struct ItemsModuleFields: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline("ITEMS")
            ForEach(Array(viewModel.form.items.enumerated()), id: \.offset) { index, _ in
                HStack(alignment: .top, spacing: Spacing.s2) {
                    VStack(spacing: Spacing.s2) {
                        PantopusTextField(
                            "Item \(index + 1)",
                            text: itemBinding(index, \.name),
                            placeholder: "e.g. 1 gal whole milk",
                            identifier: "composeGig_item_name_\(index)"
                        )
                        PantopusTextField(
                            "Notes (optional)",
                            text: itemBinding(index, \.notes),
                            identifier: "composeGig_item_notes_\(index)"
                        )
                    }
                    Button {
                        viewModel.updateForm { form in
                            guard form.items.indices.contains(index) else { return }
                            form.items.remove(at: index)
                        }
                    } label: {
                        Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                            .frame(width: 32, height: 32)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                                    .stroke(Theme.Color.appBorder, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .padding(.top, Spacing.s5)
                    .accessibilityLabel("Remove item \(index + 1)")
                }
            }
            if viewModel.form.items.count < 20 {
                Button {
                    viewModel.updateForm { $0.items.append(GigTaskItemDraft(name: "")) }
                } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.plus, size: 14, strokeWidth: 2.4, color: Theme.Color.primary600)
                        Text("Add item")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.primary600)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("gigCompose.module.itemAdd")
            }
        }
    }

    private func itemBinding(_ index: Int, _ keyPath: WritableKeyPath<GigTaskItemDraft, String?>) -> Binding<String> {
        Binding(
            get: {
                guard viewModel.form.items.indices.contains(index) else { return "" }
                return viewModel.form.items[index][keyPath: keyPath] ?? ""
            },
            set: { newValue in
                viewModel.updateForm { form in
                    guard form.items.indices.contains(index) else { return }
                    form.items[index][keyPath: keyPath] = newValue
                }
            }
        )
    }
}

/// Urgent module fields — shown whenever the boost flag is on.
private struct UrgentModuleFields: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionOverline("URGENT")
            ModuleStepperRow(
                title: "Response window (min)",
                value: viewModel.form.urgentDetails?.responseWindowMinutes ?? 30,
                range: 5...120,
                step: 5,
                identifier: "composeGig_urgent_responseWindow"
            ) { value in
                update { $0.responseWindowMinutes = value }
            }
            ModuleToggleRow(
                title: "Share live location during task",
                isOn: viewModel.form.urgentDetails?.shareLocationDuringTask ?? false,
                identifier: "composeGig_urgent_shareLocation"
            ) { value in
                update { $0.shareLocationDuringTask = value }
            }
        }
    }

    private func update(_ mutate: (inout GigUrgentDetails) -> Void) {
        viewModel.updateForm { form in
            var details = form.urgentDetails ?? GigUrgentDetails()
            mutate(&details)
            form.urgentDetails = details
        }
    }
}

// MARK: - Module field building blocks

private struct SectionOverline: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .tracking(0.6)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.top, Spacing.s2)
    }
}

private struct ModuleChipsRow: View {
    let title: String
    let options: [String]
    let selected: String?
    let identifierPrefix: String
    let onSelect: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(title)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(options, id: \.self) { option in
                        let active = selected == option
                        Button { onSelect(option) } label: {
                            Text(humanized(option))
                                .font(.system(size: 12.5, weight: .semibold))
                                .foregroundStyle(active ? Theme.Color.appTextInverse : Theme.Color.appText)
                                .padding(.horizontal, Spacing.s3)
                                .padding(.vertical, Spacing.s1 + 3)
                                .background(active ? Theme.Color.primary600 : Theme.Color.appSurface)
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule().stroke(
                                        active ? Color.clear : Theme.Color.appBorder,
                                        lineWidth: 1
                                    )
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("\(identifierPrefix)_\(option)")
                        .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
                    }
                }
            }
        }
    }

    private func humanized(_ raw: String) -> String {
        let spaced = raw.replacingOccurrences(of: "_", with: " ")
        return spaced.prefix(1).uppercased() + spaced.dropFirst()
    }
}

private struct ModuleToggleRow: View {
    let title: String
    let isOn: Bool
    let identifier: String
    let onChange: (Bool) -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Text(title)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: Spacing.s0)
            Toggle("", isOn: Binding(get: { isOn }, set: onChange))
                .labelsHidden()
                .tint(Theme.Color.primary600)
                .accessibilityIdentifier(identifier)
                .accessibilityLabel(title)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

private struct ModuleStepperRow: View {
    let title: String
    let value: Int
    let range: ClosedRange<Int>
    var step: Int = 1
    let identifier: String
    let onChange: (Int) -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Text(title)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: Spacing.s0)
            Text("\(value)")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Stepper(
                "",
                value: Binding(get: { value }, set: onChange),
                in: range,
                step: step
            )
            .labelsHidden()
            .accessibilityIdentifier(identifier)
            .accessibilityLabel("\(title): \(value)")
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

private struct DescriptionField: View {
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Description")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            TextEditor(text: $text)
                .font(Theme.Font.body)
                .foregroundStyle(Theme.Color.appText)
                .frame(minHeight: 120)
                .scrollContentBackground(.hidden)
                .padding(Spacing.s2)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .accessibilityIdentifier("composeGig_description")
        }
    }
}

private struct CharacterCounter: View {
    let current: Int
    let min: Int
    let max: Int

    var body: some View {
        let needsMore = current < min
        Text(needsMore ? "\(min - current) more characters" : "\(current) / \(max)")
            .pantopusTextStyle(.caption)
            .foregroundStyle(needsMore ? Theme.Color.warning : Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .accessibilityIdentifier("composeGig_descriptionCounter")
    }
}

private struct PhotoSlotsRow: View {
    let attachments: [GigComposeAttachment]
    let max: Int
    let onAdd: () -> Void
    let onRetry: (String) -> Void
    let onRemove: (String) -> Void

    private var hasUploading: Bool {
        attachments.contains { $0.status == .uploading }
    }

    private var hasFailed: Bool {
        attachments.contains { $0.status == .failed }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Photos (optional, up to \(max))")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                ForEach(Array(attachments.enumerated()), id: \.element.id) { index, attachment in
                    GigPhotoTile(
                        attachment: attachment,
                        isCover: index == 0,
                        index: index,
                        onRetry: { onRetry(attachment.id) },
                        onRemove: { onRemove(attachment.id) }
                    )
                }
                if attachments.count < max {
                    Button(action: onAdd) {
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, style: StrokeStyle(lineWidth: 1, dash: [4]))
                            .frame(width: 64, height: 64)
                            .overlay(Icon(.plus, size: 22, color: Theme.Color.appTextSecondary))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("composeGig_addPhoto")
                    .accessibilityLabel("Add photo")
                }
                Spacer(minLength: Spacing.s0)
            }
            if hasUploading {
                Text("Uploading photos… you can continue once they finish.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.warning)
                    .accessibilityIdentifier("composeGig_uploadingHint")
            } else if hasFailed {
                Text("A photo failed to upload — tap it to retry, or remove it.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityIdentifier("composeGig_uploadFailedHint")
            }
        }
    }
}

/// One 64×64 photo tile — uploading spinner / failed tap-to-retry /
/// uploaded thumbnail (first tile carries the "Cover" badge).
private struct GigPhotoTile: View {
    let attachment: GigComposeAttachment
    let isCover: Bool
    let index: Int
    let onRetry: () -> Void
    let onRemove: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            tileBody
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            Button(action: onRemove) {
                Icon(.x, size: 12, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
                    .frame(width: 18, height: 18)
                    .background(Circle().fill(Color.black.opacity(0.55)))
            }
            .buttonStyle(.plain)
            .padding(2)
            .accessibilityLabel("Remove photo \(index + 1)")
        }
        .overlay(alignment: .bottomLeading) {
            if isCover, attachment.uploadedURL != nil {
                Text("Cover")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s1)
                    .padding(.vertical, 1)
                    .background(Color.black.opacity(0.55))
                    .clipShape(Capsule())
                    .padding(3)
            }
        }
        .accessibilityIdentifier("composeGig_photo_\(index)")
        .accessibilityLabel(accessibilityText)
    }

    @ViewBuilder private var tileBody: some View {
        switch attachment.status {
        case .uploading:
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
                .overlay(ProgressView().tint(Theme.Color.primary600))
        case .failed:
            Button(action: onRetry) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.errorBg)
                    .overlay(
                        VStack(spacing: 2) {
                            Icon(.alertCircle, size: 16, strokeWidth: 2.4, color: Theme.Color.error)
                            Text("Retry")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(Theme.Color.error)
                        }
                    )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("composeGig_retryPhoto_\(index)")
        case .uploaded:
            if let uiImage = UIImage(data: attachment.imageData) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 64, height: 64)
            } else {
                // Restored-from-SceneStorage attachments carry no bytes —
                // render the generic photo glyph over the primary tint.
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.primary50)
                    .overlay(Icon(.image, size: 22, color: Theme.Color.primary600))
            }
        }
    }

    private var accessibilityText: String {
        switch attachment.status {
        case .uploading: "Photo \(index + 1), uploading"
        case .failed: "Photo \(index + 1), upload failed, tap to retry"
        case .uploaded: "Photo \(index + 1)\(isCover ? ", cover" : ""), uploaded"
        }
    }
}

// MARK: - Step 3: Budget & mode

private struct BudgetStep: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        HeadlineBlock("Budget & mode")
        SubcopyBlock("Pick a price model and how helpers engage. Helpers see this on the gig card.")
        VStack(spacing: Spacing.s2) {
            ForEach(GigComposeBudgetType.allCases, id: \.self) { type in
                RadioRow(
                    label: type.label,
                    subcopy: subcopy(for: type),
                    isSelected: viewModel.form.budgetType == type,
                    identifier: "composeGig_budget_\(type.rawValue)"
                ) {
                    viewModel.selectBudgetType(type)
                }
            }
        }
        // G — entering the budget step fetches the nearby price
        // benchmark for the chosen category (silent on failure).
        .task { await viewModel.loadPriceBenchmark() }
        if let selected = viewModel.form.budgetType, selected != .offers {
            BudgetRangeFields(viewModel: viewModel, type: selected)
            if selected == .hourly {
                PantopusTextField(
                    "Estimated hours",
                    text: estimatedHoursBinding,
                    placeholder: "2",
                    keyboardType: .decimalPad,
                    identifier: "composeGig_estimatedHours"
                )
            }
        }
        if let benchmark = viewModel.priceBenchmark {
            PriceBenchmarkHint(
                benchmark: benchmark,
                categoryLabel: viewModel.form.category?.label.lowercased() ?? "similar"
            )
        }
        EngagementOverrideControl(
            selected: viewModel.effectiveEngagementMode
        ) { mode in
            viewModel.selectEngagementOverride(mode)
        }
    }

    private var estimatedHoursBinding: Binding<String> {
        Binding(
            get: { viewModel.form.estimatedHours },
            set: { viewModel.setEstimatedHours($0) }
        )
    }

    private func subcopy(for type: GigComposeBudgetType) -> String {
        switch type {
        case .fixed: "One total price for the whole job."
        case .hourly: "Pay by the hour worked."
        case .offers: "Helpers send their own price and you pick."
        }
    }
}

/// A12.8 — backend engagement-mode selector (instant accept / curated
/// offers / quotes). Pre-selected from the archetype + schedule
/// inference; tapping stores an explicit override.
private struct EngagementOverrideControl: View {
    let selected: GigEngagementMode
    let onSelect: (GigEngagementMode) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("HOW HELPERS ENGAGE")
                .font(.system(size: 10.5, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                ForEach(GigEngagementMode.allCases, id: \.self) { option in
                    let active = option == selected
                    Button { onSelect(option) } label: {
                        VStack(spacing: 2) {
                            Text(option.label)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(active ? Theme.Color.primary700 : Theme.Color.appText)
                                .multilineTextAlignment(.center)
                            Text(option.subcopy)
                                .font(.system(size: 9.5))
                                .foregroundStyle(active ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.s2)
                        .background(active ? Theme.Color.primary50 : Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .stroke(
                                    active ? Theme.Color.primary600 : Theme.Color.appBorder,
                                    lineWidth: active ? 1.5 : 1
                                )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("gigCompose.engagementMode_\(option.rawValue)")
                    .accessibilityLabel("\(option.label), \(option.subcopy)")
                    .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
                }
            }
        }
    }
}

/// Work item G — "Similar handyman tasks nearby: $40–$120 · median $60"
/// hint under the budget fields, with the benchmark's basis line as a
/// sub-caption. Renders only when a benchmark with comparables landed.
private struct PriceBenchmarkHint: View {
    let benchmark: GigPriceBenchmarkDTO
    let categoryLabel: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(
                "Similar \(categoryLabel) tasks nearby: "
                    + "\(money(benchmark.low))–\(money(benchmark.high))"
                    + " · median \(money(benchmark.median))"
            )
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(Theme.Color.appTextSecondary)
            if let basis = benchmark.basis, !basis.isEmpty {
                Text(basis)
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("gigCompose.priceBenchmark")
    }

    private func money(_ value: Double) -> String {
        value.truncatingRemainder(dividingBy: 1) == 0
            ? "$\(Int(value))"
            : String(format: "$%.2f", value)
    }
}

private struct BudgetRangeFields: View {
    @Bindable var viewModel: GigComposeViewModel
    let type: GigComposeBudgetType

    var body: some View {
        let suffix = type == .hourly ? "/ hr" : "total"
        FormFieldsBlock {
            HStack(alignment: .top, spacing: Spacing.s2) {
                PantopusTextField(
                    "Min \(suffix)",
                    text: minBinding,
                    placeholder: "20",
                    keyboardType: .decimalPad,
                    identifier: "composeGig_budgetMin"
                )
                PantopusTextField(
                    "Max \(suffix)",
                    text: maxBinding,
                    placeholder: "Optional",
                    keyboardType: .decimalPad,
                    identifier: "composeGig_budgetMax"
                )
            }
        }
    }

    private var minBinding: Binding<String> {
        Binding(
            get: { viewModel.form.budgetMin },
            set: { viewModel.setBudgetMin($0) }
        )
    }

    private var maxBinding: Binding<String> {
        Binding(
            get: { viewModel.form.budgetMax },
            set: { viewModel.setBudgetMax($0) }
        )
    }
}

// MARK: - Step 4: Review

private struct ReviewStep: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        HeadlineBlock("Review and post")
        SubcopyBlock("Check the details. Helpers see what's below as your gig card.")
        ReviewSummaryBlock([
            ReviewSummaryRow(label: "Category", value: viewModel.form.category?.label ?? "—"),
            ReviewSummaryRow(label: "Title", value: viewModel.form.title.isEmpty ? "—" : viewModel.form.title),
            ReviewSummaryRow(label: "Description", value: condensedDescription),
            ReviewSummaryRow(label: "Photos", value: photosSummary),
            ReviewSummaryRow(label: "Budget", value: budgetSummary),
            ReviewSummaryRow(label: "Effort", value: viewModel.effortSummary ?? "—"),
            ReviewSummaryRow(label: "Schedule", value: scheduleSummary),
            ReviewSummaryRow(label: "Location", value: locationSummary),
            ReviewSummaryRow(label: "Engagement", value: viewModel.effectiveEngagementMode.label)
        ])
        // E.1 — optional composer fields backed by the picker sheets.
        GigComposeOptionsBlock(viewModel: viewModel)
    }

    private var condensedDescription: String {
        let trimmed = viewModel.form.description.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "—" }
        if trimmed.count > 140 { return String(trimmed.prefix(140)) + "…" }
        return trimmed
    }

    private var photosSummary: String {
        let count = viewModel.form.photoIds.count
        if count == 0 { return "None" }
        return count == 1 ? "1 photo" : "\(count) photos"
    }

    private var budgetSummary: String {
        guard let type = viewModel.form.budgetType else { return "—" }
        switch type {
        case .offers: return "Open to offers"
        case .fixed, .hourly:
            let suffix = type == .hourly ? "/hr" : ""
            let min = viewModel.form.budgetMin
            let max = viewModel.form.budgetMax
            if !max.isEmpty {
                return "$\(min)–$\(max)\(suffix)"
            }
            return "$\(min)\(suffix)"
        }
    }

    private var scheduleSummary: String {
        guard let type = viewModel.form.scheduleType else { return "Flexible" }
        if type == .oneTime, let iso = viewModel.form.scheduledStartISO,
           let date = ISO8601DateFormatter().date(from: iso) {
            let fmt = DateFormatter()
            fmt.dateStyle = .medium
            fmt.timeStyle = .short
            return fmt.string(from: date)
        }
        return type.label
    }

    private var locationSummary: String {
        guard let mode = viewModel.form.locationMode else { return "—" }
        switch mode {
        case .yourAddress: return "Your saved address"
        case .virtual: return "Virtual"
        case .aPlace:
            let addr = viewModel.form.placeAddress
            if addr.isComplete {
                return "\(addr.line1), \(addr.city), \(addr.state) \(addr.zip)"
            }
            return "A place"
        }
    }
}

// MARK: - E.1 Optional details (picker-sheet fields)

/// Tappable field rows on the Review step that open the composer picker
/// sheets and reflect their bound values. Mirrors the design's composer
/// field list (Category · Deadline · Cancellation policy · Urgency · Tags).
private struct GigComposeOptionsBlock: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("ADD DETAILS (OPTIONAL)")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            OptionFieldRow(
                label: "Category",
                value: viewModel.form.category?.label,
                placeholder: "Tap to choose",
                identifier: "gigPicker.row.category"
            ) { viewModel.presentPicker(.category) }
            OptionFieldRow(
                label: "Deadline",
                value: deadlineText,
                placeholder: "Flexible",
                identifier: "gigPicker.row.deadline"
            ) { viewModel.presentPicker(.deadline) }
            OptionFieldRow(
                label: "Cancellation policy",
                value: viewModel.form.cancellationPolicy?.label,
                placeholder: "Standard",
                identifier: "gigPicker.row.policy"
            ) { viewModel.presentPicker(.policy) }
            OptionFieldRow(
                label: "Urgency",
                value: viewModel.form.isUrgent ? "Urgent" : nil,
                placeholder: "Not urgent",
                identifier: "gigPicker.row.urgency"
            ) { viewModel.presentPicker(.urgency) }
            OptionFieldRow(
                label: "Tags",
                value: tagsText,
                placeholder: "Add tags",
                identifier: "gigPicker.row.tags"
            ) { viewModel.presentPicker(.tags) }
        }
    }

    private var deadlineText: String? {
        guard let iso = viewModel.form.deadlineISO,
              let date = ISO8601DateFormatter().date(from: iso)
        else { return nil }
        let fmt = DateFormatter()
        fmt.dateFormat = "EEE, MMM d"
        return fmt.string(from: date)
    }

    private var tagsText: String? {
        let tags = viewModel.form.tags
        guard !tags.isEmpty else { return nil }
        return tags.map { "#\($0)" }.joined(separator: " · ")
    }
}

private struct OptionFieldRow: View {
    let label: String
    let value: String?
    let placeholder: String
    let identifier: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: Spacing.s1 + 1) {
                Text(label)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                HStack(spacing: Spacing.s2) {
                    Text(value ?? placeholder)
                        .font(.system(size: 13.5))
                        .foregroundStyle(value == nil ? Theme.Color.appTextMuted : Theme.Color.appText)
                        .lineLimit(1)
                    Spacer(minLength: Spacing.s0)
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(.horizontal, Spacing.s3)
                .frame(height: 44)
                .frame(maxWidth: .infinity)
                .background(value == nil ? Theme.Color.appSurface : Theme.Color.primary50)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(value == nil ? Theme.Color.appBorder : Theme.Color.primary600, lineWidth: 1)
                )
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel("\(label): \(value ?? placeholder)")
    }
}

// MARK: - Success

private struct SuccessStep: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        SuccessHeroBlock(
            headline: "Task posted",
            subcopy: "Helpers can now see it on the Gigs feed. We'll notify you when bids come in."
        )
        if viewModel.notifiedCount > 0 || viewModel.nearbyHelpers > 0 {
            HStack(spacing: Spacing.s2) {
                Icon(.bell, size: 15, strokeWidth: 2.2, color: Theme.Color.success)
                Text("Notified \(viewModel.notifiedCount) nearby helper\(viewModel.notifiedCount == 1 ? "" : "s")")
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
            }
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("gigCompose.success.notified")
        }
        if viewModel.undoSecondsRemaining > 0 {
            Button {
                Task { await viewModel.undoPost() }
            } label: {
                HStack(spacing: Spacing.s1 + 2) {
                    Icon(.undo2, size: 14, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                    Text("Undo · \(viewModel.undoSecondsRemaining)s")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("gigCompose.success.undo")
            .accessibilityLabel("Undo posting, \(viewModel.undoSecondsRemaining) seconds left")
        }
    }
}

// MARK: - Helpers

private struct RadioRow: View {
    let label: String
    let subcopy: String
    let isSelected: Bool
    let identifier: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                ZStack {
                    Circle()
                        .stroke(
                            isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                            lineWidth: 2
                        )
                        .frame(width: 22, height: 22)
                    if isSelected {
                        Circle().fill(Theme.Color.primary600).frame(width: 12, height: 12)
                    }
                }
                .padding(.top, 2)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    Text(subcopy)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel("\(label). \(subcopy)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

private struct GigComposeErrorBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 18, color: Theme.Color.error)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.error)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("composeGigErrorBanner")
    }
}

/// Transient info toast — e.g. "Task undone" after an in-window undo.
private struct GigComposeInfoBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.checkCircle, size: 18, color: Theme.Color.success)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.success)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("gigCompose.undoneToast")
    }
}

#Preview {
    GigComposeWizardView(preselectedCategoryKey: "handyman") { _ in }
}

// swiftlint:enable file_length
