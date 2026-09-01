//
//  UnboxingViewModel.swift
//  Pantopus
//
//  A17.14 — Backs the Unboxing capture flow for a delivered package.
//  Everything on this screen now round-trips to
//  `backend/routes/mailboxV2Phase2.js` (mounted at `/api/mailbox/v2/p2`):
//
//    load()            → `GET  /api/mailbox/v2/package/:mailId`  (:634 of
//                        mailboxV2.js) — the real `MailPackage` row drives
//                        the item name, carrier, saved-doc flags, and which
//                        phase the screen opens in.
//    capture(photo:)   → `POST /api/files/upload` (files.js:781) for the
//                        condition photo, then
//                        `POST /p2/package/:mailId/unboxing` (:1217) with
//                        the returned S3 URL.
//    confirm()         → `POST /p2/package/:mailId/save-warranty` (:1246)
//                        `{ type: "warranty" }` — files to Home › Warranties.
//    saveManual()      → the same route with `{ type: "manual" }`.
//    postAssemblyGig() → `POST /p2/package/:mailId/gig` (:1280)
//                        `{ gigType: "assembly" }`.
//
//  There is no OCR / classification route, so the facts list is projected
//  from the package row itself (carrier, tracking, status, saved docs) —
//  never invented. An explicit `phase:`/`content:` seed keeps the
//  view-model local for previews, tests, and snapshots.
//
//  Mirrors `UnboxingViewModel` on Android.
//

import Foundation
import Observation

@Observable
@MainActor
public final class UnboxingViewModel {
    public private(set) var state: UnboxingScreenState
    public private(set) var phase: UnboxingPhase
    /// True while a photo upload / write is in flight — the shelf disables.
    public private(set) var isBusy = false
    /// Transient banner; the view clears it after display.
    public var toast: String?

    private var content: UnboxingContent
    /// The originating package mail. Nil → the screen was opened without
    /// one and cannot persist anything (see `.unavailable`).
    public let mailId: String?
    /// Non-nil marker for the preview / test seam: skips every network leg.
    private let isSeeded: Bool
    private let client: APIClient
    private let uploader: MultipartUploader
    private let onScanNext: @MainActor () -> Void
    private let onOpenDrawer: @MainActor () -> Void

    /// Preview / test / snapshot seam — projects a fixture and never
    /// touches the network. Production uses `init(mailId:)`.
    public init(
        phase: UnboxingPhase = .capture,
        content: UnboxingContent = UnboxingSampleData.content,
        onScanNext: @escaping @MainActor () -> Void = {},
        onOpenDrawer: @escaping @MainActor () -> Void = {}
    ) {
        mailId = nil
        isSeeded = true
        self.content = content
        self.phase = phase
        client = .shared
        uploader = .shared
        self.onScanNext = onScanNext
        self.onOpenDrawer = onOpenDrawer
        state = Self.project(phase: phase, content: content)
    }

    /// Live initializer. Internal because `APIClient` is module-internal
    /// (see `MembersListViewModel.swift:204` for the same constraint).
    init(
        mailId: String?,
        client: APIClient = .shared,
        uploader: MultipartUploader = .shared,
        onScanNext: @escaping @MainActor () -> Void = {},
        onOpenDrawer: @escaping @MainActor () -> Void = {}
    ) {
        self.mailId = mailId
        isSeeded = false
        content = UnboxingContent.placeholder
        phase = .capture
        self.client = client
        self.uploader = uploader
        self.onScanNext = onScanNext
        self.onOpenDrawer = onOpenDrawer
        state = mailId == nil ? .unavailable : .loading
    }

    private static func project(phase: UnboxingPhase, content: UnboxingContent) -> UnboxingScreenState {
        switch phase {
        case .capture: .capture(content)
        case .filed: .filed(content)
        }
    }

    private func restate() {
        state = Self.project(phase: phase, content: content)
    }

    // MARK: - Lifecycle

    public func load() async {
        if isSeeded {
            restate()
            return
        }
        guard mailId != nil else {
            state = .unavailable
            return
        }
        await fetch()
    }

    public func retry() async {
        await load()
    }

    private func fetch() async {
        guard let mailId else { return }
        state = .loading
        let result = await client.perform(
            MailboxV2Endpoints.package(mailId: mailId),
            as: UnboxingPackageResponse.self
        )
        switch result {
        case let .success(response):
            content = UnboxingContent.live(package: response.package, sender: response.sender?.display)
            phase = response.package.warrantySaved == true ? .filed : .capture
            restate()
        case .failure:
            state = .error(message: "We couldn't load this package. Check your connection and try again.")
        }
    }

    // MARK: - Capture

    /// Record a condition photo: upload the JPEG the user just took (or
    /// picked), then attach the resulting URL to the package with
    /// `POST /p2/package/:mailId/unboxing`.
    public func capture(photo data: Data) async {
        guard !isSeeded else {
            appendSeededShot()
            return
        }
        guard let mailId, !data.isEmpty, !isBusy else { return }
        isBusy = true
        defer { isBusy = false }
        do {
            let upload = try await uploader.uploadFile(
                MultipartFile(
                    fieldName: "file",
                    filename: "unboxing-\(UUID().uuidString.prefix(8)).jpg",
                    mimeType: "image/jpeg",
                    data: data
                ),
                formFields: ["file_type": "mailbox_unboxing", "visibility": "private"]
            )
            let result = await client.perform(
                MailboxPackageEndpoints.recordUnboxing(
                    mailId: mailId,
                    request: PackageUnboxingRequest(conditionPhotoUrl: upload.file.url)
                ),
                as: PackageUnboxingResponse.self
            )
            guard case .success = result else {
                toast = "Couldn't attach the photo — try again"
                return
            }
            content = content.withShots(content.shots + [
                UnboxingShot(
                    id: upload.file.id,
                    tag: "CONDITION",
                    label: "Condition photo",
                    isMain: content.shots.isEmpty
                )
            ])
            restate()
            toast = "Condition photo saved to this package"
        } catch {
            toast = "Couldn't upload the photo — try again"
        }
    }

    /// Preview/test shutter: appends the next labeled fixture shot so the
    /// filmstrip still grows without a camera or the network.
    private func appendSeededShot() {
        let sequence = UnboxingSampleData.captureSequence
        guard !sequence.isEmpty else { return }
        let template = sequence[content.shots.count % sequence.count]
        content = content.withShots(content.shots + [
            UnboxingShot(
                id: "\(template.id)-\(content.shots.count)",
                tag: template.tag,
                label: template.label,
                isMain: false
            )
        ])
        restate()
    }

    /// Kept for the existing preview/test seam (`viewModel.capture()`),
    /// which has no image to hand in.
    public func capture() {
        appendSeededShot()
    }

    // MARK: - Filing

    /// "Confirm — file to Home". Persists the warranty document to the
    /// caller's Home › Warranties vault folder and advances to `.filed`.
    public func confirm() async {
        guard phase == .capture else { return }
        guard !isSeeded else {
            phase = .filed
            restate()
            return
        }
        guard let mailId, !isBusy else { return }
        isBusy = true
        defer { isBusy = false }
        let result = await client.perform(
            MailboxPackageEndpoints.saveWarranty(mailId: mailId, type: "warranty"),
            as: PackageSaveWarrantyResponse.self
        )
        switch result {
        case .success:
            phase = .filed
            content = content.withFiled()
            restate()
            toast = "Filed to Home \u{203A} Warranties"
        case .failure:
            toast = "Couldn't file this — try again"
        }
    }

    /// "Save manual" — the second quick-save RN offers
    /// (`unboxing.tsx:34`), same route with `type: "manual"`.
    public func saveManual() async {
        guard !isSeeded else {
            toast = "Manual saved"
            return
        }
        guard let mailId, !isBusy else { return }
        isBusy = true
        defer { isBusy = false }
        let result = await client.perform(
            MailboxPackageEndpoints.saveWarranty(mailId: mailId, type: "manual"),
            as: PackageSaveWarrantyResponse.self
        )
        switch result {
        case .success:
            toast = "Manual saved to Home \u{203A} Warranties"
        case .failure:
            toast = "Couldn't save the manual — try again"
        }
    }

    /// Filed-banner "Undo" chip. There is no un-file route on the backend
    /// (`mailboxV2Phase2.js` only ever sets `warranty_saved` to true), so
    /// this returns the screen to the capture frame — it does not claim to
    /// have removed the vault entry.
    public func undo() {
        guard phase == .filed else { return }
        phase = .capture
        restate()
        if !isSeeded {
            toast = "Back to capture \u{00B7} the saved document stays in your vault"
        }
    }

    /// "Scan the next item" — re-arms the capture frame and hands off.
    public func scanNext() {
        if isSeeded {
            content = content.withShots(UnboxingSampleData.captureSequence)
        }
        phase = .capture
        restate()
        onScanNext()
    }

    /// "View in Home drawer" — hands off to the host.
    public func openDrawer() {
        onOpenDrawer()
    }

    // MARK: - Assembly gig

    /// "Need help assembling?" — posts the package help gig
    /// (`gigType: "assembly"`), mirroring RN `unboxing.tsx:44-56`.
    public func postAssemblyGig() async {
        guard !isSeeded else {
            toast = "Task created"
            return
        }
        guard let mailId, !isBusy else { return }
        isBusy = true
        defer { isBusy = false }
        let result = await client.perform(
            MailboxPackageEndpoints.createPackageGig(
                mailId: mailId,
                request: PackageGigRequest(gigType: "assembly")
            ),
            as: PackageGigResponse.self
        )
        switch result {
        case let .success(response):
            toast = response.title ?? "Task created"
        case .failure:
            toast = "Could not create gig"
        }
    }

    // MARK: - Derived

    public var shots: [UnboxingShot] {
        content.shots
    }
}
