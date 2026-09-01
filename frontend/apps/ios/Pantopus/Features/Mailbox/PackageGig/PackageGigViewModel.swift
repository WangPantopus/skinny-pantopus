//
//  PackageGigViewModel.swift
//  Pantopus
//
//  A17.8 → "Ask a Neighbor". Backs the package-gig form reached from the
//  package detail overflow and from the mail-task create frame. Ports RN
//  `src/app/mailbox/gig.tsx` (:41 create, :63 success frame):
//
//  · `POST /api/mailbox/v2/p2/package/:mailId/gig`
//    (`backend/routes/mailboxV2Phase2.js:1280`, mounted at
//    `/api/mailbox/v2/p2` — `backend/app.js:316`)
//
//  The route takes `{ gigType, title?, description?, suggestedStart?,
//  compensation? }` and answers `{ message, gigId, title, preDelivery }`.
//  The screen has no read — RN posts straight from the form and the
//  backend pre-fills the gig from the `MailPackage` row — so there is no
//  load/empty/error fetch cycle here, only the submit path.
//
//  Mirrors `PackageGigViewModel.kt` on Android.
//

import Foundation
import Observation

/// Blocking alert (mirrors RN's `Alert.alert` failure paths).
public struct PackageGigAlert: Sendable, Hashable, Identifiable {
    public let title: String
    public let message: String
    public var id: String {
        title + message
    }

    public init(title: String, message: String) {
        self.title = title
        self.message = message
    }
}

/// The gig the backend just created — drives the success frame.
public struct PackageGigCreated: Sendable, Hashable {
    public let gigId: String
    public let title: String
    public let isPreDelivery: Bool
}

@Observable
@MainActor
public final class PackageGigViewModel {
    /// `.form` until the POST lands, then `.created`.
    public private(set) var created: PackageGigCreated?

    public var selectedType: PackageGigType?
    public var draftTitle = ""
    public var draftDescription = ""
    /// Free text so the field can be empty; parsed with `Double(_:)` on
    /// submit exactly like RN's `parseFloat`.
    public var draftCompensation = ""
    public private(set) var isCreating = false
    public var alert: PackageGigAlert?

    /// The originating mail item — the gig is pre-filled from its package row.
    public let mailId: String
    /// `true` while the package is still in transit. RN passes this as
    /// `?mode=pre|post`; the backend re-derives it from the package status
    /// and echoes the truth back as `preDelivery`.
    public let isPreDelivery: Bool

    private let client: APIClient
    private let onBack: @MainActor () -> Void
    private let onOpenGig: @MainActor (String) -> Void

    init(
        mailId: String,
        isPreDelivery: Bool,
        client: APIClient = .shared,
        onBack: @escaping @MainActor () -> Void = {},
        onOpenGig: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        self.mailId = mailId
        self.isPreDelivery = isPreDelivery
        self.client = client
        self.onBack = onBack
        self.onOpenGig = onOpenGig
    }

    // MARK: - Derived

    public var options: [PackageGigOption] {
        PackageGigOption.options(isPreDelivery: isPreDelivery)
    }

    public var eyebrow: String {
        isPreDelivery ? "PRE-DELIVERY GIG" : "POST-DELIVERY GIG"
    }

    public var contextSubcopy: String {
        isPreDelivery
            ? "Carrier info and ETA attached to gig automatically"
            : "Delivery photo, tracking, and item details included"
    }

    public var canSubmit: Bool {
        selectedType != nil && !isCreating
    }

    // MARK: - Intents

    public func select(_ type: PackageGigType) {
        selectedType = type
    }

    public func tapBack() {
        onBack()
    }

    /// Success frame → "View Task Listing" opens the gig the backend made.
    public func openCreatedGig() {
        guard let created else { return }
        onOpenGig(created.gigId)
    }

    /// Success frame → "Back to Package" walks back to the surface that
    /// pushed this screen (RN `router.replace('/mailbox/package?id=…')`).
    public func backToPackage() {
        onBack()
    }

    // MARK: - Submit

    /// `POST /p2/package/:mailId/gig`. RN blocks on an unselected type with
    /// its own alert before it ever calls the API (`gig.tsx:42-45`).
    public func create() async {
        guard let selectedType else {
            alert = PackageGigAlert(
                title: "Select a type",
                message: "Please choose what kind of help you need"
            )
            return
        }
        guard !isCreating else { return }
        isCreating = true
        defer { isCreating = false }

        let title = draftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let description = draftDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let compensationText = draftCompensation.trimmingCharacters(in: .whitespacesAndNewlines)

        let request = PackageGigRequest(
            gigType: selectedType.rawValue,
            title: title.isEmpty ? nil : title,
            description: description.isEmpty ? nil : description,
            compensation: compensationText.isEmpty ? nil : Double(compensationText)
        )
        let result = await client.perform(
            MailboxPackageEndpoints.createPackageGig(mailId: mailId, request: request),
            as: PackageGigResponse.self
        )
        switch result {
        case let .success(response):
            guard let gigId = response.gigId, !gigId.isEmpty else {
                // The route always returns an id; a body without one means
                // we have nothing to deep-link into, so surface the failure
                // rather than faking a success frame.
                alert = PackageGigAlert(title: "Error", message: "Could not create gig request")
                return
            }
            created = PackageGigCreated(
                gigId: gigId,
                title: response.title ?? fallbackTitle(for: selectedType),
                isPreDelivery: response.preDelivery ?? isPreDelivery
            )
        case .failure:
            alert = PackageGigAlert(title: "Error", message: "Could not create gig request")
        }
    }

    /// Mirrors the backend's own default title (`mailboxV2Phase2.js:1295`)
    /// for the (impossible in practice) case where the response omits it.
    private func fallbackTitle(for type: PackageGigType) -> String {
        guard isPreDelivery else { return "Help with my package" }
        switch type {
        case .hold: return "Hold my package"
        case .inside: return "Bring inside my package"
        case .sign: return "Sign for my package"
        case .assembly, .custom: return "Help with my package"
        }
    }
}
