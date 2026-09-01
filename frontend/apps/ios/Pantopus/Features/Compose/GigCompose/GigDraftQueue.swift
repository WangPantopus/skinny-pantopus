//
//  GigDraftQueue.swift
//  Pantopus
//
//  Phase 6c — offline draft queue for the Post-a-Task composer. When a
//  magic-post submit fails on connectivity (NetworkMonitor offline or a
//  URLError network-class failure), the wizard persists its full
//  `GigComposeFormState` here; the Gigs feed surfaces a "draft waiting"
//  banner and replays the post through the same magic-post path via
//  `GigMagicPostBuilder`. JSON-in-UserDefaults, capped at 5 drafts.
//

import Foundation
import Observation

/// One queued, unposted composer form.
public struct GigPendingDraft: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let savedAt: Date
    public let form: GigComposeFormState

    public init(id: String = UUID().uuidString, savedAt: Date = Date(), form: GigComposeFormState) {
        self.id = id
        self.savedAt = savedAt
        self.form = form
    }
}

/// Injection seam shared by the composer (enqueue) and the feed (retry /
/// discard). Tests drive a `GigDraftQueue` over an ephemeral suite.
@MainActor
public protocol GigDraftQueueing: AnyObject {
    var drafts: [GigPendingDraft] { get }
    /// Append a form snapshot (oldest drafts are dropped past the cap).
    /// `replacing` removes a previously-enqueued draft first so repeated
    /// offline submits of the same wizard never duplicate. Returns the
    /// new draft's id.
    @discardableResult
    func enqueue(_ form: GigComposeFormState, replacing replacedId: String?) -> String
    func remove(id: String)
}

/// UserDefaults-backed queue. `@Observable` so the feed banner re-renders
/// when drafts are added / posted / discarded.
@Observable
@MainActor
public final class GigDraftQueue: GigDraftQueueing {
    public static let shared = GigDraftQueue()

    /// Hard cap — enqueueing past it drops the oldest draft.
    public static let maxDrafts = 5
    private static let storageKey = "gigPendingDraftsV1"

    public private(set) var drafts: [GigPendingDraft]

    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: Self.storageKey),
           let stored = try? Self.decoder.decode([GigPendingDraft].self, from: data) {
            drafts = stored
        } else {
            drafts = []
        }
    }

    @discardableResult
    public func enqueue(_ form: GigComposeFormState, replacing replacedId: String? = nil) -> String {
        if let replacedId {
            drafts.removeAll { $0.id == replacedId }
        }
        let draft = GigPendingDraft(form: form)
        drafts.append(draft)
        if drafts.count > Self.maxDrafts {
            drafts.removeFirst(drafts.count - Self.maxDrafts)
        }
        persist()
        return draft.id
    }

    public func remove(id: String) {
        drafts.removeAll { $0.id == id }
        persist()
    }

    private func persist() {
        guard let data = try? Self.encoder.encode(drafts) else { return }
        defaults.set(data, forKey: Self.storageKey)
    }

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}

// MARK: - Magic-post body builder

/// Builds a `POST /api/gigs/magic-post` body from a bare form snapshot.
/// Shared by the live wizard (`GigComposeViewModel.buildMagicPostBody`)
/// and the feed's draft-queue retry, which has no view model — only the
/// persisted `GigComposeFormState`.
@MainActor
enum GigMagicPostBuilder {
    /// Returns nil when a required field is missing (mirrors the wizard's
    /// per-step validation gates).
    static func body(
        from form: GigComposeFormState,
        coordinate: UserCoordinate?,
        fallbackScheduleType: String? = nil,
        privacyLevel: String = "exact_after_accept",
        aiConfidence: Double? = nil,
        aiDraft: MagicDraftDTO? = nil
    ) -> MagicPostBody? {
        let title = form.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let description = form.description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard title.count >= GigComposeLimits.titleMin,
              title.count <= GigComposeLimits.titleMax,
              description.count >= GigComposeLimits.descriptionMin
        else { return nil }
        guard let budgetType = form.budgetType else { return nil }
        let budgetMin = Double(form.budgetMin) ?? 0
        switch budgetType {
        case .fixed, .hourly:
            guard budgetMin > 0 else { return nil }
        case .offers:
            break
        }
        // One-time needs its date; aPlace needs a complete address.
        if form.scheduleType == .oneTime, form.scheduledStartISO == nil { return nil }
        if form.locationMode == .aPlace, !form.placeAddress.isComplete { return nil }
        let group = moduleGroup(for: form)
        // Pro-service: a deposit toggle with no amount is incomplete.
        if group == .proService, form.proServiceDetails?.isDepositAmountMissing == true { return nil }

        let wireSchedule = form.scheduleType?.wireValue ?? "flexible"
        let location = form.locationMode.flatMap { composedLocation(for: $0, form: form, coordinate: coordinate) }
        let isVirtual = form.locationMode == .virtual
        let items = form.items.filter { !($0.name ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        // Flat module columns only ride when their module is the active
        // one — mirrors RN's `showDelivery` / `showProServices` gates
        // (`gig-v2/new.tsx:325-343`).
        let delivery = group == .delivery ? form.deliveryDetails : nil
        let pro = group == .proService ? form.proServiceDetails : nil
        let draft = MagicPostDraft(
            title: title,
            description: description,
            category: form.category?.backendLabel,
            tags: form.tags.isEmpty ? nil : form.tags,
            payType: budgetType.wireValue,
            budgetFixed: budgetType == .fixed ? budgetMin : nil,
            hourlyRate: budgetType == .hourly ? budgetMin : nil,
            estimatedHours: Double(form.estimatedHours),
            scheduleType: wireSchedule,
            timeWindowStart: form.scheduleType == .oneTime ? form.scheduledStartISO : nil,
            // E.1's optional deadline rides as the window's end.
            timeWindowEnd: form.deadlineISO,
            locationMode: draftLocationMode(for: form),
            privacyLevel: privacyLevel,
            isUrgent: form.isUrgent,
            attachments: form.photoIds.isEmpty ? nil : Array(form.photoIds.prefix(10)),
            items: items.isEmpty ? nil : Array(items.prefix(20)),
            cancellationPolicy: form.cancellationPolicy?.wireValue,
            taskArchetype: form.taskArchetype,
            careDetails: group == .care ? form.careDetails : nil,
            logisticsDetails: group == .logistics ? form.logisticsDetails : nil,
            remoteDetails: group == .remote ? form.remoteDetails : nil,
            urgentDetails: form.isUrgent ? form.urgentDetails : nil,
            eventDetails: group == .event ? form.eventDetails : nil,
            pickupAddress: trimmedOrNil(delivery?.pickupAddress),
            pickupNotes: trimmedOrNil(delivery?.pickupNotes),
            dropoffAddress: trimmedOrNil(delivery?.dropoffAddress),
            dropoffNotes: trimmedOrNil(delivery?.dropoffNotes),
            deliveryProofRequired: delivery.map { $0.proofRequired ?? false },
            requiresLicense: pro.map { $0.requiresLicense ?? false },
            licenseType: trimmedOrNil(pro?.licenseType),
            requiresInsurance: pro.map { $0.requiresInsurance ?? false },
            scopeDescription: trimmedOrNil(pro?.scopeDescription),
            depositRequired: pro.map { $0.depositRequired ?? false },
            depositAmount: pro.flatMap { $0.depositRequired == true ? Double($0.depositAmount ?? "") : nil }
        )
        // magic-post requires `text` (min 3 chars) — manual/classic posts
        // may have an empty describe field, so fall back to the title.
        let describe = form.describeText.trimmingCharacters(in: .whitespacesAndNewlines)
        return MagicPostBody(
            text: describe.count >= 3 ? describe : title,
            draft: draft,
            location: location,
            // P6c — persona switching: nil posts as yourself, a business
            // user id posts on the business's behalf.
            beneficiaryUserId: form.beneficiaryUserId,
            sourceFlow: form.composeMode == .magic ? "magic" : "classic",
            engagementMode: engagementMode(for: form, fallbackScheduleType: fallbackScheduleType).rawValue,
            taskFormat: isVirtual ? "remote" : nil,
            aiConfidence: form.composeMode == .magic ? aiConfidence : nil,
            aiDraftJson: form.composeMode == .magic ? aiDraft : nil
        )
    }

    /// The engagement mode the post carries — user override first,
    /// archetype/schedule/urgency inference otherwise.
    static func engagementMode(
        for form: GigComposeFormState,
        fallbackScheduleType: String? = nil
    ) -> GigEngagementMode {
        if let override = form.engagementOverride { return override }
        return GigComposeViewModel.inferEngagementMode(
            archetype: form.taskArchetype,
            scheduleType: form.scheduleType?.wireValue ?? fallbackScheduleType,
            isUrgent: form.isUrgent
        )
    }

    /// Which archetype module field group applies — parsed archetype
    /// first, category default on the manual path.
    static func moduleGroup(for form: GigComposeFormState) -> GigModuleGroup? {
        switch form.taskArchetype {
        case "care_task": return .care
        case "home_service", "quick_help", "recurring_service": return .logistics
        case "remote_task": return .remote
        case "event_shift": return .event
        case "delivery_errand": return .delivery
        case "pro_service_quote": return .proService
        case "general": return nil
        default:
            break
        }
        switch form.category {
        case .petcare, .childcare: return .care
        case .handyman, .cleaning, .moving, .tutoring, .tech: return .logistics
        case .delivery: return .delivery
        case .other, nil: return nil
        }
    }

    /// Whitespace-trimmed, or nil when the field is blank — RN sends
    /// `value || null` for every optional module string.
    private static func trimmedOrNil(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }

    /// `draft.location_mode` wire value (home | current | address |
    /// map_pin). Virtual tasks keep `home` and signal remoteness via
    /// `task_format`.
    private static func draftLocationMode(for form: GigComposeFormState) -> String {
        switch form.locationMode {
        case .aPlace: "address"
        case .yourAddress, .virtual, nil: "home"
        }
    }

    private static func composedLocation(
        for mode: GigComposeLocationMode,
        form: GigComposeFormState,
        coordinate: UserCoordinate?
    ) -> CreateGigLocation? {
        let lat = coordinate?.latitude ?? 0
        let lon = coordinate?.longitude ?? 0
        switch mode {
        case .yourAddress:
            return CreateGigLocation(
                mode: mode.wireMode,
                latitude: lat,
                longitude: lon,
                address: "Your saved address",
                city: nil,
                state: nil,
                zip: nil,
                homeId: nil
            )
        case .aPlace:
            let addr = form.placeAddress
            guard addr.isComplete else { return nil }
            return CreateGigLocation(
                mode: mode.wireMode,
                latitude: lat,
                longitude: lon,
                address: addr.line1.trimmingCharacters(in: .whitespacesAndNewlines),
                city: addr.city.trimmingCharacters(in: .whitespacesAndNewlines),
                state: addr.state.trimmingCharacters(in: .whitespacesAndNewlines),
                zip: addr.zip.trimmingCharacters(in: .whitespacesAndNewlines),
                homeId: nil
            )
        case .virtual:
            return CreateGigLocation(
                mode: mode.wireMode,
                latitude: lat,
                longitude: lon,
                address: "Remote / Online",
                city: nil,
                state: nil,
                zip: nil,
                homeId: nil
            )
        }
    }
}
