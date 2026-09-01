//
//  UnboxingContent.swift
//  Pantopus
//
//  A17.14 — Unboxing scan-capture flow data shapes. A scan-first surface:
//  you point the camera at a just-delivered item (and its papers),
//  Pantopus reads + classifies it, suggests a drawer, and you Confirm or
//  re-route. Two render phases project off one `UnboxingContent`:
//
//    `.capture` — live viewfinder + captured filmstrip + AI drawer
//      suggestion + extracted facts (editable) + Confirm.
//    `.filed`   — "Filed to Home › Warranties" banner + collapsed photo
//      summary + extracted facts (locked) + "Scan the next item".
//
//  Real OCR / classification / vault upload are out of scope (B2.4) — the
//  view-model projects deterministic `UnboxingSampleData`. The
//  `CameraScanner` + `OcrFactsList` primitives (B1.2) render the
//  viewfinder, filmstrip, and facts grid; this screen owns the data.
//

// swiftlint:disable function_body_length

import SwiftUI

// MARK: - Phase / state

/// Which frame the screen is showing. `.capture` is the live classified
/// frame; `.filed` is the confirmed summary. Both project off the same
/// `UnboxingContent`.
public enum UnboxingPhase: String, Sendable, Hashable {
    case capture
    case filed
}

/// State machine for the Unboxing screen. `.capture` and `.filed` carry
/// the same `UnboxingContent`; only the rendering differs (live capture
/// chrome vs filed summary chrome). `.loading` / `.error` cover the
/// package fetch, and `.unavailable` is the honest frame for the case
/// where the screen was opened without an originating package — nothing
/// can be persisted, so nothing is faked.
public enum UnboxingScreenState: Sendable {
    case loading
    case capture(UnboxingContent)
    case filed(UnboxingContent)
    case error(message: String)
    case unavailable
}

// MARK: - Drawer suggestion

/// The identity-pillar tint behind a drawer chip. Maps to the existing
/// identity-pillar tokens so the suggested / re-route drawers read with
/// their canonical Me / Home / Biz colors.
public enum UnboxingDrawerTint: String, Sendable, Hashable {
    case home
    case personal
    case business

    public var swatch: Color {
        switch self {
        case .home: Theme.Color.home
        case .personal: Theme.Color.personal
        case .business: Theme.Color.business
        }
    }

    public var swatchBg: Color {
        switch self {
        case .home: Theme.Color.homeBg
        case .personal: Theme.Color.personalBg
        case .business: Theme.Color.businessBg
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .home: .home
        case .personal: .user
        case .business: .briefcase
        }
    }
}

/// A candidate filing destination: a drawer (`Home`) and a folder
/// (`Warranties & Receipts`). The suggested drawer carries a `confidence`
/// percent; re-route alternatives leave it `nil`.
public struct UnboxingDrawer: Sendable, Hashable, Identifiable {
    public let id: String
    public let drawer: String
    public let folder: String
    public let tint: UnboxingDrawerTint
    /// `96` for the suggested drawer; `nil` for the re-route alternatives.
    public let confidence: Int?

    public init(id: String, drawer: String, folder: String, tint: UnboxingDrawerTint, confidence: Int? = nil) {
        self.id = id
        self.drawer = drawer
        self.folder = folder
        self.tint = tint
        self.confidence = confidence
    }
}

// MARK: - Captured shot

/// One captured thumbnail in the filmstrip. The design renders these as
/// dark striped placeholders (never a hand-drawn object), so the stub
/// carries no image — `CameraScanner`'s `CameraScannerShot` placeholder
/// renders the diagonal stripe fill, which is also what snapshots use.
public struct UnboxingShot: Sendable, Hashable, Identifiable {
    public let id: String
    /// Mono corner tag — `UNIT` / `BOX` / `RECEIPT` / `LABEL`.
    public let tag: String
    /// Caption under the thumbnail — "The machine" / "Box + barcode" / …
    public let label: String
    /// The hero shot — gets the accent border + star badge.
    public let isMain: Bool

    public init(id: String, tag: String, label: String, isMain: Bool = false) {
        self.id = id
        self.tag = tag
        self.label = label
        self.isMain = isMain
    }
}

// MARK: - Content payload

/// Single content payload both phases project off. Not `Hashable` — it
/// carries `AIElfStripContent` (which holds an optional redo closure); the
/// route (`.unboxing(mailId:)`) only carries the originating mail id, so
/// the payload never needs to be hashed for navigation.
public struct UnboxingContent: Sendable {
    public let category: String
    public let timeLabel: String
    public let productTitle: String
    public let productSubtitle: String
    public let shots: [UnboxingShot]
    public let suggestion: UnboxingDrawer
    public let alternates: [UnboxingDrawer]
    public let facts: [OcrFact]
    /// Filed-banner title — "Home › Warranties".
    public let filedTo: String
    /// Filed-banner subtitle — "Confirmed by you · Just now".
    public let filedSubtitle: String
    /// Photo-summary count line — "4 photos saved".
    public let photosSavedLabel: String
    public let classifyElf: AIElfStripContent
    public let filedElf: AIElfStripContent

    public init(
        category: String,
        timeLabel: String,
        productTitle: String,
        productSubtitle: String,
        shots: [UnboxingShot],
        suggestion: UnboxingDrawer,
        alternates: [UnboxingDrawer],
        facts: [OcrFact],
        filedTo: String,
        filedSubtitle: String,
        photosSavedLabel: String,
        classifyElf: AIElfStripContent,
        filedElf: AIElfStripContent
    ) {
        self.category = category
        self.timeLabel = timeLabel
        self.productTitle = productTitle
        self.productSubtitle = productSubtitle
        self.shots = shots
        self.suggestion = suggestion
        self.alternates = alternates
        self.facts = facts
        self.filedTo = filedTo
        self.filedSubtitle = filedSubtitle
        self.photosSavedLabel = photosSavedLabel
        self.classifyElf = classifyElf
        self.filedElf = filedElf
    }

    /// Copy with a replaced shot list — used by the view-model when the
    /// shutter appends a captured frame.
    public func withShots(_ shots: [UnboxingShot]) -> UnboxingContent {
        UnboxingContent(
            category: category,
            timeLabel: timeLabel,
            productTitle: productTitle,
            productSubtitle: productSubtitle,
            shots: shots,
            suggestion: suggestion,
            alternates: alternates,
            facts: facts,
            filedTo: filedTo,
            filedSubtitle: filedSubtitle,
            photosSavedLabel: Self.photosLabel(count: shots.count),
            classifyElf: classifyElf,
            filedElf: filedElf
        )
    }

    /// Copy stamped as just-filed — used after `POST
    /// /p2/package/:mailId/save-warranty` succeeds.
    public func withFiled() -> UnboxingContent {
        UnboxingContent(
            category: category,
            timeLabel: timeLabel,
            productTitle: productTitle,
            productSubtitle: productSubtitle,
            shots: shots,
            suggestion: suggestion,
            alternates: alternates,
            facts: facts,
            filedTo: filedTo,
            filedSubtitle: "Confirmed by you \u{00B7} Just now",
            photosSavedLabel: photosSavedLabel,
            classifyElf: classifyElf,
            filedElf: filedElf
        )
    }

    static func photosLabel(count: Int) -> String {
        count == 1 ? "1 photo saved" : "\(count) photos saved"
    }
}

// MARK: - Live projection

public extension UnboxingContent {
    /// Neutral shell shown while `GET /api/mailbox/v2/package/:mailId` is
    /// in flight. Never rendered as loaded content — the screen shows its
    /// skeleton for `.loading`.
    static let placeholder = UnboxingContent(
        category: "Unboxing",
        timeLabel: "",
        productTitle: "",
        productSubtitle: "",
        shots: [],
        suggestion: UnboxingDrawer(
            id: "ub-drawer-home",
            drawer: "Home",
            folder: "Warranties & Receipts",
            tint: .home
        ),
        alternates: [],
        facts: [],
        filedTo: "Home \u{203A} Warranties",
        filedSubtitle: "",
        photosSavedLabel: "",
        classifyElf: AIElfStripContent(headline: "", summary: "", bullets: []),
        filedElf: AIElfStripContent(headline: "", summary: "", bullets: [])
    )

    /// Project the real `MailPackage` row into the screen's content.
    ///
    /// There is no OCR / classification route on the backend, so every
    /// value here comes off the package row itself — item name, carrier,
    /// masked tracking, delivery note, and the `warranty_saved` /
    /// `manual_saved` flags. The drawer suggestion is not a classifier
    /// output: `POST /p2/package/:mailId/save-warranty`
    /// (`backend/routes/mailboxV2Phase2.js:1260`) files to the caller's
    /// Home › Warranties folder unconditionally, so that is stated as a
    /// destination, with no confidence score and no re-route alternatives
    /// (no route exists to honour them).
    static func live(package: UnboxingPackageDTO, sender: String?) -> UnboxingContent {
        var shots: [UnboxingShot] = []
        if let delivery = package.deliveryPhotoUrl, !delivery.isEmpty {
            shots.append(UnboxingShot(id: "delivery", tag: "DELIVERY", label: "Delivery photo", isMain: true))
        }
        if let condition = package.conditionPhotoUrl, !condition.isEmpty {
            shots.append(
                UnboxingShot(id: "condition", tag: "CONDITION", label: "Condition photo", isMain: shots.isEmpty)
            )
        }

        var facts: [OcrFact] = []
        if let item = package.inferredItemName, !item.isEmpty {
            facts.append(OcrFact(id: "ub-fact-item", icon: .package, label: "Item", value: item))
        }
        if let carrier = package.carrier, !carrier.isEmpty {
            facts.append(OcrFact(id: "ub-fact-carrier", icon: .truck, label: "Carrier", value: carrier))
        }
        if let tracking = package.trackingIdMasked, !tracking.isEmpty {
            facts.append(
                OcrFact(id: "ub-fact-tracking", icon: .hash, label: "Tracking", value: tracking, isCode: true)
            )
        }
        if let note = package.deliveryLocationNote, !note.isEmpty {
            facts.append(OcrFact(id: "ub-fact-note", icon: .mapPin, label: "Left at", value: note))
        }
        if package.warrantySaved == true {
            facts.append(
                OcrFact(
                    id: "ub-fact-warranty",
                    icon: .shieldCheck,
                    label: "Warranty",
                    value: "Saved to Home \u{203A} Warranties",
                    tag: OcrFactTag(text: "Saved", tone: .success)
                )
            )
        }
        if package.manualSaved == true {
            facts.append(
                OcrFact(
                    id: "ub-fact-manual",
                    icon: .fileText,
                    label: "Manual",
                    value: "Saved to Home \u{203A} Warranties",
                    tag: OcrFactTag(text: "Saved", tone: .success)
                )
            )
        }

        let subtitleParts = [package.carrier, package.trackingIdMasked]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
        let title = [package.inferredItemName, sender]
            .compactMap { $0 }
            .first { !$0.isEmpty } ?? "Your package"

        return UnboxingContent(
            category: "Unboxing",
            timeLabel: statusLabel(package.status),
            productTitle: title,
            productSubtitle: subtitleParts.isEmpty
                ? "Delivered package"
                : subtitleParts.joined(separator: " \u{00B7} "),
            shots: shots,
            suggestion: UnboxingDrawer(
                id: "ub-drawer-home",
                drawer: "Home",
                folder: "Warranties & Receipts",
                tint: .home
            ),
            alternates: [],
            facts: facts,
            filedTo: "Home \u{203A} Warranties",
            filedSubtitle: package.warrantySaved == true ? "Confirmed by you" : "",
            photosSavedLabel: photosLabel(count: shots.count),
            classifyElf: AIElfStripContent(
                headline: "Ready to file this delivery",
                summary: "Confirm and Pantopus saves the warranty paperwork to your Home \u{203A} Warranties "
                    + "folder and marks this unboxing complete. Condition photos you take here attach to the "
                    + "package record.",
                bullets: [
                    AIElfBullet(id: "ub-elf-c1", icon: .folderLock, label: "Files to Home", text: "Warranties"),
                    AIElfBullet(
                        id: "ub-elf-c2",
                        icon: .camera,
                        label: "Condition photos",
                        text: photosLabel(count: shots.count)
                    ),
                    AIElfBullet(
                        id: "ub-elf-c3",
                        icon: .usersRound,
                        label: "Need a hand?",
                        text: "post an assembly task"
                    )
                ]
            ),
            filedElf: AIElfStripContent(
                headline: "Filed to your Home drawer",
                summary: "The paperwork for this delivery is in Home \u{203A} Warranties and the unboxing is "
                    + "marked complete on the package record.",
                bullets: [
                    AIElfBullet(
                        id: "ub-elf-f1",
                        icon: .folderLock,
                        label: "Home \u{203A} Warranties",
                        text: "document saved"
                    ),
                    AIElfBullet(
                        id: "ub-elf-f2",
                        icon: .archive,
                        label: photosLabel(count: shots.count),
                        text: "kept on the package"
                    )
                ]
            )
        )
    }

    private static func statusLabel(_ status: String?) -> String {
        switch status {
        case "delivered": "Delivered"
        case "out_for_delivery": "Out for delivery"
        case "in_transit": "In transit"
        case "exception": "Delivery exception"
        case "pre_receipt": "Expected"
        default: "Package"
        }
    }
}
