//
//  PostGigV1ViewModel.swift
//  Pantopus
//
//  A13.8 — legacy single-screen gig composer. `submit()` posts the form to
//  `POST /api/gigs` (`GigsEndpoints.create`) — the same create path the V2
//  "Magic" composer (`GigComposeViewModel`) and the gigs feed use. The V2
//  `/api/gigs/magic-*` draft flow is separate and untouched here.
//
//  Phase 4 (A13.8 polish): photos ride the real `POST /api/files/upload`
//  pipeline (per-tile uploading / failed-retry / uploaded states, same
//  mechanism as the V2 wizard's P15.5 handling), and an optional
//  `editGigId` flips the screen into edit mode — `GET /api/gigs/:id`
//  prefills every field and submit goes to `PATCH /api/gigs/:id`.
//

import Foundation
import Observation

// swiftlint:disable file_length

public enum PostGigV1PriceType: String, CaseIterable, Identifiable, Sendable {
    case flat
    case hourly
    case free

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .flat: "Flat"
        case .hourly: "Hourly"
        case .free: "Free"
        }
    }

    public var unitLabel: String? {
        switch self {
        case .flat: "flat"
        case .hourly: "/ hr"
        case .free: nil
        }
    }
}

/// One photo tile riding the real upload pipeline
/// (`POST /api/files/upload`, field `file`, `file_type: "gig_photo"`).
/// The raw bytes back the grid thumbnail; `status` drives the per-tile
/// spinner / retry / uploaded chrome. Edit-mode prefill rehydrates tiles
/// from the gig's stored `attachments` (URL only, no bytes).
public struct PostGigV1Photo: Identifiable, Equatable, Sendable {
    public enum Status: Equatable, Sendable {
        case uploading
        case failed
        case uploaded(url: String)
    }

    public let id: String
    public let imageData: Data
    public var status: Status

    public init(id: String, imageData: Data = Data(), status: Status) {
        self.id = id
        self.imageData = imageData
        self.status = status
    }

    public var uploadedURL: String? {
        if case let .uploaded(url) = status { return url }
        return nil
    }
}

/// `cancellation_policy` — the three values `createGigSchema` /
/// `updateGigSchema` accept (`backend/routes/gigs.js:438` / `:649`).
/// Labels + blurbs mirror the backend's `CANCELLATION_POLICIES` table
/// (`gigs.js:541`) so the picker states the real rule.
public enum PostGigV1CancellationPolicy: String, CaseIterable, Identifiable, Sendable {
    case flexible
    case standard
    case strict

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .flexible: "Flexible"
        case .standard: "Standard"
        case .strict: "Strict"
        }
    }

    public var blurb: String {
        switch self {
        case .flexible: "Free cancellation anytime before work starts."
        case .standard: "Free within 1 hour of acceptance. After that, 5% fee."
        case .strict: "10% fee after acceptance. 50% after work starts."
        }
    }
}

/// One errand / shopping line item (`Gig.items` jsonb). Mirrors RN's
/// `TaskItem` (`gig/_components/useGigForm.ts:68`).
public struct PostGigV1Item: Identifiable, Equatable, Sendable {
    public let id: String
    public var name: String
    public var notes: String
    public var budgetCap: String
    public var preferredStore: String

    public init(
        id: String = UUID().uuidString,
        name: String = "",
        notes: String = "",
        budgetCap: String = "",
        preferredStore: String = ""
    ) {
        self.id = id
        self.name = name
        self.notes = notes
        self.budgetCap = budgetCap
        self.preferredStore = preferredStore
    }

    public var isEmpty: Bool {
        name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && budgetCap.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && preferredStore.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

public struct PostGigV1Form: Equatable, Sendable {
    public var category: GigsCategory
    public var title: String
    public var description: String
    public var price: String
    public var priceType: PostGigV1PriceType
    public var scheduledAt: Date
    public var location: String
    public var photos: [PostGigV1Photo]
    /// A13.8 P5 — the fields RN's editor has always carried.
    public var cancellationPolicy: PostGigV1CancellationPolicy
    public var isUrgent: Bool
    /// Comma-separated, exactly like RN's single text input.
    public var tags: String
    /// Optional "must be done by" date (`deadline`). `nil` → omitted.
    public var deadline: Date?
    /// Hours, free-text so an empty field means "omit".
    public var estimatedDuration: String
    public var items: [PostGigV1Item]

    public init(
        category: GigsCategory = .all,
        title: String = "",
        description: String = "",
        price: String = "",
        priceType: PostGigV1PriceType = .flat,
        scheduledAt: Date = Date().addingTimeInterval(86400),
        location: String = "",
        photos: [PostGigV1Photo] = [],
        cancellationPolicy: PostGigV1CancellationPolicy = .standard,
        isUrgent: Bool = false,
        tags: String = "",
        deadline: Date? = nil,
        estimatedDuration: String = "",
        items: [PostGigV1Item] = []
    ) {
        self.category = category
        self.title = title
        self.description = description
        self.price = price
        self.priceType = priceType
        self.scheduledAt = scheduledAt
        self.location = location
        self.photos = photos
        self.cancellationPolicy = cancellationPolicy
        self.isUrgent = isUrgent
        self.tags = tags
        self.deadline = deadline
        self.estimatedDuration = estimatedDuration
        self.items = items
    }

    /// Tags the backend will accept: trimmed, non-empty, capped at the
    /// schema's five (`Joi.array().max(5)`).
    public var parsedTags: [String] {
        // `trimmingCharacters` already yields `String`, so a trailing
        // `.map(String.init)` would be both redundant and ambiguous.
        let trimmed = tags
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return Array(trimmed.prefix(PostGigV1SampleData.maxTags))
    }

    /// RN keeps only items with a name (`useGigForm.ts:346`).
    public var validItems: [PostGigV1Item] {
        items.filter { !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    public var hasAnyInput: Bool {
        category != .all ||
            !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            !price.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            priceType != .flat ||
            !location.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            !photos.isEmpty ||
            cancellationPolicy != .standard ||
            isUrgent ||
            !tags.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            deadline != nil ||
            !estimatedDuration.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            items.contains { !$0.isEmpty }
    }
}

public enum PostGigV1Field: String, Sendable {
    case category
    case title
    case description
    case price
    case dateTime
    case location
    case estimatedDuration
}

public struct PostGigV1ValidationError: Identifiable, Equatable, Sendable {
    public let field: PostGigV1Field
    public let message: String

    public var id: String {
        field.rawValue
    }
}

public enum PostGigV1LoadState: Equatable, Sendable {
    case loading
    case empty
    case ready
    case error(String)
}

public struct PostGigV1State: Equatable, Sendable {
    public var loadState: PostGigV1LoadState
    public var form: PostGigV1Form
    public var validationErrors: [PostGigV1ValidationError]
    public var isSubmitting: Bool
    public var postedGigId: String?

    public init(
        loadState: PostGigV1LoadState = .ready,
        form: PostGigV1Form = PostGigV1Form(),
        validationErrors: [PostGigV1ValidationError] = [],
        isSubmitting: Bool = false,
        postedGigId: String? = nil
    ) {
        self.loadState = loadState
        self.form = form
        self.validationErrors = validationErrors
        self.isSubmitting = isSubmitting
        self.postedGigId = postedGigId
    }
}

@Observable
@MainActor
public final class PostGigV1ViewModel {
    public private(set) var state: PostGigV1State

    private let api: APIClient
    private let uploader: MultipartUploader
    private let referenceNow: Date?

    /// When set the screen is the "Edit gig" surface: `load()` prefills
    /// from `GET /api/gigs/:id` and `submit()` goes to `PATCH`.
    public let editGigId: String?

    /// One-shot guard around the edit-mode prefill fetch.
    private var editLoaded = false

    /// Exact coordinates captured at edit-load. PATCHing `location` with
    /// the V1 free-text address rides these so the stored point survives
    /// (the backend requires lat/lng on the nested location object).
    private var editOrigin: (latitude: Double, longitude: Double)?

    /// In-flight photo uploads keyed by photo id.
    private var uploadTasks: [String: Task<Void, Never>] = [:]

    /// Public entry point — carries no `APIClient` (the client and `.shared`
    /// are module-internal) so views / previews / sample data construct the
    /// composer without referencing it.
    public convenience init(
        initialState: PostGigV1State = PostGigV1State(),
        referenceNow: Date? = nil,
        editGigId: String? = nil
    ) {
        self.init(
            api: .shared,
            initialState: initialState,
            referenceNow: referenceNow,
            editGigId: editGigId
        )
    }

    /// Designated init — module-internal because `APIClient` is. Tests
    /// inject a stubbed client + uploader here.
    init(
        api: APIClient,
        uploader: MultipartUploader = .shared,
        initialState: PostGigV1State = PostGigV1State(),
        referenceNow: Date? = nil,
        editGigId: String? = nil
    ) {
        self.api = api
        self.uploader = uploader
        state = initialState
        self.referenceNow = referenceNow
        self.editGigId = editGigId
        if editGigId != nil {
            state.loadState = .loading
        }
    }

    public var isEditMode: Bool {
        editGigId != nil
    }

    /// Top-bar title — "Post gig" for create, "Edit gig" for edit.
    public var screenTitle: String {
        isEditMode ? "Edit gig" : "Post gig"
    }

    /// Right-action CTA label — "Post" for create, "Save" for edit.
    public var commitLabel: String {
        isEditMode ? "Save" : "Post"
    }

    /// True while any photo upload is still in flight — gates the
    /// Post / Save CTA so a half-uploaded gig can't ship.
    public var hasUploadsInFlight: Bool {
        state.form.photos.contains { $0.status == .uploading }
    }

    public var isPostEnabled: Bool {
        canAttemptSubmit && (state.form.hasAnyInput || !state.validationErrors.isEmpty)
    }

    public var canAttemptSubmit: Bool {
        state.loadState == .ready && !state.isSubmitting && !hasUploadsInFlight
    }

    /// Edit mode: fetch the gig and prefill every field. Create mode:
    /// no-op (the form starts ready).
    public func load() async {
        guard let editGigId, !editLoaded else { return }
        state.loadState = .loading
        do {
            let response: GigDetailResponse = try await api.request(GigsEndpoints.detail(id: editGigId))
            prefill(from: response.gig)
            editLoaded = true
            state.loadState = .ready
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load this gig. Please try again."
            state.loadState = .error(message)
        }
    }

    public func retry() {
        if isEditMode, !editLoaded {
            // The edit prefill never landed — refetch instead of showing
            // an empty form against a PATCH submit.
            Task { await load() }
        } else {
            state.loadState = .ready
        }
    }

    public func startFromEmpty() {
        state = PostGigV1State(form: PostGigV1Form())
    }

    public func seedFilledSample() {
        state = PostGigV1State(form: PostGigV1SampleData.filledForm)
    }

    public func updateCategory(_ category: GigsCategory) {
        state.form.category = category
    }

    public func updateTitle(_ title: String) {
        state.form.title = title
    }

    public func updateDescription(_ description: String) {
        state.form.description = String(description.prefix(PostGigV1SampleData.descriptionMaxLength))
    }

    public func updatePrice(_ price: String) {
        let filtered = price.filter { $0.isNumber || $0 == "." }
        state.form.price = filtered
    }

    public func updatePriceType(_ priceType: PostGigV1PriceType) {
        state.form.priceType = priceType
        if priceType == .free {
            state.form.price = ""
        }
    }

    public func updateScheduledAt(_ date: Date) {
        state.form.scheduledAt = date
    }

    public func updateLocation(_ location: String) {
        state.form.location = location
    }

    // MARK: - A13.8 P5 — the rest of RN's editable field set

    public func updateCancellationPolicy(_ policy: PostGigV1CancellationPolicy) {
        state.form.cancellationPolicy = policy
    }

    public func updateIsUrgent(_ isUrgent: Bool) {
        state.form.isUrgent = isUrgent
    }

    public func updateTags(_ tags: String) {
        state.form.tags = tags
    }

    public func updateDeadline(_ deadline: Date?) {
        state.form.deadline = deadline
    }

    public func updateEstimatedDuration(_ hours: String) {
        state.form.estimatedDuration = hours.filter { $0.isNumber || $0 == "." }
    }

    public func addItem() {
        guard state.form.items.count < PostGigV1SampleData.maxItems else { return }
        state.form.items.append(PostGigV1Item())
    }

    /// Replace one item in place (the view hands back a mutated copy).
    public func updateItem(_ item: PostGigV1Item) {
        guard let index = state.form.items.firstIndex(where: { $0.id == item.id }) else { return }
        state.form.items[index] = item
    }

    public func removeItem(id: String) {
        state.form.items.removeAll { $0.id == id }
    }

    // MARK: - Photo uploads (same pipeline as the V2 wizard's P15.5)

    /// Add a picked photo and immediately upload it in the background.
    /// Caps the grid at `PostGigV1SampleData.maxPhotos` — extra calls
    /// are ignored. The first photo is the gig's cover.
    public func addPhotoData(_ data: Data) {
        guard state.form.photos.count < PostGigV1SampleData.maxPhotos, !data.isEmpty else { return }
        let photo = PostGigV1Photo(id: UUID().uuidString, imageData: data, status: .uploading)
        state.form.photos.append(photo)
        startUpload(photoId: photo.id)
    }

    /// Tap-to-retry on a failed tile.
    public func retryUpload(id: String) {
        guard let index = state.form.photos.firstIndex(where: { $0.id == id }),
              state.form.photos[index].status == .failed else { return }
        state.form.photos[index].status = .uploading
        startUpload(photoId: id)
    }

    /// Remove a photo (any state). Cancels an in-flight upload.
    public func removePhoto(id: String) {
        uploadTasks[id]?.cancel()
        uploadTasks[id] = nil
        state.form.photos.removeAll { $0.id == id }
    }

    private func startUpload(photoId: String) {
        uploadTasks[photoId] = Task { [weak self] in
            await self?.performUpload(photoId: photoId)
        }
    }

    /// Push one photo through `POST /api/files/upload` (field `file`,
    /// `file_type: "gig_photo"` — the V2 wizard's exact mechanism). The
    /// resulting URL rides the create/update body's `attachments`.
    func performUpload(photoId: String) async {
        guard let photo = state.form.photos.first(where: { $0.id == photoId }) else { return }
        do {
            let response = try await uploader.uploadFile(
                MultipartFile(
                    fieldName: "file",
                    filename: "gig-\(photoId.prefix(6)).jpg",
                    mimeType: "image/jpeg",
                    data: photo.imageData
                ),
                formFields: ["file_type": "gig_photo"]
            )
            guard let index = state.form.photos.firstIndex(where: { $0.id == photoId }) else { return }
            state.form.photos[index].status = .uploaded(url: response.file.url)
        } catch {
            guard let index = state.form.photos.firstIndex(where: { $0.id == photoId }) else { return }
            state.form.photos[index].status = .failed
        }
    }

    #if DEBUG
    /// Test hook — wait for every kicked upload task to settle.
    func awaitUploadsForTesting() async {
        for task in uploadTasks.values {
            await task.value
        }
    }
    #endif

    // MARK: - Submit

    /// Validate, then create (`POST /api/gigs`) or — in edit mode —
    /// update (`PATCH /api/gigs/:id`) the gig. On success the
    /// backend-issued gig id is stored in `state.postedGigId` and
    /// returned so the caller can route to the task; on failure the
    /// message surfaces via `loadState = .error(_)` and `retry()`
    /// returns to the still-filled form.
    @discardableResult
    public func submit() async -> String? {
        guard canAttemptSubmit else { return nil }
        let errors = validate(form: state.form)
        guard errors.isEmpty else {
            state.validationErrors = errors
            return nil
        }
        state.validationErrors = []
        state.isSubmitting = true
        defer { state.isSubmitting = false }
        do {
            let response: CreateGigResponse = if let editGigId {
                try await api.request(
                    GigsEndpoints.update(id: editGigId, body: buildUpdateBody(from: state.form))
                )
            } else {
                try await api.request(
                    GigsEndpoints.create(buildCreateBody(from: state.form))
                )
            }
            state.postedGigId = response.gig.id
            return response.gig.id
        } catch {
            let fallback = isEditMode
                ? "Couldn't save your changes. Please try again."
                : "Couldn't post your task. Please try again."
            let message = (error as? APIError)?.errorDescription ?? fallback
            state.loadState = .error(message)
            return nil
        }
    }

    public func error(for field: PostGigV1Field) -> String? {
        state.validationErrors.first { $0.field == field }?.message
    }

    public func dateLabel(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE, MMM d · h:mm a"
        return formatter.string(from: date)
    }
}

// MARK: - Body building, validation, edit prefill

extension PostGigV1ViewModel {
    /// Pay-type maps flat→`fixed`, hourly→`hourly`, free→`offers` with a
    /// true `price: 0` — the backend schema accepts zero
    /// (`Joi.number().min(0)`, `backend/routes/gigs.js:428`).
    private func payTypeAndPrice(from form: PostGigV1Form) -> (payType: String, price: Double) {
        let trimmedPrice = Double(form.price.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        switch form.priceType {
        case .flat:
            return ("fixed", trimmedPrice > 0 ? trimmedPrice : 1)
        case .hourly:
            return ("hourly", trimmedPrice > 0 ? trimmedPrice : 1)
        case .free:
            return ("offers", 0)
        }
    }

    private func uploadedAttachmentURLs(from form: PostGigV1Form) -> [String] {
        form.photos.compactMap(\.uploadedURL)
    }

    /// Map the V1 form onto the `POST /api/gigs` body. The legacy composer
    /// collects a free-text location only, so we send it as the `custom`
    /// location `address` with a `(0, 0)` placeholder coordinate — the same
    /// fallback the V2 composer uses when it has no geocode
    /// (`GigComposeViewModel.fallbackLocation`).
    private func buildCreateBody(from form: PostGigV1Form) -> CreateGigBody {
        let pay = payTypeAndPrice(from: form)
        let attachments = uploadedAttachmentURLs(from: form)
        let tags = form.parsedTags
        let items = form.validItems
        return CreateGigBody(
            title: form.title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: form.description.trimmingCharacters(in: .whitespacesAndNewlines),
            category: form.category == .all ? nil : form.category.rawValue,
            price: pay.price,
            payType: pay.payType,
            scheduleType: "scheduled",
            scheduledStart: ISO8601DateFormatter().string(from: form.scheduledAt),
            taskFormat: nil,
            attachments: attachments.isEmpty ? nil : attachments,
            // RN only sends these when the user filled them in
            // (`useGigForm.ts:331-349`); `cancellation_policy` always rides.
            deadline: form.deadline.map { ISO8601DateFormatter().string(from: $0) },
            cancellationPolicy: form.cancellationPolicy.rawValue,
            isUrgent: form.isUrgent ? true : nil,
            tags: tags.isEmpty ? nil : tags,
            estimatedDuration: Self.durationHours(form.estimatedDuration),
            items: items.isEmpty ? nil : items.map(Self.itemDTO),
            location: CreateGigLocation(
                mode: "custom",
                latitude: 0,
                longitude: 0,
                address: form.location.trimmingCharacters(in: .whitespacesAndNewlines)
            )
        )
    }

    private static func durationHours(_ text: String) -> Double? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let value = Double(trimmed), value > 0 else { return nil }
        return value
    }

    private static func itemDTO(_ item: PostGigV1Item) -> GigItemDTO {
        func clean(_ text: String) -> String? {
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }
        return GigItemDTO(
            name: clean(item.name),
            notes: clean(item.notes),
            budgetCap: clean(item.budgetCap),
            preferredStore: clean(item.preferredStore)
        )
    }

    /// Map the V1 form onto the `PATCH /api/gigs/:id` body — same field
    /// names as create. `attachments` always rides (an empty array
    /// clears removed photos); `location` only rides when edit-load
    /// captured real coordinates, so the stored point is preserved.
    ///
    /// The list-shaped fields (`tags`, `items`) and the two booleans
    /// (`is_urgent`, `cancellation_policy`) always ride here — otherwise
    /// the editor could add but never remove. `deadline` and
    /// `estimated_duration` can only be *set*: the update schema takes
    /// neither `null` (`gigs.js:646`), so clearing them is a backend gap,
    /// not something the client can fake.
    private func buildUpdateBody(from form: PostGigV1Form) -> UpdateGigBody {
        let pay = payTypeAndPrice(from: form)
        var location: CreateGigLocation?
        if let editOrigin {
            location = CreateGigLocation(
                mode: "custom",
                latitude: editOrigin.latitude,
                longitude: editOrigin.longitude,
                address: form.location.trimmingCharacters(in: .whitespacesAndNewlines)
            )
        }
        return UpdateGigBody(
            title: form.title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: form.description.trimmingCharacters(in: .whitespacesAndNewlines),
            category: form.category == .all ? nil : form.category.rawValue,
            price: pay.price,
            payType: pay.payType,
            scheduleType: "scheduled",
            scheduledStart: ISO8601DateFormatter().string(from: form.scheduledAt),
            attachments: uploadedAttachmentURLs(from: form),
            deadline: form.deadline.map { ISO8601DateFormatter().string(from: $0) },
            cancellationPolicy: form.cancellationPolicy.rawValue,
            isUrgent: form.isUrgent,
            tags: form.parsedTags,
            estimatedDuration: Self.durationHours(form.estimatedDuration),
            items: form.validItems.map(Self.itemDTO),
            location: location
        )
    }

    private func validate(form: PostGigV1Form) -> [PostGigV1ValidationError] {
        var errors: [PostGigV1ValidationError] = []
        if form.category == .all {
            errors.append(.init(field: .category, message: "Choose a category."))
        }
        if form.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            errors.append(.init(field: .title, message: "Title is required."))
        }
        if form.description.trimmingCharacters(in: .whitespacesAndNewlines).count < PostGigV1SampleData.descriptionMinLength {
            errors.append(.init(
                field: .description,
                message: "Description must be at least \(PostGigV1SampleData.descriptionMinLength) characters."
            ))
        }
        if form.priceType != .free {
            let trimmed = form.price.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                errors.append(.init(field: .price, message: "Enter a price, or pick Free."))
            } else if (Double(trimmed) ?? 0) <= 0 {
                errors.append(.init(field: .price, message: "Price must be greater than zero."))
            }
        }
        if form.scheduledAt <= (referenceNow ?? Date()) {
            errors.append(.init(field: .dateTime, message: "Date is in the past. Pick a future time."))
        }
        if form.location.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            errors.append(.init(field: .location, message: "Add a pickup or meetup location."))
        }
        // RN's exact rule (`useGigForm.ts:290`).
        let duration = form.estimatedDuration.trimmingCharacters(in: .whitespacesAndNewlines)
        if !duration.isEmpty, (Double(duration) ?? 0) <= 0 {
            errors.append(.init(
                field: .estimatedDuration,
                message: "Estimated duration must be a positive number."
            ))
        }
        return errors
    }

    // MARK: - Edit-mode prefill

    private func prefill(from gig: GigDTO) {
        var form = PostGigV1Form()
        form.category = GigsCategory(rawValue: gig.category ?? "") ?? .all
        form.title = gig.title
        form.description = String((gig.description ?? "").prefix(PostGigV1SampleData.descriptionMaxLength))
        switch gig.payType {
        case "offers":
            form.priceType = .free
            form.price = ""
        case "hourly":
            form.priceType = .hourly
            form.price = Self.priceText(gig.price)
        default:
            form.priceType = .flat
            form.price = Self.priceText(gig.price)
        }
        if let scheduledStart = gig.scheduledStart, let date = Self.parseISO(scheduledStart) {
            form.scheduledAt = date
        }
        form.location = gig.exactAddress ?? gig.pickupAddress ?? ""
        form.photos = (gig.attachments ?? [])
            .prefix(PostGigV1SampleData.maxPhotos)
            .map { PostGigV1Photo(id: $0, status: .uploaded(url: $0)) }
        // A13.8 P5 — the rest of RN's prefill (`useGigForm.ts:90-116`).
        form.cancellationPolicy = PostGigV1CancellationPolicy(rawValue: gig.cancellationPolicy ?? "") ?? .standard
        form.isUrgent = gig.isUrgent ?? false
        form.tags = (gig.tags ?? []).joined(separator: ", ")
        form.deadline = gig.deadline.flatMap(Self.parseISO)
        form.estimatedDuration = gig.estimatedDuration.map { hours in
            hours.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(hours)) : String(hours)
        } ?? ""
        form.items = (gig.items ?? [])
            .map {
                PostGigV1Item(
                    name: $0.name ?? "",
                    notes: $0.notes ?? "",
                    budgetCap: $0.budgetCap ?? "",
                    preferredStore: $0.preferredStore ?? ""
                )
            }
            .filter { !$0.isEmpty }
        if let latitude = gig.location?.latitude ?? gig.latitude,
           let longitude = gig.location?.longitude ?? gig.longitude {
            editOrigin = (latitude, longitude)
        }
        state.form = form
        state.validationErrors = []
    }

    private static func priceText(_ price: Double?) -> String {
        guard let price, price > 0 else { return "" }
        if price.truncatingRemainder(dividingBy: 1) == 0 {
            return String(Int(price))
        }
        return String(price)
    }

    private static func parseISO(_ string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: string) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: string)
    }
}
