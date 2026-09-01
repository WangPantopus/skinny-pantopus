//
//  MaintenanceDraftStore.swift
//  Pantopus
//
//  P2.9 — Session-scoped store for the maintenance form's *extras* that
//  the current backend schema (`HomeMaintenanceLog`) doesn't yet
//  persist: photos, receipt, notes, performed-by category, and the
//  category enum the user picked in the form.
//
//  The list / detail screens read the matching draft (keyed by the
//  server-returned task id) so a freshly-logged maintenance entry shows
//  its photos + notes + receipt in the 2×2 grid the design specifies.
//  When the app is force-closed the drafts are dropped — that's
//  acceptable since these fields aren't part of the contract today and
//  the next refresh from the server will return the canonical row
//  without them.
//
//  When the backend grows columns for these fields, the consumers will
//  flip to reading them off `MaintenanceTaskDTO` directly and this
//  store can be deleted in one diff.
//

import Foundation
import Observation

/// One captured photo or receipt file, kept entirely in-memory.
public struct MaintenanceDraftFile: Sendable, Hashable, Identifiable {
    public let id: UUID
    public let filename: String
    public let mimeType: String
    public let data: Data

    public init(id: UUID = UUID(), filename: String, mimeType: String, data: Data) {
        self.id = id
        self.filename = filename
        self.mimeType = mimeType
        self.data = data
    }
}

/// How the user said this maintenance was performed. Persisted only in
/// the draft store — the server-side `vendor` string carries the
/// resolved name and the rest is local.
public enum MaintenancePerformedBy: String, Sendable, Hashable, CaseIterable {
    case `self`
    case member
    case contractor
}

/// One in-flight or recently-submitted maintenance draft. Keyed by
/// either a stable client UUID (pre-submit) or the server task id
/// (post-submit).
public struct MaintenanceDraft: Sendable, Hashable {
    public var category: MaintenanceCategory
    public var performedBy: MaintenancePerformedBy
    public var performerName: String
    public var performerContact: String
    public var notes: String
    public var photos: [MaintenanceDraftFile]
    public var receipt: MaintenanceDraftFile?

    public init(
        category: MaintenanceCategory = .generic,
        performedBy: MaintenancePerformedBy = .self,
        performerName: String = "",
        performerContact: String = "",
        notes: String = "",
        photos: [MaintenanceDraftFile] = [],
        receipt: MaintenanceDraftFile? = nil
    ) {
        self.category = category
        self.performedBy = performedBy
        self.performerName = performerName
        self.performerContact = performerContact
        self.notes = notes
        self.photos = photos
        self.receipt = receipt
    }
}

@Observable
@MainActor
public final class MaintenanceDraftStore {
    /// Singleton — wired into both `LogMaintenanceFormViewModel` and
    /// `MaintenanceDetailViewModel`. We could inject via DI but the
    /// store is sessionless + actor-local so the singleton is enough.
    public static let shared = MaintenanceDraftStore()

    private var drafts: [String: MaintenanceDraft] = [:]

    public init() {}

    public func draft(for id: String) -> MaintenanceDraft? {
        drafts[id]
    }

    public func upsert(_ draft: MaintenanceDraft, for id: String) {
        drafts[id] = draft
    }

    public func remove(id: String) {
        drafts.removeValue(forKey: id)
    }

    public func clear() {
        drafts.removeAll()
    }
}
