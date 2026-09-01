//
//  ManageTrainViewModel.swift
//  Pantopus
//
//  A13.13 — Manage train. Organizer-side surface for an active support
//  train. `load()` fetches `GET /api/support-trains/:id`
//  (`SupportTrainsEndpoints.detail`) and derives the stat strip from its
//  slots. `Send update` posts to `POST /:id/updates`; `Close & thank`
//  marks the train completed via `POST /:id/complete` (sending the
//  optional thank-you note as a final broadcast first). Both mutate local
//  state optimistically so the toast / chip flip stay instant.
//
//  PROJECTION GAPS (degrade gracefully): `/:id` exposes per-slot
//  filled/capacity counts but not a helper roster, dropout count, or
//  audience segmentation, and `/:id/updates` broadcasts to everyone — so
//  the helper count is proxied from covered slots, dropout shows 0, and
//  the audience picker + push-to-phones toggle stay client-only. The
//  backend has no single "close with thanks" route; see the P1-E notes.
//

import Foundation

// MARK: - Content models

/// One audience chip in the Send-an-update form (`All helpers 12` etc).
public struct AudienceChipContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let count: String

    public init(id: String, label: String, count: String) {
        self.id = id
        self.label = label
        self.count = count
    }
}

/// Visual tone for an Organize-section row's leading icon tile.
public enum OrganizeRowTone: Sendable, Hashable {
    case amber
    case sky
    case green
    case red
}

/// One row in the Organize section card (or the Close-train destructive row).
public struct OrganizeRowContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let tone: OrganizeRowTone
    public let label: String
    public let meta: String?
    public let sub: String?
    public let isDestructive: Bool

    public init(
        id: String,
        icon: PantopusIcon,
        tone: OrganizeRowTone,
        label: String,
        meta: String?,
        sub: String?,
        isDestructive: Bool
    ) {
        self.id = id
        self.icon = icon
        self.tone = tone
        self.label = label
        self.meta = meta
        self.sub = sub
        self.isDestructive = isDestructive
    }
}

/// The CloseTrainSheet's static copy. Editable thank-you note lives on the VM.
public struct CloseTrainSheetContent: Sendable, Hashable {
    public let daysEarlyLabel: String
    public let mealsDelivered: String
    public let neighborsHelped: String
    public let coverageDays: String
    public let recipientQuote: String

    public init(
        daysEarlyLabel: String,
        mealsDelivered: String,
        neighborsHelped: String,
        coverageDays: String,
        recipientQuote: String
    ) {
        self.daysEarlyLabel = daysEarlyLabel
        self.mealsDelivered = mealsDelivered
        self.neighborsHelped = neighborsHelped
        self.coverageDays = coverageDays
        self.recipientQuote = recipientQuote
    }
}

/// Static, design-driven content for one Manage Train screen instance.
public struct ManageTrainContent: Sendable, Hashable {
    public let trainId: String
    public let title: String
    public let dateRangeLabel: String
    public let isActive: Bool

    // 4-cell StatCellRow values + tones (tones are derived in the view).
    public let slotFillValue: String
    public let helpersValue: String
    public let daysLeftValue: String
    public let dropoutValue: String

    // SlotPreview mini-fill strip — paints 21 dots in 3 buckets.
    public let slotsFilled: Int
    public let slotsOpen: Int
    public let slotsDropout: Int
    public let slotsTotal: Int
    public let slotFillCaption: String

    // Send-an-update form
    public let draftMessage: String
    public let audienceChips: [AudienceChipContent]
    public let selectedAudienceId: String
    public let pushToPhones: Bool

    // Organize + wind-down rows
    public let organizeRows: [OrganizeRowContent]
    public let closeRow: OrganizeRowContent

    /// Close-train sheet
    public let close: CloseTrainSheetContent

    /// Lifecycle status straight off the payload — `draft` / `published`
    /// / `active` / `paused` / `completed` / `archived`. Drives which
    /// lifecycle rows are legal (the backend 409s on the rest).
    public let status: String
    /// Organizer tier. `primary` unlocks unpublish / archive / delete /
    /// co-organizer edits / fund disable
    /// (`backend/middleware/supportTrainPermissions.js:51`).
    public let viewerRole: SupportTrainViewerRole

    public init(
        trainId: String,
        title: String,
        dateRangeLabel: String,
        isActive: Bool,
        slotFillValue: String,
        helpersValue: String,
        daysLeftValue: String,
        dropoutValue: String,
        slotsFilled: Int,
        slotsOpen: Int,
        slotsDropout: Int,
        slotsTotal: Int,
        slotFillCaption: String,
        draftMessage: String,
        audienceChips: [AudienceChipContent],
        selectedAudienceId: String,
        pushToPhones: Bool,
        organizeRows: [OrganizeRowContent],
        closeRow: OrganizeRowContent,
        close: CloseTrainSheetContent,
        status: String = "active",
        viewerRole: SupportTrainViewerRole = .primaryOrganizer
    ) {
        self.trainId = trainId
        self.title = title
        self.dateRangeLabel = dateRangeLabel
        self.isActive = isActive
        self.slotFillValue = slotFillValue
        self.helpersValue = helpersValue
        self.daysLeftValue = daysLeftValue
        self.dropoutValue = dropoutValue
        self.slotsFilled = slotsFilled
        self.slotsOpen = slotsOpen
        self.slotsDropout = slotsDropout
        self.slotsTotal = slotsTotal
        self.slotFillCaption = slotFillCaption
        self.draftMessage = draftMessage
        self.audienceChips = audienceChips
        self.selectedAudienceId = selectedAudienceId
        self.pushToPhones = pushToPhones
        self.organizeRows = organizeRows
        self.closeRow = closeRow
        self.close = close
        self.status = status
        self.viewerRole = viewerRole
    }
}

/// Aggregate UI state.
public enum ManageTrainState: Sendable, Equatable {
    case loading
    case loaded(ManageTrainContent)
    case error(message: String)
}

/// Drives the Close-train confirmation sheet.
public enum ManageTrainSheetMode: Sendable, Hashable {
    case hidden
    case closing
    case closed
}

/// Character cap for the update-message textarea. Mirrors the
/// "168/500" counter in the design source.
public let manageTrainMessageMaxChars: Int = 500

@Observable
@MainActor
public final class ManageTrainViewModel {
    public private(set) var state: ManageTrainState = .loading

    /// Editable draft fields. Initialised from `content.draftMessage` /
    /// `selectedAudienceId` / `pushToPhones` on `load()`.
    public var draftMessage: String = ""
    public var selectedAudienceId: String = ""
    public var pushToPhones: Bool = true

    /// Editable thank-you note typed inside the close sheet.
    public var thankYouNote: String = ""

    /// Close-train sheet presentation state.
    public var sheetMode: ManageTrainSheetMode = .hidden

    /// Transient toast (e.g. "Update sent · 12 helpers").
    public var toast: String?

    // MARK: - S1 organizer surfaces

    /// Helper roster from `GET /:id/reservations` — drives share-address /
    /// confirm-delivery / remove-from-slot.
    public private(set) var helperRows: [ManageHelperRow] = []
    /// Slot roster from the detail payload — drives add / edit / remove date.
    public private(set) var slotRows: [ManageSlotRow] = []
    /// Co-organizer roster from `GET /:id/organizers`.
    public private(set) var organizerRows: [ManageOrganizerRow] = []
    /// Gift-fund summary from `GET /:id/fund`.
    public private(set) var fund: SupportTrainFundDTO?
    /// True while any organizer mutation is in flight.
    public private(set) var isSubmitting = false
    /// AI-drafted open-slots nudge, editable before sending.
    public var nudgeDraft: String?
    /// Text field backing the "add co-organizer" row (a user id).
    public var newOrganizerUserId: String = ""
    /// Inline failure copy for the last organizer action.
    public var actionError: String?
    /// Presented slot editor (add or edit), or nil.
    public var slotEditor: ManageSlotEditorState?
    /// Pending destructive confirm, or nil.
    public var pendingConfirm: ManageDestructiveConfirm?
    /// Set once the train has been deleted so the host can pop the screen.
    public private(set) var didDeleteTrain = false

    private let trainId: String
    let api: APIClient
    /// Explicit offline content (previews / tests). When set `load()`
    /// renders it directly instead of hitting the network.
    private let seed: ManageTrainContent?

    /// Public entry point — carries no `APIClient` (the client and `.shared`
    /// are module-internal).
    public convenience init(trainId: String, content: ManageTrainContent? = nil) {
        self.init(trainId: trainId, api: .shared, content: content)
    }

    /// Designated init — module-internal because `APIClient` is. Tests
    /// inject a stubbed client here.
    init(trainId: String, api: APIClient, content: ManageTrainContent? = nil) {
        self.trainId = trainId
        self.api = api
        seed = content
    }

    public func load() async {
        if let seed {
            apply(seed)
            return
        }
        if case .loaded = state {} else { state = .loading }
        do {
            let dto: SupportTrainDetailDTO = try await api.request(
                SupportTrainsEndpoints.detail(supportTrainId: trainId)
            )
            apply(Self.project(dto))
            slotRows = Self.slotRows(dto.slots ?? [])
            await loadOrganizerSurfaces()
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load this support train."
            state = .error(message: message)
        }
    }

    /// Test / preview seam for the S1 organizer surfaces.
    func replaceOrganizerSurfaces(
        helpers: [ManageHelperRow]? = nil,
        slots: [ManageSlotRow]? = nil,
        organizers: [ManageOrganizerRow]? = nil,
        fund: SupportTrainFundDTO? = nil
    ) {
        if let helpers { helperRows = helpers }
        if let slots { slotRows = slots }
        if let organizers { organizerRows = organizers }
        if let fund { self.fund = fund }
    }

    func setSubmitting(_ value: Bool) {
        isSubmitting = value
    }

    func markDeleted() {
        didDeleteTrain = true
    }

    /// `id` accessor for the action extension (which lives in a separate
    /// file and can't see the private stored property).
    var supportTrainId: String {
        trainId
    }

    public func refresh() async {
        await load()
    }

    /// Push a loaded content payload into state + the editable draft fields.
    private func apply(_ content: ManageTrainContent) {
        state = .loaded(content)
        draftMessage = content.draftMessage
        selectedAudienceId = content.selectedAudienceId
        pushToPhones = content.pushToPhones
        thankYouNote = ""
        sheetMode = .hidden
    }

    // MARK: - Send-update form

    public var characterCount: Int {
        draftMessage.count
    }

    public var characterCounterLabel: String {
        "\(characterCount) / \(manageTrainMessageMaxChars)"
    }

    /// True when the draft message has at least one non-whitespace
    /// character and is under the cap. Mirrors the design's
    /// `Send update` enable rule (textarea non-empty + valid).
    public var canSendUpdate: Bool {
        let trimmed = draftMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && characterCount <= manageTrainMessageMaxChars
    }

    public func updateDraftMessage(_ value: String) {
        // Hard-clip to the cap so the counter never displays over-limit.
        if value.count > manageTrainMessageMaxChars {
            draftMessage = String(value.prefix(manageTrainMessageMaxChars))
        } else {
            draftMessage = value
        }
    }

    public func selectAudience(_ id: String) {
        guard case let .loaded(content) = state,
              content.audienceChips.contains(where: { $0.id == id }) else { return }
        selectedAudienceId = id
    }

    public func togglePush(_ value: Bool) {
        pushToPhones = value
    }

    /// Send the typed update via `POST /api/support-trains/:id/updates`.
    /// Optimistically clears the draft + flashes the toast; the audience
    /// filter + push-to-phones toggle have no backend field (the endpoint
    /// broadcasts to everyone) so they stay client-only.
    public func sendUpdate() async {
        guard canSendUpdate, case let .loaded(content) = state else { return }
        let body = draftMessage
        let helperCount = content.audienceChips.first { $0.id == selectedAudienceId }?.count ?? content.helpersValue
        draftMessage = ""
        toast = "Update sent · \(helperCount) helpers"
        do {
            _ = try await api.request(
                SupportTrainsEndpoints.postUpdate(
                    supportTrainId: trainId,
                    body: SupportTrainUpdateBody(body: body)
                ),
                as: EmptyResponse.self
            )
        } catch {
            // Best-effort broadcast — the optimistic toast stays put.
        }
    }

    public func acknowledgeToast() {
        toast = nil
    }

    // MARK: - Close-train sheet

    public func showCloseSheet() {
        sheetMode = .closing
    }

    public func hideCloseSheet() {
        sheetMode = .hidden
    }

    public func updateThankYouNote(_ value: String) {
        thankYouNote = value
    }

    /// Close & thank. Optimistically flips the train to `.closed`, then
    /// sends the thank-you note as a final broadcast (`POST /:id/updates`)
    /// when one was typed and marks the train completed
    /// (`POST /:id/complete`). The backend has no single "close with
    /// thanks" route, so this composes the two calls.
    public func confirmClose() async {
        guard case let .loaded(content) = state else { return }
        let note = thankYouNote.trimmingCharacters(in: .whitespacesAndNewlines)
        let next = ManageTrainContent(
            trainId: content.trainId,
            title: content.title,
            dateRangeLabel: content.dateRangeLabel,
            isActive: false,
            slotFillValue: content.slotFillValue,
            helpersValue: content.helpersValue,
            daysLeftValue: content.daysLeftValue,
            dropoutValue: content.dropoutValue,
            slotsFilled: content.slotsFilled,
            slotsOpen: content.slotsOpen,
            slotsDropout: content.slotsDropout,
            slotsTotal: content.slotsTotal,
            slotFillCaption: content.slotFillCaption,
            draftMessage: content.draftMessage,
            audienceChips: content.audienceChips,
            selectedAudienceId: content.selectedAudienceId,
            pushToPhones: content.pushToPhones,
            organizeRows: content.organizeRows,
            closeRow: content.closeRow,
            close: content.close
        )
        state = .loaded(next)
        sheetMode = .closed
        toast = "Train closed · thanks sent to \(content.helpersValue) helpers"
        do {
            if !note.isEmpty {
                _ = try await api.request(
                    SupportTrainsEndpoints.postUpdate(
                        supportTrainId: trainId,
                        body: SupportTrainUpdateBody(body: note)
                    ),
                    as: EmptyResponse.self
                )
            }
            _ = try await api.request(
                SupportTrainsEndpoints.complete(supportTrainId: trainId),
                as: EmptyResponse.self
            )
        } catch {
            // Optimistic close already reflected; surfacing failures is a follow-up.
        }
    }
}
