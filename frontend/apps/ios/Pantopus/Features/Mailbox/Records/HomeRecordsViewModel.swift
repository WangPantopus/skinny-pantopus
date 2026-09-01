//
//  HomeRecordsViewModel.swift
//  Pantopus
//
//  Home Records — the linked-asset hub behind the Mailbox. Room filter
//  chips over the asset index, a per-asset mail drill-down, and the
//  "Auto-detect assets" scan that mines recent mail for appliance /
//  warranty mentions, then offers each suggestion for linking.
//
//  Backed by `backend/routes/mailboxV2Phase3.js` (mounted at
//  `/api/mailbox/v2/p3` — `backend/app.js:317`):
//    · GET    /records/assets            (line 182)
//    · GET    /records/asset/:id/mail    (line 238)
//    · POST   /records/auto-detect       (line 338)
//    · GET    /records/suggestions       (line 380)
//    · POST   /records/link              (line 296)
//    · DELETE /records/unlink/:id        (line 323)
//
//  Mirrors `ui/screens/mailbox/home_records/HomeRecordsViewModel.kt`.
//

// swiftlint:disable file_length

import Foundation
import Observation
import SwiftUI

// MARK: - Presentation models

/// Asset category → glyph. Backend column values are
/// `appliance / structure / system / vehicle / other`
/// (`HomeAsset.category`, defaulted at
/// `backend/routes/mailboxV2Phase3.js:217`).
public enum RecordAssetCategory: String, Hashable, Sendable {
    case appliance
    case structure
    case system
    case vehicle
    case other

    public static func fromRaw(_ raw: String?) -> RecordAssetCategory {
        RecordAssetCategory(rawValue: raw ?? "") ?? .other
    }

    public var icon: PantopusIcon {
        switch self {
        case .appliance: .refrigerator
        case .structure: .home
        case .system: .wrench
        case .vehicle: .car
        case .other: .package
        }
    }
}

/// Server-computed warranty state (`warrantyStatus`,
/// `backend/routes/mailboxV2Phase3.js:167`).
public enum RecordWarrantyStatus: String, Hashable, Sendable {
    case active
    case expiringSoon = "expiring_soon"
    case expired
    case none

    public static func fromRaw(_ raw: String?) -> RecordWarrantyStatus {
        // Fully qualified: a bare `.none` here would be ambiguous with
        // `Optional.none`.
        RecordWarrantyStatus(rawValue: raw ?? "") ?? RecordWarrantyStatus.none
    }

    public var label: String {
        switch self {
        case .active: "Active"
        case .expiringSoon: "Expiring soon"
        case .expired: "Expired"
        case .none: "None"
        }
    }

    public var tint: Color {
        switch self {
        case .active: Theme.Color.success
        case .expiringSoon: Theme.Color.warning
        case .expired: Theme.Color.error
        case .none: Theme.Color.appTextMuted
        }
    }

    public var background: Color {
        switch self {
        case .active: Theme.Color.successBg
        case .expiringSoon: Theme.Color.warningBg
        case .expired: Theme.Color.errorBg
        case .none: Theme.Color.appSurfaceSunken
        }
    }
}

/// One row in the asset index.
public struct HomeRecordAsset: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let category: RecordAssetCategory
    public let room: String?
    public let manufacturer: String?
    public let modelNumber: String?
    public let purchasedLabel: String?
    public let warranty: RecordWarrantyStatus
    public let linkedMailCount: Int
}

/// A mail item linked to an asset.
public struct HomeRecordMailRow: Identifiable, Hashable, Sendable {
    public let id: String
    public let subject: String
    public let senderName: String?
    public let deliveredLabel: String?
}

/// One auto-detect hit / link suggestion.
public struct HomeRecordSuggestion: Identifiable, Hashable, Sendable {
    /// Source mail id — the natural key and the `mailId` sent to
    /// `POST /records/link`.
    public let id: String
    public let candidateName: String
    public let candidateBrand: String?
    /// 0…100, rounded from the backend's 0…1 `confidence`.
    public let confidencePercent: Int
}

/// The most recent `POST /records/link` result, kept so the screen can
/// offer an Undo. `GET /records/asset/:id/mail` does **not** return the
/// `MailAssetLink` primary key, so the link response is the only place
/// the id needed by `DELETE /records/unlink/:id` is exposed.
public struct HomeRecordUndoableLink: Hashable, Sendable {
    public let linkId: String
    public let assetName: String
}

// MARK: - States

public enum HomeRecordsState: Sendable, Equatable {
    case loading
    case loaded(assets: [HomeRecordAsset], rooms: [String])
    case empty
    case error(message: String)
}

public enum HomeRecordAssetDetailState: Sendable, Equatable {
    case loading
    case loaded(mail: [HomeRecordMailRow], photoCount: Int)
    case error(message: String)
}

// MARK: - View model

@Observable
@MainActor
public final class HomeRecordsViewModel {
    public private(set) var state: HomeRecordsState = .loading
    /// Selected room chip; nil is "All".
    public private(set) var roomFilter: String?

    /// Auto-detect scan.
    public private(set) var isScanning = false
    public private(set) var detections: [HomeRecordSuggestion] = []

    /// Suggestions sheet (`GET /records/suggestions`).
    public var showsSuggestions = false
    public private(set) var isLoadingSuggestions = false
    public private(set) var suggestions: [HomeRecordSuggestion] = []
    /// Mail id awaiting an asset choice in the "link to…" dialog.
    public var pendingLinkMailId: String?
    public private(set) var undoableLink: HomeRecordUndoableLink?

    /// Asset drill-down (in-screen, matching RN `records.tsx:109`).
    public private(set) var selectedAsset: HomeRecordAsset?
    public private(set) var detailState: HomeRecordAssetDetailState = .loading

    public var toast: String?

    private let api: APIClient
    private let onBack: @MainActor () -> Void
    private let onOpenMail: (String) -> Void
    /// Resolved from `GET /api/homes/my-homes`; required by the
    /// auto-detect validator (`backend/routes/mailboxV2Phase3.js:26`).
    private var homeId: String?

    public convenience init(
        onBack: @escaping @MainActor () -> Void = {},
        onOpenMail: @escaping (String) -> Void = { _ in }
    ) {
        self.init(api: .shared, onBack: onBack, onOpenMail: onOpenMail)
    }

    /// Designated initializer — `api` is injectable for tests. Not
    /// `public`: `APIClient` is internal.
    init(
        api: APIClient,
        onBack: @escaping @MainActor () -> Void = {},
        onOpenMail: @escaping (String) -> Void = { _ in }
    ) {
        self.api = api
        self.onBack = onBack
        self.onOpenMail = onOpenMail
    }

    // MARK: - Navigation

    public func tapBack() {
        if selectedAsset != nil {
            selectedAsset = nil
        } else {
            onBack()
        }
    }

    public func openMail(_ mailId: String) {
        onOpenMail(mailId)
    }

    public func consumeToast() {
        toast = nil
    }

    // MARK: - Index

    public func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetchAssets()
    }

    public func refresh() async {
        await fetchAssets()
    }

    public func selectRoom(_ room: String?) {
        roomFilter = room
    }

    /// Assets after the room chip filter (RN `records.tsx:94`).
    public var filteredAssets: [HomeRecordAsset] {
        guard case let .loaded(assets, _) = state else { return [] }
        guard let roomFilter else { return assets }
        return assets.filter { $0.room == roomFilter }
    }

    /// Every loaded asset, ignoring the room chip — the link picker must
    /// offer all of them, not just the filtered slice.
    public var allAssets: [HomeRecordAsset] {
        guard case let .loaded(assets, _) = state else { return [] }
        return assets
    }

    public var rooms: [String] {
        guard case let .loaded(_, rooms) = state else { return [] }
        return rooms
    }

    private func fetchAssets() async {
        await resolveHomeIdIfNeeded()
        do {
            let response: HomeAssetsResponse = try await api.request(
                MailboxRecordsEndpoints.assets(homeId: homeId)
            )
            let assets = response.assets.map(Self.project)
            let rooms = (response.rooms ?? []).sorted()
            if let roomFilter, !rooms.contains(roomFilter) {
                self.roomFilter = nil
            }
            state = assets.isEmpty ? .empty : .loaded(assets: assets, rooms: rooms)
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "We couldn't load your home records."
            )
        }
    }

    private func resolveHomeIdIfNeeded() async {
        guard homeId == nil else { return }
        do {
            let response: MyHomesResponse = try await api.request(HomesEndpoints.myHomes())
            homeId = response.homes.first?.home.id
        } catch {
            // Non-fatal: `GET /records/assets` falls back to every
            // accessible home when `homeId` is omitted. Only the
            // auto-detect scan strictly needs it.
            homeId = nil
        }
    }

    // MARK: - Asset drill-down

    public func openAsset(_ asset: HomeRecordAsset) {
        selectedAsset = asset
        detailState = .loading
        Task { @MainActor in await fetchAssetDetail(assetId: asset.id) }
    }

    public func closeAsset() {
        selectedAsset = nil
    }

    public func retryAssetDetail() async {
        guard let assetId = selectedAsset?.id else { return }
        detailState = .loading
        await fetchAssetDetail(assetId: assetId)
    }

    private func fetchAssetDetail(assetId: String) async {
        do {
            let response: AssetMailResponse = try await api.request(
                MailboxRecordsEndpoints.assetMail(assetId: assetId)
            )
            detailState = .loaded(
                mail: (response.mail ?? []).map(Self.projectMail),
                photoCount: response.photos?.count ?? 0
            )
        } catch {
            detailState = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "We couldn't load this asset."
            )
        }
    }

    // MARK: - Auto-detect scan

    /// RN `records.tsx:60` — scans recent mail for appliance / warranty
    /// mentions. Requires a home id (the validator rejects the call
    /// without one), so a user with no home gets told rather than a 400.
    public func runAutoDetect() async {
        guard !isScanning else { return }
        await resolveHomeIdIfNeeded()
        guard let homeId else {
            toast = "Add a home before scanning for assets."
            return
        }
        isScanning = true
        defer { isScanning = false }
        do {
            let response: AutoDetectAssetsResponse = try await api.request(
                MailboxRecordsEndpoints.autoDetect(homeId: homeId)
            )
            detections = (response.detections ?? []).map(Self.projectDetection)
            if (response.count ?? detections.count) == 0 {
                toast = "No new asset mentions found in recent mail."
            }
        } catch {
            toast = "Auto-detect failed."
        }
    }

    // MARK: - Suggestions → link

    public func openSuggestions() async {
        showsSuggestions = true
        isLoadingSuggestions = true
        defer { isLoadingSuggestions = false }
        await resolveHomeIdIfNeeded()
        do {
            let response: AssetSuggestionsResponse = try await api.request(
                MailboxRecordsEndpoints.suggestions(homeId: homeId)
            )
            suggestions = (response.suggestions ?? []).map { suggestion in
                let detection = suggestion.detections?.first
                return HomeRecordSuggestion(
                    id: suggestion.mail.id,
                    candidateName: Self.nonEmpty(detection?.candidateName)
                        ?? Self.nonEmpty(suggestion.mail.subject)
                        ?? "Unknown item",
                    candidateBrand: Self.nonEmpty(detection?.candidateBrand)
                        ?? Self.nonEmpty(suggestion.mail.senderName),
                    confidencePercent: Int(((detection?.confidence ?? 0) * 100).rounded())
                )
            }
        } catch {
            suggestions = []
            toast = "Couldn't load link suggestions."
        }
    }

    public func dismissSuggestions() {
        showsSuggestions = false
    }

    /// Stage the asset picker for a suggestion. The suggestions sheet is
    /// dismissed first — a confirmation dialog owned by the screen can't
    /// present on top of a sheet.
    public func requestLink(mailId: String) {
        showsSuggestions = false
        pendingLinkMailId = mailId
    }

    public func cancelLink() {
        pendingLinkMailId = nil
    }

    /// `POST /records/link`. `auto_detected` is the honest link type for
    /// a scan-sourced suggestion (validator at
    /// `backend/routes/mailboxV2Phase3.js:20`).
    public func linkPendingMail(to asset: HomeRecordAsset) async {
        guard let mailId = pendingLinkMailId else { return }
        pendingLinkMailId = nil
        do {
            let response: LinkMailToAssetResponse = try await api.request(
                MailboxRecordsEndpoints.link(
                    mailId: mailId,
                    assetId: asset.id,
                    linkType: "auto_detected"
                )
            )
            suggestions.removeAll { $0.id == mailId }
            detections.removeAll { $0.id == mailId }
            if let linkId = response.link?.id {
                undoableLink = HomeRecordUndoableLink(linkId: linkId, assetName: asset.name)
            }
            toast = "Linked to \(asset.name)."
            await fetchAssets()
            if selectedAsset?.id == asset.id {
                await fetchAssetDetail(assetId: asset.id)
            }
        } catch {
            toast = "Couldn't link that mail."
        }
    }

    /// `DELETE /records/unlink/:id` — undoes the link just created.
    public func undoLastLink() async {
        guard let undoableLink else { return }
        self.undoableLink = nil
        do {
            let response: UnlinkMailFromAssetResponse = try await api.request(
                MailboxRecordsEndpoints.unlink(linkId: undoableLink.linkId)
            )
            toast = response.message ?? "Unlinked"
            await fetchAssets()
            if let assetId = selectedAsset?.id {
                await fetchAssetDetail(assetId: assetId)
            }
        } catch {
            toast = "Couldn't undo that link."
        }
    }

    public func dismissUndo() {
        undoableLink = nil
    }

    // MARK: - Projection

    static func project(_ dto: HomeAssetSummaryDTO) -> HomeRecordAsset {
        HomeRecordAsset(
            id: dto.id,
            name: nonEmpty(dto.name) ?? "Untitled asset",
            category: RecordAssetCategory.fromRaw(dto.category),
            room: nonEmpty(dto.room),
            manufacturer: nonEmpty(dto.manufacturer),
            modelNumber: nonEmpty(dto.modelNumber),
            purchasedLabel: mediumDate(dto.purchasedAt),
            warranty: RecordWarrantyStatus.fromRaw(dto.warrantyStatus),
            linkedMailCount: dto.linkedMailCount ?? 0
        )
    }

    static func projectMail(_ dto: AssetLinkedMailDTO) -> HomeRecordMailRow {
        HomeRecordMailRow(
            id: dto.id,
            subject: nonEmpty(dto.subject) ?? "Mail item",
            senderName: nonEmpty(dto.senderName),
            deliveredLabel: shortDate(dto.deliveredAt)
        )
    }

    static func projectDetection(_ dto: AssetDetectionDTO) -> HomeRecordSuggestion {
        HomeRecordSuggestion(
            id: dto.sourceMailId,
            candidateName: nonEmpty(dto.candidateName) ?? "Unknown item",
            candidateBrand: nonEmpty(dto.candidateBrand),
            confidencePercent: Int(((dto.confidence ?? 0) * 100).rounded())
        )
    }

    static func nonEmpty(_ value: String?) -> String? {
        guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return value
    }

    private static func parse(_ iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    static func mediumDate(_ iso: String?) -> String? {
        guard let date = parse(iso) else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, yyyy"
        return formatter.string(from: date)
    }

    static func shortDate(_ iso: String?) -> String? {
        guard let date = parse(iso) else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}
