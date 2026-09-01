//
//  GigComposeViewModel.swift
//  Pantopus
//
//  Drives the A12.8 describe-first Post-a-Task wizard (Describe → Fill
//  gaps → Budget & mode → Review → Success). State machine + chrome
//  derivation mirror `AddHomeWizardViewModel`; submission posts to
//  `POST /api/gigs/magic-post` via `GigsEndpoints.magicPost(...)` with
//  a 10-second undo window.
//

import Foundation
import Observation

// swiftlint:disable cyclomatic_complexity

// swiftlint:disable file_length

/// One-shot navigation events the host view consumes.
public enum GigComposeOutboundEvent: Sendable, Equatable {
    /// Pop the wizard with no further navigation.
    case dismiss
    /// Pop the wizard and navigate to the newly-created gig's detail.
    case openGigDetail(gigId: String)
}

/// One Fill-gaps-step photo riding the real upload pipeline
/// (`POST /api/files/upload`). The raw bytes back the grid thumbnail;
/// `status` drives the per-tile spinner / retry / uploaded chrome.
struct GigComposeAttachment: Identifiable, Equatable {
    enum Status: Equatable {
        case uploading
        case failed
        case uploaded(url: String)
    }

    let id: String
    let imageData: Data
    var status: Status

    var uploadedURL: String? {
        if case let .uploaded(url) = status { return url }
        return nil
    }
}

/// One live row of the step-1 "Task details" module-prompts card. Values
/// derive from form state; tapping jumps to the matching editor.
struct GigModulePrompt: Identifiable, Hashable {
    enum Key: String {
        case when
        case location = "where"
        case effort
        case photos
        case budget
    }

    let key: Key
    let icon: PantopusIcon
    let label: String
    let value: String
    let isFilled: Bool

    var id: String {
        key.rawValue
    }
}

/// Which archetype module field group the Fill-gaps step renders.
enum GigModuleGroup: Equatable {
    case care
    case logistics
    case remote
    case event
    /// delivery_errand — pickup / drop-off route + the shopping list.
    case delivery
    /// pro_service_quote — licence / insurance / scope / deposit.
    case proService
}

@Observable
@MainActor
final class GigComposeViewModel: WizardModel, WizardDraftSaving {
    // MARK: - Public state

    /// Live form snapshot — mirrored into `@SceneStorage` so the wizard
    /// can be restored after process death.
    private(set) var form: GigComposeFormState

    /// True while the final `POST /api/gigs/magic-post` is in flight.
    private(set) var isSubmitting: Bool = false

    /// User-facing error message attached to the active step. Cleared on
    /// any successful step transition.
    private(set) var errorMessage: String?

    /// Transient info toast (e.g. "Task undone"). Cleared on the next
    /// step transition.
    private(set) var infoMessage: String?

    /// Holds the new gig's id once `submit()` succeeds so the success
    /// step's primary CTA can route to the detail.
    private(set) var createdGigId: String?

    /// Success-step "Notified M nearby helpers" counts from the
    /// magic-post response.
    private(set) var notifiedCount: Int = 0
    private(set) var nearbyHelpers: Int = 0

    /// Success-step undo countdown ("Undo · Ns"). 0 hides the pill.
    private(set) var undoSecondsRemaining: Int = 0

    /// One-shot navigation events the host view consumes.
    var pendingEvent: GigComposeOutboundEvent?

    /// E.1 — the composer picker sheet currently presented over the wizard,
    /// or nil. Transient UI state — deliberately not mirrored into
    /// `@SceneStorage` (a half-open sheet shouldn't survive process death).
    var activePickerSheet: GigPickerSheet?

    /// B.3 — true while the `POST /api/gigs/magic-draft` parse is in
    /// flight; the describe card shows a subtle "Parsing" indicator.
    private(set) var isParsingDraft = false

    /// True while a recorded voice note is being transcribed.
    private(set) var isTranscribing = false

    /// B.3 — clarifying question returned by the parser, surfaced as a
    /// hint under the describe card. Cleared on fallback / failure.
    private(set) var clarifyingQuestion: String?

    /// B.3 — the latest backend draft for the current describe text.
    /// Committed into the form (empty fields only) when the user
    /// advances past the describe step.
    private(set) var magicDraft: MagicDraftDTO?

    /// Top-level confidence of the latest draft — echoed back as
    /// `ai_confidence` on magic-post.
    private(set) var draftConfidence: Double?

    /// Inspiration-template chips (`GET /api/gigs/templates/library`),
    /// cached per session. Empty on fetch failure (silent).
    private(set) var templates: [GigTaskTemplateDTO] = []

    /// P15.5 — Fill-gaps-step photos with their per-tile upload state.
    /// Transient (raw bytes can't ride `@SceneStorage`); uploaded URLs
    /// are mirrored into `form.photoIds` so they survive restore.
    private(set) var attachments: [GigComposeAttachment] = []

    /// Work item G — nearby price benchmark for the budget step
    /// ("Similar handyman tasks nearby: $40–$120 · median $60"). Fetched
    /// on entering the budget step with a category set; nil hides the
    /// hint (no category, fetch failed, or `comparable_count == 0`).
    private(set) var priceBenchmark: GigPriceBenchmarkDTO?

    /// P6c — identity-picker rows: Personal plus one row per business
    /// seat from `GET /api/businesses/my-businesses`. Stays `[.personal]`
    /// until the fetch lands (or forever, on failure / no businesses).
    private(set) var identityOptions: [GigComposeIdentityOption] = [.personal]

    // MARK: - Private dependencies

    private let api: APIClient
    private let uploader: MultipartUploader
    private let location: any LocationProviding
    private let draftQueue: any GigDraftQueueing
    private let isOnlineProvider: @MainActor () -> Bool

    /// B.3 — in-flight debounce for the Magic Task archetype parse.
    private var detectionTask: Task<Void, Never>?

    /// Success-step undo countdown ticker.
    private var undoCountdownTask: Task<Void, Never>?

    /// One-shot guard around the templates fetch.
    private var templatesLoaded = false

    /// P15.5 — in-flight photo uploads keyed by attachment id.
    private var uploadTasks: [String: Task<Void, Never>] = [:]

    /// G — the category the current `priceBenchmark` was fetched for, so
    /// re-entering the budget step doesn't refetch the same category.
    private var benchmarkCategory: GigComposeCategory?

    /// P6c — id of the draft this wizard already stashed in the queue,
    /// so repeated offline submits replace rather than duplicate, and a
    /// later successful post removes it.
    private var queuedDraftId: String?

    /// One-shot guard around the my-businesses identity fetch.
    private var identitiesLoaded = false

    // MARK: - Init

    init(
        api: APIClient = .shared,
        uploader: MultipartUploader = .shared,
        location: any LocationProviding = DeviceLocationProvider.shared,
        initialState: GigComposeFormState = .empty,
        // P6c — offline draft queue. Tests inject one over an ephemeral
        // UserDefaults suite.
        draftQueue: any GigDraftQueueing = GigDraftQueue.shared,
        // Defaults to the live NetworkMonitor in production. Tests inject
        // a closure returning a fixed value so the simulator's
        // NWPathMonitor doesn't gate `submit()` on CI runners.
        isOnlineProvider: @escaping @MainActor () -> Bool = { NetworkMonitor.shared.isOnline }
    ) {
        self.api = api
        self.uploader = uploader
        self.location = location
        self.draftQueue = draftQueue
        self.isOnlineProvider = isOnlineProvider
        form = initialState
        seedAttachmentsFromPhotoIds()
    }

    /// Replace the in-memory form state from scene storage on first
    /// appear. No-op once the wizard has progressed past the restore.
    func restore(from snapshot: GigComposeFormState) {
        guard form == .empty else { return }
        form = snapshot
        seedAttachmentsFromPhotoIds()
    }

    /// Rehydrate the attachment grid from restored `photoIds`. Only real
    /// uploaded URLs survive; legacy placeholder ids are dropped so they
    /// can't leak into the create body.
    private func seedAttachmentsFromPhotoIds() {
        form.photoIds = form.photoIds.filter { $0.hasPrefix("http") }
        attachments = form.photoIds.map {
            GigComposeAttachment(id: UUID().uuidString, imageData: Data(), status: .uploaded(url: $0))
        }
    }
}

extension GigComposeViewModel {
    // MARK: - WizardModel

    var chrome: WizardChrome {
        let step = currentStep
        return WizardChrome(
            title: "Post a task",
            progressLabel: progressLabel(for: step),
            progressFraction: progressFraction(for: step),
            leading: leadingControl(for: step),
            primaryCTALabel: primaryCTALabel(for: step),
            primaryCTAEnabled: primaryEnabled(for: step) && !isSubmitting,
            primaryCTAIdentifier: step == .describe ? "gigCompose.cta.reviewPost" : "wizardPrimaryCTA",
            secondaryCTA: secondaryCTA(for: step),
            isSubmitting: isSubmitting,
            dirty: dirtyForCloseConfirm,
            showsProgressBar: step != .success
        )
    }

    func leadingTapped() {
        switch leadingControl(for: currentStep) {
        case .back: goBack()
        case .close: pendingEvent = .dismiss
        }
    }

    func discardConfirmed() {
        pendingEvent = .dismiss
    }

    func primaryTapped() {
        Task { await advance() }
    }

    #if DEBUG
    func advanceForTesting() async {
        await advance()
    }
    #endif

    func secondaryTapped() {
        switch currentStep {
        case .success:
            // Success step's "Done" — return to the feed.
            pendingEvent = .dismiss
        case .describe where form.composeMode == .magic:
            // "Pick category" ghost — drop into the manual archetype picker.
            setComposeMode(.manual)
        default:
            break
        }
    }

    // MARK: - B.3 Magic Task

    /// Switch the step-1 entry mode (Magic describe ⇄ manual picker).
    func setComposeMode(_ mode: ComposeMode) {
        form.composeMode = mode
    }

    /// Debounce before the describe text is parsed (real NLP roundtrip,
    /// so longer than a local keyword match would need).
    static let describeDebounceNanos: UInt64 = 700_000_000

    /// Minimum word count before the backend parser is worth a roundtrip.
    static let magicDraftMinWords = 3

    /// Update the plain-English describe text and (re)schedule a debounced
    /// parse. Cancelling the previous task also cancels any in-flight
    /// magic-draft request (URLSession honours task cancellation).
    func setDescribeText(_ text: String) {
        form.describeText = String(text.prefix(GigComposeLimits.describeMax))
        detectionTask?.cancel()
        let snapshot = form.describeText
        detectionTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: Self.describeDebounceNanos)
            guard let self, !Task.isCancelled else { return }
            await parseDescribe(snapshot)
        }
    }

    /// Debounced describe-text parse. ≥ `magicDraftMinWords` words →
    /// `POST /api/gigs/magic-draft`; shorter input — or a failed /
    /// errored request — falls back to the deterministic keyword
    /// matcher so detection always works offline.
    func parseDescribe(_ snapshot: String) async {
        guard form.describeText == snapshot else { return }
        let words = snapshot.split(whereSeparator: \.isWhitespace)
        guard words.count >= Self.magicDraftMinWords else {
            magicDraft = nil
            draftConfidence = nil
            clarifyingQuestion = nil
            applyDetection(for: snapshot)
            return
        }
        isParsingDraft = true
        defer { isParsingDraft = false }
        do {
            let coordinate = location.cachedCoordinate()
            let body = MagicDraftRequestBody(
                text: snapshot,
                context: coordinate.map {
                    MagicDraftContext(latitude: $0.latitude, longitude: $0.longitude)
                },
                // Uploaded photo/attachment URLs ride along so the
                // parser can fold them into the draft.
                attachmentUrls: form.photoIds.isEmpty ? nil : form.photoIds
            )
            let response: MagicDraftResponse = try await api.request(GigsEndpoints.magicDraft(body: body))
            // The text may have changed while the request was in flight —
            // a newer debounce owns the field now.
            guard form.describeText == snapshot else { return }
            apply(draft: response, for: snapshot)
        } catch {
            guard form.describeText == snapshot, !Task.isCancelled else { return }
            magicDraft = nil
            draftConfidence = nil
            clarifyingQuestion = nil
            applyDetection(for: snapshot)
        }
    }

    /// Commit a magic-draft response: stash the draft for the
    /// advance-time prefill, surface the clarifying question, and mirror
    /// the parsed category into the detected-category row. Falls back
    /// to the keyword matcher when the backend returned no category.
    func apply(draft response: MagicDraftResponse, for text: String) {
        magicDraft = response.draft
        draftConfidence = response.confidence
        clarifyingQuestion = (response.clarifyingQuestion?.isEmpty == false)
            ? response.clarifyingQuestion
            : nil
        let detected = GigComposeCategory.from(backendCategory: response.draft.category)
            ?? Self.detectArchetype(from: text)
        form.detectedArchetype = detected
        if let detected { form.category = detected }
        if let archetype = response.draft.taskArchetype, !archetype.isEmpty {
            form.taskArchetype = archetype
        }
    }

    /// Apply the keyword-matched archetype if the text hasn't changed
    /// since the debounce fired. Mirrors the detected category into
    /// `form.category` so the rest of the wizard + submission consume it.
    func applyDetection(for text: String) {
        guard form.describeText == text else { return }
        let detected = Self.detectArchetype(from: text)
        form.detectedArchetype = detected
        if let detected { form.category = detected }
    }

    /// Keyword → archetype map shared by the deterministic detector and
    /// the describe-card entity highlighter. Order matters — first hit
    /// wins.
    static let archetypeKeywords: [(category: GigComposeCategory, keywords: [String])] = [
        (.moving, ["move", "moving", "haul", "u-haul", "load boxes"]),
        (.cleaning, ["clean", "tidy", "scrub", "vacuum", "mop"]),
        (
            .handyman,
            [
                "assemble", "ikea", "furniture", "shelf", "shelves", "mount", "drill",
                "fix", "repair", "install", "handy", "patch", "drywall"
            ]
        ),
        (.petcare, ["dog", "cat", " pet", "puppy", "litter", "groom", "walk"]),
        (.childcare, ["babysit", "nanny", "kids", "child", "daycare"]),
        (.tutoring, ["tutor", "lesson", "math", "homework", "test prep", "teach"]),
        (.delivery, ["deliver", "pickup", "pick up", "drop off", "errand", "courier"]),
        (.tech, ["wifi", "wi-fi", "computer", "laptop", "printer", "router", "troubleshoot", "setup"])
    ]

    /// Deterministic keyword → archetype map. Synchronous fallback for
    /// short input and for magic-draft request failures.
    static func detectArchetype(from text: String) -> GigComposeCategory? {
        let lower = text.lowercased()
        guard lower.count >= 3 else { return nil }
        for entry in archetypeKeywords where entry.keywords.contains(where: { lower.contains($0) }) {
            return entry.category
        }
        return nil
    }

    // MARK: - Templates library

    /// Fetch the inspiration-template chips once per session
    /// (`GET /api/gigs/templates/library`). Failure is silent — the row
    /// simply doesn't render.
    func loadTemplatesIfNeeded() async {
        guard !templatesLoaded else { return }
        templatesLoaded = true
        do {
            let response: GigTemplateLibraryResponse = try await api.request(GigsEndpoints.templatesLibrary())
            templates = response.templates
        } catch {
            templates = []
        }
    }

    /// Seed the describe field from a tapped template chip and kick the
    /// debounced parse.
    func applyTemplate(_ template: GigTaskTemplateDTO) {
        guard let title = template.template?.title, !title.isEmpty else { return }
        setDescribeText(title)
    }

    // MARK: - P6c Identity (persona switching)

    /// Fetch the user's business seats once per wizard
    /// (`GET /api/businesses/my-businesses`, route
    /// `backend/routes/businesses.js:682`). Failure is silent — the chip
    /// stays a static "Personal · You". A business is postable only via
    /// its own user id (`business_user_id` on the membership row); rows
    /// without one — or without a display name — are hidden.
    func loadIdentitiesIfNeeded() async {
        guard !identitiesLoaded else { return }
        identitiesLoaded = true
        do {
            let response: MyBusinessesResponse = try await api.request(BusinessesEndpoints.myBusinesses())
            var seen = Set<String>()
            let businesses: [GigComposeIdentityOption] = response.businesses.compactMap { membership in
                let businessUserId = membership.businessUserId
                guard !businessUserId.isEmpty, seen.insert(businessUserId).inserted else { return nil }
                guard let name = displayName(for: membership) else { return nil }
                return GigComposeIdentityOption(
                    id: businessUserId,
                    beneficiaryUserId: businessUserId,
                    label: name
                )
            }
            identityOptions = [.personal] + businesses
            // A restored form may carry a beneficiary the user no longer
            // has a seat on — fall back to Personal so the post can't
            // ride a stale id.
            if let current = form.beneficiaryUserId,
               !businesses.contains(where: { $0.beneficiaryUserId == current }) {
                selectIdentity(.personal)
            }
        } catch {
            // Silent — persona switching simply isn't offered.
        }
    }

    /// Chip-menu selection. Personal clears the beneficiary; a business
    /// stamps its user id + display name into the (persisted) form.
    func selectIdentity(_ option: GigComposeIdentityOption) {
        form.beneficiaryUserId = option.beneficiaryUserId
        form.beneficiaryName = option.beneficiaryUserId == nil ? nil : option.label
    }

    private func displayName(for membership: BusinessMembership) -> String? {
        let name = membership.business.name ?? membership.business.username
        guard let name, !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return name
    }

    // MARK: - Voice note → transcription

    /// Push a recorded `.m4a` through `POST /api/ai/transcribe` and
    /// append the text to the describe field (which re-kicks the parse).
    /// Failures are silent — the recording UI simply resets.
    func appendTranscribedAudio(_ data: Data) async {
        guard !data.isEmpty else { return }
        isTranscribing = true
        defer { isTranscribing = false }
        do {
            let response = try await uploader.transcribeAudio(
                MultipartFile(
                    fieldName: "audio",
                    filename: "describe.m4a",
                    mimeType: "audio/m4a",
                    data: data
                )
            )
            let text = response.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return }
            setDescribeText(form.describeText.isEmpty ? text : form.describeText + " " + text)
        } catch {
            // Silent — mic stays available for another take.
        }
    }

    // MARK: - Field updates

    func selectCategory(_ category: GigComposeCategory) {
        form.category = category
    }

    /// A12.8 — step-1 engagement tile. Mirrors into `scheduleType`
    /// (Recurring → recurring, Open-ended → flexible); One-time clears a
    /// recurring/flexible leftover so the When picker re-prompts.
    func selectEngagementMode(_ mode: GigComposeEngagementMode) {
        form.engagementTile = mode
        switch mode {
        case .oneTime:
            if form.scheduleType == .recurring || form.scheduleType == .flexible {
                form.scheduleType = nil
            }
        case .recurring:
            form.scheduleType = .recurring
        case .openEnded:
            form.scheduleType = .flexible
        }
    }

    /// A12.8 — explicit backend engagement-mode override (Budget & mode
    /// step segmented control).
    func selectEngagementOverride(_ mode: GigEngagementMode) {
        form.engagementOverride = mode
    }

    /// A12.8 — optional effort estimate, hours as text ("2", "2.5").
    func setEstimatedHours(_ value: String) {
        form.estimatedHours = sanitizeBudget(value)
    }

    func setTitle(_ title: String) {
        // Hard-stop typing past the max so the user can't enter
        // server-rejecting values. The validation guard on advance still
        // catches the case where state restored from older builds.
        form.title = String(title.prefix(GigComposeLimits.titleMax))
    }

    func setDescription(_ description: String) {
        form.description = String(description.prefix(GigComposeLimits.descriptionMax))
    }

    /// Generic form mutator for the Fill-gaps module field groups —
    /// avoids one bespoke setter per module field.
    func updateForm(_ mutate: (inout GigComposeFormState) -> Void) {
        mutate(&form)
    }

    // MARK: - P15.5 Photo uploads

    /// True while any photo upload is still in flight — gates the
    /// Continue / Post CTAs so a half-uploaded gig can't ship.
    var hasUploadsInFlight: Bool {
        attachments.contains { $0.status == .uploading }
    }

    /// Add a picked photo and immediately upload it in the background.
    /// Caps the grid at `GigComposeLimits.maxPhotos` — extra calls are
    /// ignored. The first photo is the gig's cover.
    func addPhotoData(_ data: Data) {
        guard attachments.count < GigComposeLimits.maxPhotos, !data.isEmpty else { return }
        let attachment = GigComposeAttachment(id: UUID().uuidString, imageData: data, status: .uploading)
        attachments.append(attachment)
        startUpload(attachmentId: attachment.id)
    }

    /// Tap-to-retry on a failed tile.
    func retryUpload(id: String) {
        guard let index = attachments.firstIndex(where: { $0.id == id }),
              attachments[index].status == .failed else { return }
        attachments[index].status = .uploading
        startUpload(attachmentId: id)
    }

    /// Remove a photo (any state). Cancels an in-flight upload and drops
    /// the mirrored URL from `form.photoIds`.
    func removeAttachment(id: String) {
        uploadTasks[id]?.cancel()
        uploadTasks[id] = nil
        guard let index = attachments.firstIndex(where: { $0.id == id }) else { return }
        attachments.remove(at: index)
        syncPhotoIds()
    }

    private func startUpload(attachmentId: String) {
        uploadTasks[attachmentId] = Task { [weak self] in
            await self?.performUpload(attachmentId: attachmentId)
        }
    }

    /// Push one photo through `POST /api/files/upload` (same mechanism
    /// as the Delivery Proof sheet) and mirror the resulting URL into
    /// `form.photoIds` so it rides the post body's `attachments`.
    func performUpload(attachmentId: String) async {
        guard let attachment = attachments.first(where: { $0.id == attachmentId }) else { return }
        do {
            let response = try await uploader.uploadFile(
                MultipartFile(
                    fieldName: "file",
                    filename: "gig-\(attachmentId.prefix(6)).jpg",
                    mimeType: "image/jpeg",
                    data: attachment.imageData
                ),
                formFields: ["file_type": "gig_photo"]
            )
            guard let index = attachments.firstIndex(where: { $0.id == attachmentId }) else { return }
            attachments[index].status = .uploaded(url: response.file.url)
            syncPhotoIds()
        } catch {
            guard let index = attachments.firstIndex(where: { $0.id == attachmentId }) else { return }
            attachments[index].status = .failed
        }
    }

    /// Rebuild `form.photoIds` in *grid* order (not upload-completion
    /// order) so the first tile stays the cover even when concurrent
    /// uploads finish out of order.
    private func syncPhotoIds() {
        form.photoIds = attachments.compactMap(\.uploadedURL)
    }

    #if DEBUG
    /// Test hook — wait for every kicked upload task to settle.
    func awaitUploadsForTesting() async {
        for task in uploadTasks.values {
            await task.value
        }
    }
    #endif

    func selectBudgetType(_ type: GigComposeBudgetType) {
        form.budgetType = type
    }

    func setBudgetMin(_ value: String) {
        form.budgetMin = sanitizeBudget(value)
    }

    func setBudgetMax(_ value: String) {
        form.budgetMax = sanitizeBudget(value)
    }

    func selectScheduleType(_ type: GigComposeScheduleType) {
        form.scheduleType = type
        // Clear the date when leaving "one-time" so it can't bleed past.
        if type != .oneTime { form.scheduledStartISO = nil }
    }

    func setScheduledStart(_ date: Date?) {
        if let date {
            form.scheduledStartISO = ISO8601DateFormatter().string(from: date)
        } else {
            form.scheduledStartISO = nil
        }
    }

    func selectLocationMode(_ mode: GigComposeLocationMode) {
        form.locationMode = mode
    }

    func updatePlaceAddress(line1: String? = nil, city: String? = nil, state: String? = nil, zip: String? = nil) {
        if let line1 { form.placeAddress.line1 = line1 }
        if let city { form.placeAddress.city = city }
        if let state { form.placeAddress.state = state }
        if let zip { form.placeAddress.zip = zip }
    }

    // MARK: - E.1 Composer picker sheets

    /// Present one of the composer's bottom-sheet pickers.
    func presentPicker(_ sheet: GigPickerSheet) {
        activePickerSheet = sheet
    }

    /// Dismiss whichever picker sheet is open.
    func dismissPicker() {
        activePickerSheet = nil
    }

    /// Step-1 module-prompt row tap → the matching editor.
    func handleModulePromptTap(_ key: GigModulePrompt.Key) {
        switch key {
        case .when: presentPicker(.when)
        case .location: presentPicker(.location)
        case .effort: presentPicker(.effort)
        case .budget: transition(to: .budget)
        case .photos: break // The view owns the PhotosPicker presentation.
        }
    }

    /// E.1 — set (or clear) the optional deadline. `iso == nil` ⇒ flexible.
    func setDeadline(_ iso: String?) {
        form.deadlineISO = iso
    }

    /// E.1 — choose the cancellation-policy tier.
    func setCancellationPolicy(_ policy: GigCancellationPolicy) {
        form.cancellationPolicy = policy
    }

    /// E.1 — toggle the urgent boost flag.
    func setUrgent(_ isUrgent: Bool) {
        form.isUrgent = isUrgent
    }

    /// E.1 — add a tag if there's room (`maxTags`). No-op on duplicates or
    /// empty input.
    func addTag(_ raw: String) {
        guard let tag = Self.normalizeTag(raw),
              form.tags.count < GigComposeLimits.maxTags,
              !form.tags.contains(tag)
        else { return }
        form.tags.append(tag)
    }

    /// E.1 — remove a tag by its normalised value.
    func removeTag(_ tag: String) {
        form.tags.removeAll { $0 == tag }
    }

    /// E.1 — add a suggested tag if absent, remove it if already chosen.
    func toggleTag(_ raw: String) {
        guard let tag = Self.normalizeTag(raw) else { return }
        if form.tags.contains(tag) {
            removeTag(tag)
        } else {
            addTag(tag)
        }
    }

    /// Normalise a freeform tag into the stored form: trimmed, lowercased,
    /// without a leading `#`, whitespace collapsed to single hyphens, capped
    /// at 50 chars. Returns nil for empty input.
    static func normalizeTag(_ raw: String) -> String? {
        let lowered = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let withoutHash = lowered.hasPrefix("#") ? String(lowered.dropFirst()) : lowered
        let hyphenated = withoutHash
            .split { $0 == " " || $0 == "\t" }
            .joined(separator: "-")
        let capped = String(hyphenated.prefix(50))
        return capped.isEmpty ? nil : capped
    }

    // MARK: - State transitions

    var currentStep: GigComposeStep {
        GigComposeStep(rawValue: form.step) ?? .describe
    }

    /// True when the active step's inputs are valid enough to advance.
    /// Exposed for tests and for the chrome's `primaryCTAEnabled` flag.
    var canAdvance: Bool {
        primaryEnabled(for: currentStep)
    }

    private func advance() async {
        switch currentStep {
        case .describe:
            // Leaving the describe step on the Magic path commits the
            // parsed draft into any fields the user hasn't filled
            // themselves. The manual path lands on Fill gaps unprefilled.
            if form.composeMode == .magic { prefillFromMagicDraft() }
            transition(to: .fillGaps)
        case .fillGaps:
            transition(to: .budget)
        case .budget:
            transition(to: .review)
        case .review:
            await submit()
        case .success:
            if let gigId = createdGigId {
                pendingEvent = .openGigDetail(gigId: gigId)
            }
        }
    }

    /// B.3 — fold the stashed magic draft into the form. Prefill is
    /// deliberately empty-fields-only so a user who already typed a
    /// title (or picked a budget) never gets stomped by the parser.
    private func prefillFromMagicDraft() {
        guard let draft = magicDraft else { return }
        if form.title.isEmpty, let title = draft.title, !title.isEmpty {
            form.title = String(title.prefix(GigComposeLimits.titleMax))
        }
        if form.description.isEmpty, let description = draft.description, !description.isEmpty {
            form.description = String(description.prefix(GigComposeLimits.descriptionMax))
        }
        if form.budgetType == nil, form.budgetMin.isEmpty, form.budgetMax.isEmpty {
            switch draft.payType {
            case "fixed":
                form.budgetType = .fixed
                if let fixed = draft.budgetFixed, fixed > 0 {
                    form.budgetMin = Self.formatBudgetValue(fixed)
                }
            case "hourly":
                form.budgetType = .hourly
                if let rate = draft.hourlyRate, rate > 0 {
                    form.budgetMin = Self.formatBudgetValue(rate)
                }
            case "offers":
                form.budgetType = .offers
            default:
                break
            }
            if let range = draft.budgetRange, form.budgetType != .offers, form.budgetType != nil {
                if form.budgetMin.isEmpty, range.min > 0 {
                    form.budgetMin = Self.formatBudgetValue(range.min)
                }
                if range.max > 0 {
                    form.budgetMax = Self.formatBudgetValue(range.max)
                }
            }
        }
        if form.scheduleType == nil {
            // Only the clean maps: backend "scheduled" → one-time,
            // "flexible" → flexible. "asap"/"today" have no wizard
            // equivalent, so the user picks on the Fill-gaps step.
            switch draft.scheduleType {
            case "scheduled": form.scheduleType = .oneTime
            case "flexible": form.scheduleType = .flexible
            default: break
            }
        }
        if form.tags.isEmpty, let tags = draft.tags {
            for tag in tags.prefix(GigComposeLimits.maxTags) {
                addTag(tag)
            }
        }
        if form.estimatedHours.isEmpty, let hours = draft.estimatedHours, hours > 0 {
            form.estimatedHours = Self.formatBudgetValue(hours)
        }
        if form.taskArchetype == nil, let archetype = draft.taskArchetype, !archetype.isEmpty {
            form.taskArchetype = archetype
        }
        if draft.isUrgent == true { form.isUrgent = true }
        // Module objects ride straight through when the parser carried
        // them (empty-only so user edits never get stomped).
        if form.careDetails == nil { form.careDetails = draft.careDetails }
        if form.logisticsDetails == nil { form.logisticsDetails = draft.logisticsDetails }
        if form.remoteDetails == nil { form.remoteDetails = draft.remoteDetails }
        if form.urgentDetails == nil { form.urgentDetails = draft.urgentDetails }
        if form.eventDetails == nil { form.eventDetails = draft.eventDetails }
        if form.items.isEmpty, let items = draft.items { form.items = Array(items.prefix(20)) }
        prefillFlatModules(from: draft)
    }

    /// Fold the parser's flat delivery / pro-service suggestions into
    /// the two module editors (RN `gig-v2/new.tsx:231-251`). Empty-only
    /// so a user's own typing is never stomped.
    private func prefillFlatModules(from draft: MagicDraftDTO) {
        let hasDelivery = draft.pickupAddress != nil || draft.dropoffAddress != nil
            || draft.pickupNotes != nil || draft.dropoffNotes != nil
            || draft.deliveryProofRequired != nil
        if form.deliveryDetails == nil, hasDelivery {
            form.deliveryDetails = GigDeliveryDetails(
                pickupAddress: draft.pickupAddress,
                pickupNotes: draft.pickupNotes,
                dropoffAddress: draft.dropoffAddress,
                dropoffNotes: draft.dropoffNotes,
                proofRequired: draft.deliveryProofRequired
            )
        }
        let hasPro = draft.requiresLicense != nil || draft.scopeDescription != nil
            || draft.licenseType != nil || draft.requiresInsurance != nil
            || draft.depositRequired != nil || draft.depositAmount != nil
        if form.proServiceDetails == nil, hasPro {
            var depositText: String?
            if let amount = draft.depositAmount { depositText = Self.formatBudgetValue(amount) }
            form.proServiceDetails = GigProServiceDetails(
                requiresLicense: draft.requiresLicense,
                licenseType: draft.licenseType,
                requiresInsurance: draft.requiresInsurance,
                scopeDescription: draft.scopeDescription,
                depositRequired: draft.depositRequired,
                depositAmount: depositText
            )
        }
    }

    /// Render a draft dollar amount into the budget text fields —
    /// whole numbers without the trailing ".0".
    private static func formatBudgetValue(_ value: Double) -> String {
        value.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(value))
            : String(format: "%.2f", value)
    }

    private func goBack() {
        guard let previous = GigComposeStep(rawValue: form.step - 1) else { return }
        transition(to: previous)
    }

    private func transition(to step: GigComposeStep) {
        form.step = step.rawValue
        errorMessage = nil
        infoMessage = nil
        if let stepNumber = step.stepNumber {
            Analytics.track(
                .screenComposeGigWizardStepViewed(
                    stepNumber: stepNumber,
                    stepName: String(describing: step)
                )
            )
        }
    }
}

extension GigComposeViewModel {
    // MARK: - A12.8 Live module prompts ("Task details" card)

    /// The five live When / Where / Effort / Photos / Budget rows. Values
    /// derive from form state; filled-ness drives the green-check vs
    /// amber-Add chrome.
    var modulePrompts: [GigModulePrompt] {
        [
            GigModulePrompt(
                key: .when,
                icon: .calendar,
                label: "When",
                value: whenSummary ?? "When does it happen?",
                isFilled: whenSummary != nil
            ),
            GigModulePrompt(
                key: .location,
                icon: .mapPin,
                label: "Where",
                value: whereSummary ?? "Where does it happen?",
                isFilled: whereSummary != nil
            ),
            GigModulePrompt(
                key: .effort,
                icon: .timer,
                label: "Effort",
                value: effortSummary ?? "Rough time estimate",
                isFilled: effortSummary != nil
            ),
            GigModulePrompt(
                key: .photos,
                icon: .camera,
                label: "Photos",
                value: photosSummaryValue ?? "Recommended for better bids",
                isFilled: photosSummaryValue != nil
            ),
            GigModulePrompt(
                key: .budget,
                icon: .wallet,
                label: "Budget",
                value: budgetSummaryValue ?? "Set a budget",
                isFilled: budgetSummaryValue != nil
            )
        ]
    }

    /// "Sat Oct 18 · 9:00 AM" / "Flexible" / "Recurring" — nil when the
    /// schedule is still unset (or one-time without a date).
    var whenSummary: String? {
        switch form.scheduleType {
        case .oneTime:
            guard let iso = form.scheduledStartISO,
                  let date = ISO8601DateFormatter().date(from: iso) else { return nil }
            let fmt = DateFormatter()
            fmt.dateFormat = "EEE MMM d · h:mm a"
            return fmt.string(from: date)
        case .recurring:
            return "Recurring"
        case .flexible:
            return "Flexible"
        case nil:
            return nil
        }
    }

    /// Resolved location line — nil when unset or an incomplete address.
    var whereSummary: String? {
        switch form.locationMode {
        case .yourAddress:
            return "Your saved address"
        case .virtual:
            return "Remote / Online"
        case .aPlace:
            guard form.placeAddress.isComplete else { return nil }
            return form.placeAddress.line1.trimmingCharacters(in: .whitespacesAndNewlines)
        case nil:
            return nil
        }
    }

    /// "~2 hours" — nil when no estimate is set.
    var effortSummary: String? {
        guard let hours = Double(form.estimatedHours), hours > 0 else { return nil }
        let rendered = hours.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(hours))
            : String(format: "%.1f", hours)
        return "~\(rendered) hour\(hours == 1 ? "" : "s")"
    }

    private var photosSummaryValue: String? {
        let count = form.photoIds.count
        guard count > 0 else { return nil }
        return count == 1 ? "1 photo added" : "\(count) photos added"
    }

    private var budgetSummaryValue: String? {
        guard let type = form.budgetType else { return nil }
        switch type {
        case .offers:
            return "Open to offers"
        case .fixed, .hourly:
            guard !form.budgetMin.isEmpty else { return nil }
            let suffix = type == .hourly ? "/hr" : ""
            if !form.budgetMax.isEmpty {
                return "$\(form.budgetMin)–\(form.budgetMax)\(suffix)"
            }
            return "$\(form.budgetMin)\(suffix)"
        }
    }

    /// Which archetype module field group the Fill-gaps step renders.
    /// Derived from the parsed `task_archetype`, falling back to a
    /// category-based default on the manual path. Logic lives on
    /// `GigMagicPostBuilder` (P6c) so the draft-queue retry gates the
    /// module objects identically.
    var activeModuleGroup: GigModuleGroup? {
        GigMagicPostBuilder.moduleGroup(for: form)
    }

    // MARK: - A12.8 Engagement mode

    /// Default backend `engagement_mode` per the A12.8 inference rules:
    /// pro-quote archetype → quotes; ASAP/urgent (non-pro) → instant
    /// accept; everything else → curated offers.
    static func inferEngagementMode(
        archetype: String?,
        scheduleType: String?,
        isUrgent: Bool
    ) -> GigEngagementMode {
        if archetype == "pro_service_quote" { return .quotes }
        if scheduleType == "asap" || isUrgent { return .instantAccept }
        return .curatedOffers
    }

    /// The engagement mode the post will carry — user override first,
    /// inference otherwise (shared with the draft-queue retry).
    var effectiveEngagementMode: GigEngagementMode {
        GigMagicPostBuilder.engagementMode(for: form, fallbackScheduleType: magicDraft?.scheduleType)
    }

    // MARK: - G. Price benchmark

    /// Fetch the low/median/high benchmark for the chosen category
    /// (`GET /api/gigs/price-benchmark`), geo-scoped to the cached
    /// device location when one exists. Failures are silent — the hint
    /// simply doesn't render — and a benchmark with no comparables is
    /// treated as absent.
    func loadPriceBenchmark() async {
        guard let category = form.category else {
            priceBenchmark = nil
            benchmarkCategory = nil
            return
        }
        if category == benchmarkCategory, priceBenchmark != nil { return }
        benchmarkCategory = category
        do {
            let coordinate = location.cachedCoordinate()
            let response: GigPriceBenchmarkResponse = try await api.request(
                GigsEndpoints.priceBenchmark(
                    category: category.rawValue,
                    lat: coordinate?.latitude,
                    lng: coordinate?.longitude
                )
            )
            guard form.category == category else { return }
            if let benchmark = response.benchmark, (benchmark.comparableCount ?? 0) > 0 {
                priceBenchmark = benchmark
            } else {
                priceBenchmark = nil
            }
        } catch {
            guard form.category == category else { return }
            priceBenchmark = nil
            benchmarkCategory = nil
        }
    }

    // MARK: - API

    private func submit() async {
        Analytics.track(.ctaComposeGigSubmit)
        if !isOnlineProvider() {
            stashOfflineDraft()
            errorMessage = "You're offline — we saved this as a draft. Post it from the Gigs feed when you're back."
            return
        }
        guard let body = buildMagicPostBody() else {
            errorMessage = "Please complete each step before posting."
            return
        }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let response: MagicPostResponse = try await api.request(GigsEndpoints.magicPost(body: body))
            // A draft stashed by an earlier offline attempt just shipped.
            if let queuedDraftId {
                draftQueue.remove(id: queuedDraftId)
                self.queuedDraftId = nil
            }
            createdGigId = response.gig.id
            notifiedCount = response.notifiedCount ?? 0
            nearbyHelpers = response.nearbyHelpers ?? 0
            transition(to: .success)
            startUndoCountdown(windowMs: response.gig.undoWindowMs ?? 10000)
        } catch {
            if Self.isConnectivityError(error) {
                stashOfflineDraft()
                errorMessage = "No connection — we saved this as a draft. Post it from the Gigs feed when you're back."
            } else {
                errorMessage = (error as? APIError)?.errorDescription
                    ?? "Couldn't post your task. Please try again."
            }
        }
    }

    // MARK: - P6c Offline draft queue

    /// Persist the live form into the pending-drafts queue, replacing
    /// this wizard's earlier stash so repeat failures never duplicate.
    private func stashOfflineDraft() {
        queuedDraftId = draftQueue.enqueue(form, replacing: queuedDraftId)
    }

    /// "Save draft" on the close confirm — stash + dismiss. The feed's
    /// draft banner picks it up from there.
    func saveDraftConfirmed() {
        stashOfflineDraft()
        pendingEvent = .dismiss
    }

    /// Connectivity taxonomy for the enqueue-on-failure path: the
    /// client's `.transport` wrapper or a bare network-class `URLError`.
    static func isConnectivityError(_ error: any Error) -> Bool {
        if let apiError = error as? APIError {
            if case let .transport(underlying) = apiError {
                return connectivityURLErrorCodes.contains(underlying.code)
            }
            return false
        }
        if let urlError = error as? URLError {
            return connectivityURLErrorCodes.contains(urlError.code)
        }
        return false
    }

    private static let connectivityURLErrorCodes: Set<URLError.Code> = [
        .notConnectedToInternet, .networkConnectionLost, .timedOut,
        .cannotConnectToHost, .cannotFindHost, .dnsLookupFailed,
        .dataNotAllowed, .internationalRoamingOff
    ]

    /// Tick the success step's "Undo · Ns" pill down once a second.
    private func startUndoCountdown(windowMs: Int) {
        undoCountdownTask?.cancel()
        undoSecondsRemaining = max(0, Int((Double(windowMs) / 1000).rounded()))
        undoCountdownTask = Task { [weak self] in
            while let self, undoSecondsRemaining > 0, !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard !Task.isCancelled else { return }
                undoSecondsRemaining = max(0, undoSecondsRemaining - 1)
            }
        }
    }

    /// `POST /api/gigs/:gigId/undo` — pull the freshly posted gig back
    /// within the window and return to the review step, form intact.
    func undoPost() async {
        guard let gigId = createdGigId, undoSecondsRemaining > 0 else { return }
        do {
            _ = try await api.request(GigsEndpoints.undoGig(gigId: gigId), as: GigUndoResponse.self)
            undoCountdownTask?.cancel()
            undoSecondsRemaining = 0
            createdGigId = nil
            transition(to: .review)
            infoMessage = "Task undone"
        } catch {
            // Window raced out (or server refused) — kill the pill so the
            // user isn't offered an undo that can't succeed.
            undoCountdownTask?.cancel()
            undoSecondsRemaining = 0
        }
    }

    /// Assemble the `POST /api/gigs/magic-post` body from the form.
    /// Returns nil if any required field is missing —
    /// `primaryEnabled(...)` should have caught it but we double-check
    /// before sending. Delegates to `GigMagicPostBuilder` (P6c) so the
    /// feed's offline-draft retry shares the exact assembly.
    func buildMagicPostBody() -> MagicPostBody? {
        GigMagicPostBuilder.body(
            from: form,
            coordinate: location.cachedCoordinate(),
            fallbackScheduleType: magicDraft?.scheduleType,
            privacyLevel: magicDraft?.privacyLevel ?? "exact_after_accept",
            aiConfidence: draftConfidence,
            aiDraft: magicDraft
        )
    }
}

extension GigComposeViewModel {
    // MARK: - Chrome derivation

    private func progressLabel(for step: GigComposeStep) -> WizardProgressLabel {
        if let stepNumber = step.stepNumber {
            return .stepOf(current: stepNumber, total: GigComposeStep.progressTotal)
        }
        return .hidden
    }

    private func progressFraction(for step: GigComposeStep) -> Double? {
        guard let stepNumber = step.stepNumber else { return nil }
        return Double(stepNumber) / Double(GigComposeStep.progressTotal)
    }

    private func leadingControl(for step: GigComposeStep) -> WizardLeadingControl {
        switch step {
        case .describe, .success: .close
        case .fillGaps, .budget, .review: .back
        }
    }

    private func primaryCTALabel(for step: GigComposeStep) -> String {
        switch step {
        case .describe:
            form.composeMode == .magic
                ? "Review & post →"
                // Manual path: the disabled CTA carries the nudge copy
                // until a tile is selected.
                : (form.category == nil ? "Pick a category to continue" : "Continue")
        case .fillGaps, .budget: "Continue"
        case .review: "Post task"
        case .success: "View task"
        }
    }

    private func secondaryCTA(for step: GigComposeStep) -> WizardSecondaryCTA? {
        switch step {
        case .success:
            WizardSecondaryCTA(label: "Done", identifier: "composeGigDone")
        case .describe where form.composeMode == .magic:
            // Ghost beside the primary CTA → manual picker.
            WizardSecondaryCTA(
                label: "Pick category",
                identifier: "gigCompose.cta.pickCategory",
                icon: .layoutGrid
            )
        default:
            nil
        }
    }

    private func primaryEnabled(for step: GigComposeStep) -> Bool {
        switch step {
        case .describe:
            // Magic: enabled once an archetype is detected. Manual:
            // enabled once a category tile is selected.
            form.composeMode == .magic ? form.detectedArchetype != nil : form.category != nil
        case .fillGaps:
            hasValidFillGaps
        case .budget:
            hasValidBudget
        case .review:
            // P15.5 — don't allow posting while a photo upload is still
            // settling (the URL wouldn't make it into `attachments`).
            buildMagicPostBody() != nil && !hasUploadsInFlight
        case .success:
            createdGigId != nil
        }
    }

    private var dirtyForCloseConfirm: Bool {
        currentStep != .success && form.hasAnyData
    }

    // MARK: - Helpers

    /// Strip everything except digits + a single decimal point. Empty
    /// strings stay empty so the placeholder shows.
    private func sanitizeBudget(_ raw: String) -> String {
        var seenDot = false
        var out = ""
        for char in raw {
            if char.isNumber {
                out.append(char)
            } else if char == "." && !seenDot {
                out.append(char)
                seenDot = true
            }
        }
        return out
    }
}

private extension GigComposeViewModel {
    /// Fill-gaps gate: valid basics, plus the conditional When/Where
    /// rules. Unset schedule/location are allowed — magic-post defaults
    /// them ("flexible" + no location) — but a chosen one-time schedule
    /// needs its date and a chosen "a place" needs the full address.
    var hasValidFillGaps: Bool {
        let title = form.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let desc = form.description.trimmingCharacters(in: .whitespacesAndNewlines)
        let basics = title.count >= GigComposeLimits.titleMin
            && title.count <= GigComposeLimits.titleMax
            && desc.count >= GigComposeLimits.descriptionMin
            && desc.count <= GigComposeLimits.descriptionMax
            && form.photoIds.count <= GigComposeLimits.maxPhotos
            // P15.5 — Continue waits for in-flight photo uploads (the
            // grid shows an "uploading" hint while this gate is closed).
            && !hasUploadsInFlight
        return basics && hasValidSchedule && hasValidLocation && hasValidModules
    }

    /// Module-level gate. Only the pro-service deposit is conditional
    /// today: toggling "Require deposit" on demands a positive amount
    /// (mirrors RN's deposit validation).
    var hasValidModules: Bool {
        guard activeModuleGroup == .proService else { return true }
        return form.proServiceDetails?.isDepositAmountMissing != true
    }

    var hasValidBudget: Bool {
        guard let type = form.budgetType else { return false }
        switch type {
        case .offers:
            return true
        case .fixed, .hourly:
            let min = Double(form.budgetMin) ?? 0
            return min > 0
        }
    }

    var hasValidSchedule: Bool {
        guard let type = form.scheduleType else { return true }
        if type == .oneTime {
            guard let iso = form.scheduledStartISO,
                  let date = ISO8601DateFormatter().date(from: iso)
            else { return false }
            return date.timeIntervalSinceNow > 0
        }
        return true
    }

    var hasValidLocation: Bool {
        guard let mode = form.locationMode else { return true }
        switch mode {
        case .yourAddress, .virtual:
            return true
        case .aPlace:
            return form.placeAddress.isComplete
        }
    }
}
