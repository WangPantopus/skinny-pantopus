//
//  ListingComposeWizardViewModel.swift
//  Pantopus
//
//  Wizard view model for the Snap & Sell listing-compose flow. Drives
//  the six-step + success state machine and submits to
//  `POST /api/listings` (`backend/routes/listings.js:426`) when creating
//  a new listing, or `PATCH /api/listings/:id`
//  (`backend/routes/listings.js:1479`) when editing an existing one.
//

import Foundation
import Observation

// swiftlint:disable file_length function_body_length type_body_length

/// Outbound navigation events the host view consumes.
public enum ListingComposeOutboundEvent: Sendable, Equatable {
    /// Pop the wizard without further navigation.
    case dismiss
    /// Pop the wizard and route to the newly-created listing's detail.
    case openListingDetail(listingId: String)
    /// Pop the wizard after an edit save — the host usually pops to the
    /// listing detail (which then refreshes) rather than pushing a new
    /// screen.
    case listingUpdated(listingId: String)
}

@Observable
@MainActor
final class ListingComposeWizardViewModel: WizardModel {
    // MARK: - Public state

    /// Live form snapshot — mirrored into `@SceneStorage` so the wizard
    /// can be restored after process death.
    private(set) var form: ListingComposeFormState

    /// True while the final `POST /api/listings` is in flight.
    private(set) var isSubmitting: Bool = false

    /// User-facing error message attached to the active step. Cleared
    /// on any successful step transition.
    private(set) var errorMessage: String?

    /// Set once the user reaches the success step, holds the new
    /// listing's id so the "View listing" CTA can route to its detail.
    /// In edit mode this is set to the existing listing's id once the
    /// PATCH resolves.
    private(set) var createdListingId: String?

    /// True while the existing-listing fetch is in flight (edit mode
    /// only). View overlays a shimmer when this is set so the user
    /// can't tap through stale fields.
    private(set) var isLoadingExisting: Bool = false

    /// True while the Snap & Sell vision draft is in flight. The snap
    /// review step shows an analyzing shimmer instead of the fields.
    private(set) var isAnalyzing: Bool = false

    /// True once an AI draft was applied to the form — drives the
    /// "AI suggested" framing on the review surface.
    private(set) var aiDraftApplied: Bool = false

    /// One-shot navigation events the host view consumes.
    var pendingEvent: ListingComposeOutboundEvent?

    // MARK: - Private dependencies

    private let api: APIClient
    private let uploader: MultipartUploader
    private let isOnlineProvider: @MainActor () -> Bool
    private let mode: ListingComposeMode

    /// Guards re-running the vision draft when the user bounces between
    /// the capture and review steps.
    private var hasRequestedAnalysis = false

    // MARK: - Init

    init(
        mode: ListingComposeMode = .create,
        api: APIClient = .shared,
        uploader: MultipartUploader = .shared,
        initialState: ListingComposeFormState = .empty,
        isOnlineProvider: @escaping @MainActor () -> Bool = { NetworkMonitor.shared.isOnline }
    ) {
        self.mode = mode
        self.api = api
        self.uploader = uploader
        self.isOnlineProvider = isOnlineProvider
        form = initialState
    }

    /// True when the wizard is editing an existing listing.
    var isEditMode: Bool {
        mode.isEdit
    }

    /// The listing id being edited (nil when creating).
    var editingListingId: String? {
        mode.editingListingId
    }

    /// Replace the in-memory form state from scene storage on first
    /// appear. No-op once the wizard has progressed past the restore.
    /// Always a no-op in edit mode — edit fetches its own prefill from
    /// the backend. Photos whose bytes died with the process (image
    /// data is never persisted) are dropped; if that empties a draft
    /// that had photos, the wizard rewinds to the capture step.
    func restore(from snapshot: ListingComposeFormState) {
        guard !isEditMode else { return }
        guard form == .empty else { return }
        var restored = snapshot
        restored.photos = snapshot.photos.filter { $0.isRemote || $0.localImageData != nil }
        if restored.photos.isEmpty, !snapshot.photos.isEmpty,
           restored.step != ListingComposeStep.success.rawValue {
            restored.step = ListingComposeStep.photos.rawValue
        }
        form = restored
    }

    /// Fetch the existing listing and project it into the form. No-op
    /// for create mode. Idempotent — safe to call from `.task { … }`.
    func loadExistingIfNeeded() async {
        guard case let .edit(listingId, jumpToStep) = mode else { return }
        // Only fetch on first land; if the user has already started
        // editing fields, don't blow them away.
        guard form == .empty else { return }
        isLoadingExisting = true
        defer { isLoadingExisting = false }
        do {
            let response: ListingDetailResponse = try await api.request(
                ListingsEndpoints.detail(id: listingId)
            )
            form = Self.project(from: response.listing, jumpToStep: jumpToStep)
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
                ?? "Couldn't load the listing. Pull to retry."
        }
    }

    // MARK: - WizardModel

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

    func secondaryTapped() {
        if isSnapReviewStep {
            pendingEvent = .dismiss
            return
        }
        // Success step's "Back to Marketplace" (create) / "Done" (edit) —
        // no other step uses the secondary. In edit mode "Done" still
        // signals the host to pop and refresh the listing detail, so we
        // emit the same event the primary fires.
        guard currentStep == .success else { return }
        if isEditMode, let listingId = createdListingId {
            pendingEvent = .listingUpdated(listingId: listingId)
        } else {
            pendingEvent = .dismiss
        }
    }

    #if DEBUG
    func advanceForTesting() async {
        await advance()
    }
    #endif

    // MARK: - Step 1 (photos) mutations

    /// A12.9 — append a real camera capture (processed JPEG bytes).
    func captureSnapPhoto(_ imageData: Data) {
        addPhoto(token: "snap_angle_\(form.photos.count + 1)", imageData: imageData)
    }

    /// Escape hatch from the camera-first entry into the original photo
    /// grid editor.
    func skipToManualPhotoEditor() {
        form.entryMode = .manual
    }

    /// Append photos picked from the system photo library.
    func addLibraryPhotos(_ images: [Data]) {
        for imageData in images {
            addPhoto(token: "library_photo_\(form.photos.count + 1)", imageData: imageData)
        }
    }

    /// Append a new photo to the grid. Captures up to `maxPhotos`.
    func addPhoto(
        token: String = "photo_\(UUID().uuidString.prefix(6))",
        imageData: Data? = nil
    ) {
        guard form.photos.count < ListingComposeFormState.maxPhotos else { return }
        form.photos.append(ListingComposePhoto(token: token, localImageData: imageData))
    }

    /// Remove the photo with the given id.
    func removePhoto(id: UUID) {
        form.photos.removeAll { $0.id == id }
    }

    /// Move the photo at `from` to `to`. First slot is the hero so the
    /// view can re-render the HERO chip without a flicker.
    func movePhoto(from: Int, to: Int) {
        guard from != to,
              form.photos.indices.contains(from),
              to >= 0, to <= form.photos.count
        else { return }
        let photo = form.photos.remove(at: from)
        let insertIndex = to > form.photos.count ? form.photos.count : to
        form.photos.insert(photo, at: insertIndex)
    }

    /// Promote a photo to the hero slot (index 0).
    func makeHero(id: UUID) {
        guard let index = form.photos.firstIndex(where: { $0.id == id }), index != 0 else { return }
        let photo = form.photos.remove(at: index)
        form.photos.insert(photo, at: 0)
    }

    // MARK: - Snap & Sell vision draft

    /// Send the captured photos to `POST /api/ai/draft/listing-vision`
    /// and project the draft into the form. Runs once per wizard
    /// session — bouncing back to the camera step doesn't re-bill the
    /// vision model. Failure is non-blocking: the review surface stays
    /// editable so the user can fill the fields manually.
    func analyzePhotosIfNeeded() async {
        // The review panel always needs a location kind so the
        // pickup/delivery card and the submit gate have a value.
        if form.locationKind == nil {
            form.locationKind = .savedAddress
        }
        guard !hasRequestedAnalysis else { return }
        let images = form.photos
            .compactMap(\.localImageData)
            .prefix(ListingComposeFormState.maxVisionImages)
            .map { "data:image/jpeg;base64,\($0.base64EncodedString())" }
        guard !images.isEmpty else { return }
        hasRequestedAnalysis = true
        isAnalyzing = true
        defer { isAnalyzing = false }
        do {
            let response: AIListingVisionResponse = try await api.request(
                AIEndpoints.draftListingVision(
                    AIDraftListingVisionRequest(images: Array(images))
                )
            )
            apply(visionResponse: response)
        } catch {
            errorMessage = "Couldn't generate suggestions from your photos. Fill in the details below."
        }
    }

    /// Project the AI draft into the form, filling only fields the user
    /// hasn't already touched.
    private func apply(visionResponse response: AIListingVisionResponse) {
        let draft = response.draft
        if form.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           let title = draft.title, !title.isEmpty {
            form.title = String(title.prefix(ListingComposeFormState.titleMaxLength))
        }
        if form.bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           let description = draft.description, !description.isEmpty {
            form.bodyText = description
        }
        if form.category == nil {
            setCategory(Self.wizardCategory(fromDraft: draft))
        }
        if let aiCategory = Self.backendCategory(fromAICategory: draft.category) {
            form.backendCategory = aiCategory
        }
        if form.condition == nil,
           form.category?.requiresCondition != false,
           let raw = draft.condition,
           let condition = ListingComposeCondition(rawValue: raw) {
            form.condition = condition
        }
        if let suggestion = response.priceSuggestion {
            form.priceSuggestion = ListingComposePriceSuggestion(
                low: suggestion.low,
                median: suggestion.median,
                high: suggestion.high,
                basis: suggestion.basis,
                comparableCount: suggestion.comparableCount
            )
        }
        if form.priceKind == nil {
            form.priceKind = (draft.isFree == true || form.category == .free) ? .free : .fixed
        }
        if form.priceAmount.isEmpty, form.priceKind != .free {
            if let median = response.priceSuggestion?.median {
                form.priceAmount = Self.formatAmount(median)
            } else if let price = draft.price, price > 0 {
                form.priceAmount = Self.formatAmount(price)
            }
        }
        if let delivery = draft.deliveryAvailable {
            form.deliveryEnabled = delivery
        }
        aiDraftApplied = true
    }

    /// AI draft (`listingType` + `isFree`) → the wizard's five-chip
    /// category model.
    static func wizardCategory(fromDraft draft: AIListingDraftDTO) -> ListingComposeCategory {
        if draft.isFree == true { return .free }
        switch draft.listingType {
        case "free_item": return .free
        case "wanted_request": return .wanted
        case "rent_sublet", "vehicle_rent": return .rentals
        case "vehicle_sale": return .vehicles
        default: break
        }
        if draft.category == "automotive" { return .vehicles }
        return .goods
    }

    /// AI draft category enum (`backend/services/ai/schemas.js:217`) →
    /// backend listing category enum
    /// (`backend/constants/marketplace.js:6`). The two lists drifted,
    /// so unknown values degrade to `other` instead of a Joi 400.
    static func backendCategory(fromAICategory raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        let renamed: [String: String] = [
            "sports": "sports_outdoors",
            "books": "books_media",
            "music": "books_media",
            "toys": "kids_baby",
            "baby_kids": "kids_baby",
            "automotive": "vehicles"
        ]
        if let mapped = renamed[raw] { return mapped }
        let backendCategories: Set<String> = [
            "furniture", "electronics", "clothing", "kids_baby", "tools",
            "home_garden", "sports_outdoors", "vehicles", "books_media",
            "collectibles", "appliances", "free_stuff",
            "food_baked_goods", "plants_garden", "pet_supplies",
            "arts_crafts", "tickets_events", "other"
        ]
        return backendCategories.contains(raw) ? raw : "other"
    }

    /// Whole-dollar amounts render without decimals; cents keep two.
    static func formatAmount(_ value: Double) -> String {
        if value.truncatingRemainder(dividingBy: 1) == 0 {
            return String(Int(value))
        }
        return String(format: "%.2f", value)
    }

    // MARK: - Other step mutations

    func setTitle(_ value: String) {
        form.title = value
    }

    func setCategory(_ category: ListingComposeCategory) {
        form.category = category
        // Category implies price kind for Free and clears stale condition
        // when switching to Wanted (which asks, not offers).
        if category == .free {
            form.priceKind = .free
            form.priceAmount = ""
        } else if form.priceKind == .free, category != .free {
            form.priceKind = nil
        }
        if !category.requiresCondition {
            form.condition = nil
        }
    }

    func setCondition(_ condition: ListingComposeCondition) {
        form.condition = condition
    }

    func setBody(_ value: String) {
        form.bodyText = value
    }

    func setPriceKind(_ kind: ListingComposePriceKind) {
        form.priceKind = kind
        if kind == .free { form.priceAmount = "" }
    }

    func setPriceAmount(_ value: String) {
        // Allow only digits and one decimal separator. View-side state
        // would otherwise let a user type "12.3.4".
        let filtered = value.filter { $0.isNumber || $0 == "." }
        let parts = filtered.split(separator: ".", omittingEmptySubsequences: false)
        if parts.count <= 2 {
            form.priceAmount = filtered
        }
        // The snap review edits the amount directly without a price-kind
        // picker — typing a price implies a fixed asking price.
        if form.priceKind == nil, !form.priceAmount.isEmpty {
            form.priceKind = .fixed
        }
    }

    func setFulfillment(_ value: ListingComposeFulfillment) {
        form.fulfillment = value
    }

    func setDeliveryEnabled(_ value: Bool) {
        form.deliveryEnabled = value
    }

    func setLocationKind(_ kind: ListingComposeLocationKind) {
        form.locationKind = kind
    }

    func setLocationLabel(_ value: String) {
        form.locationLabel = value
    }

    // MARK: - State transitions

    private func advance() async {
        switch currentStep {
        case .photos:
            transition(to: .titleCategory)
            if isSnapReviewStep {
                await analyzePhotosIfNeeded()
            }
        case .titleCategory:
            if isSnapReviewStep {
                await submit()
            } else {
                transition(to: .conditionDescription)
            }
        case .conditionDescription:
            transition(to: .price)
        case .price:
            transition(to: .location)
        case .location:
            transition(to: .review)
        case .review:
            await submit()
        case .success:
            if let listingId = createdListingId {
                pendingEvent = isEditMode
                    ? .listingUpdated(listingId: listingId)
                    : .openListingDetail(listingId: listingId)
            }
        }
    }

    private func goBack() {
        guard let previous = ListingComposeStep(rawValue: form.step - 1) else { return }
        transition(to: previous)
    }

    private func transition(to step: ListingComposeStep) {
        form.step = step.rawValue
        errorMessage = nil
        if let stepNumber = step.stepNumber {
            Analytics.track(
                .screenListingComposeWizardStepViewed(
                    stepNumber: stepNumber,
                    stepName: String(describing: step)
                )
            )
        }
    }

    // MARK: - Submit

    private func submit() async {
        guard let category = form.category, let priceKind = form.priceKind else { return }
        Analytics.track(.ctaListingComposeSubmit)
        if !isOnlineProvider() {
            errorMessage = "You're offline. Try again when you're back online."
            return
        }
        isSubmitting = true
        defer { isSubmitting = false }

        let isFree = priceKind == .free || category == .free
        let listingType = category.listingType
        let condition = form.condition?.rawValue
        let price: Double? = isFree ? nil : parsedPrice
        // `mediaUrls` must be real URIs (`backend/routes/listings.js`
        // validates `Joi.string().uri()`). Locally captured photos
        // upload as multipart after the listing row exists.
        let mediaUrls = form.photos.filter(\.isRemote).map(\.token)
        let backendCategory = form.backendCategory ?? category.fallbackBackendCategory
        let locationName: String? = form.locationLabel.isEmpty ? nil : form.locationLabel
        let deliveryAvailable = form.deliveryEnabled || form.fulfillment == .delivery

        switch mode {
        case .create:
            let request = CreateListingRequest(
                title: trimmedTitle,
                description: trimmedDescription,
                price: price,
                isFree: isFree,
                category: backendCategory,
                condition: condition,
                mediaUrls: mediaUrls,
                layer: category.layer,
                listingType: listingType,
                latitude: nil,
                longitude: nil,
                locationName: locationName,
                locationAddress: nil,
                meetupPreference: form.fulfillment.meetupPreference,
                deliveryAvailable: deliveryAvailable,
                isWanted: category.isWanted
            )
            do {
                let response: CreateListingResponse = try await api.request(
                    ListingsEndpoints.create(request)
                )
                createdListingId = response.listing.id
                let photosUploaded = await uploadLocalPhotos(listingId: response.listing.id)
                transition(to: .success)
                if !photosUploaded {
                    errorMessage = "Your listing is live, but some photos didn't upload. Edit the listing to add them."
                }
            } catch {
                errorMessage = (error as? APIError)?.errorDescription
                    ?? "Couldn't list your item. Please try again."
            }
        case let .edit(listingId, _):
            let request = UpdateListingRequest(
                title: trimmedTitle,
                description: trimmedDescription,
                price: price,
                isFree: isFree,
                category: backendCategory,
                condition: condition,
                mediaUrls: mediaUrls,
                layer: category.layer,
                listingType: listingType,
                locationName: locationName,
                meetupPreference: form.fulfillment.meetupPreference,
                deliveryAvailable: deliveryAvailable,
                isWanted: category.isWanted
            )
            do {
                let response: UpdateListingResponse = try await api.request(
                    ListingsEndpoints.update(id: listingId, body: request)
                )
                createdListingId = response.listing.id
                let photosUploaded = await uploadLocalPhotos(listingId: listingId)
                transition(to: .success)
                if !photosUploaded {
                    errorMessage = "Changes saved, but some new photos didn't upload. Edit the listing to retry."
                }
            } catch {
                errorMessage = (error as? APIError)?.errorDescription
                    ?? "Couldn't save your changes. Please try again."
            }
        }
    }

    /// Push locally captured photos to
    /// `POST /api/upload/listing-media/:listingId`. Best-effort —
    /// returns false on failure so the caller can surface a
    /// non-blocking notice (the listing row already exists).
    private func uploadLocalPhotos(listingId: String) async -> Bool {
        let files = form.photos.enumerated().compactMap { index, photo -> MultipartFile? in
            guard let data = photo.localImageData else { return nil }
            return MultipartFile(
                fieldName: "files",
                filename: "listing-\(index + 1).jpg",
                mimeType: "image/jpeg",
                data: data
            )
        }
        guard !files.isEmpty else { return true }
        do {
            _ = try await uploader.uploadListingMedia(listingId: listingId, files: files)
            return true
        } catch {
            return false
        }
    }
}
