//
//  EditPersonaContent.swift
//  Pantopus
//
//  A13.12 — Edit Beacon. Editable form models for the creator-facing
//  Beacon (persona) editor. Everything here maps 1:1 onto the persona
//  write contract:
//
//    POST  /api/personas          (backend/routes/personas.js:271)
//    PATCH /api/personas/:id      (backend/routes/personas.js:850)
//    POST  /api/upload/persona-media/:id?type=avatar|banner
//                                 (backend/routes/upload.js:312)
//
//  Beacon accent is sky / `primary600`, flat — the design source renders a
//  fuchsia gradient hero, but there is no fuchsia token in the design
//  system and every shipped Beacon surface uses the sky primary.
//

import Foundation

/// Whether the editor is creating the user's first Beacon or editing the
/// one they already own. `create` drives the "Publish Beacon" CTA and the
/// `POST /api/personas` path; `edit` drives "Save Beacon" and `PATCH`.
public enum EditPersonaMode: Sendable, Hashable {
    case create
    case edit(personaId: String)

    public var personaId: String? {
        if case let .edit(personaId) = self { return personaId }
        return nil
    }

    public var isCreate: Bool {
        self == .create
    }
}

/// One `{ label, url }` row in `public_links`. Carries a stable local id
/// so SwiftUI's `ForEach` keeps focus while the user types.
public struct PersonaLinkDraft: Sendable, Hashable, Identifiable {
    public let id: String
    public var label: String
    public var url: String

    public init(id: String = UUID().uuidString, label: String = "", url: String = "") {
        self.id = id
        self.label = label
        self.url = url
    }

    public var isBlank: Bool {
        label.trimmingCharacters(in: .whitespaces).isEmpty
            && url.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// RN parity (`persona.tsx:456`): a row with only one half filled in
    /// blocks the save with "Each public link needs both a label and a URL."
    public var isIncomplete: Bool {
        let hasLabel = !label.trimmingCharacters(in: .whitespaces).isEmpty
        let hasURL = !url.trimmingCharacters(in: .whitespaces).isEmpty
        return hasLabel != hasURL
    }

    /// Normalised for the wire — bare hosts get an `https://` scheme, the
    /// same coercion RN applies in `normalizePublicLinksForSave`.
    public var wireValue: PersonaPublicLinkDTO? {
        guard !isBlank else { return nil }
        let label = label.trimmingCharacters(in: .whitespaces)
        let raw = url.trimmingCharacters(in: .whitespaces)
        let hasScheme = raw.range(of: "^[a-z][a-z0-9+.-]*://", options: [.regularExpression, .caseInsensitive]) != nil
        return PersonaPublicLinkDTO(label: label, url: hasScheme ? raw : "https://\(raw)")
    }
}

/// A selectable Beacon category. Sourced from
/// `GET /api/personas/compliance/categories`; `isEnabled == false` means
/// the category is modeled but gated behind credential verification, so
/// the chip renders disabled with the requirement list.
public struct PersonaCategoryOption: Sendable, Hashable, Identifiable {
    public let value: String
    public let label: String
    public let isEnabled: Bool
    public let isSensitive: Bool
    public let requirements: [String]

    public var id: String {
        value
    }

    public init(
        value: String,
        label: String,
        isEnabled: Bool,
        isSensitive: Bool = false,
        requirements: [String] = []
    ) {
        self.value = value
        self.label = label
        self.isEnabled = isEnabled
        self.isSensitive = isSensitive
        self.requirements = requirements
    }

    /// Fallback ladder used until `/compliance/categories` answers. Mirrors
    /// `LOW_RISK_PERSONA_CATEGORIES` (`backend/utils/personaCompliance.js:1`)
    /// and RN's `CATEGORIES` constant (`persona.tsx:39`).
    public static let fallback: [PersonaCategoryOption] = [
        PersonaCategoryOption(value: "creator", label: "Creator", isEnabled: true),
        PersonaCategoryOption(value: "writer", label: "Writer", isEnabled: true),
        PersonaCategoryOption(value: "coach", label: "Coach", isEnabled: true),
        PersonaCategoryOption(value: "consultant", label: "Consultant", isEnabled: true),
        PersonaCategoryOption(value: "community_leader", label: "Community Leader", isEnabled: true),
        PersonaCategoryOption(value: "public_figure", label: "Public Figure", isEnabled: true),
        PersonaCategoryOption(value: "other", label: "Other Public Role", isEnabled: true)
    ]
}

/// What the Beacon calls its audience. Mirrors the `audience_label` enum
/// in `personaSchemaFields` (`backend/routes/personas.js:63`), ordered as
/// RN's `AUDIENCE_LABELS`.
public enum PersonaAudienceLabel: String, Sendable, Hashable, CaseIterable, Identifiable {
    case followers
    case subscribers
    case members
    case students
    case clients
    case customers
    case patients

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .followers: "Followers"
        case .subscribers: "Subscribers"
        case .members: "Members"
        case .students: "Students"
        case .clients: "Clients"
        case .customers: "Customers"
        case .patients: "Patients"
        }
    }
}

/// How someone joins the audience. `invite_only` / `organization_managed`
/// exist on the wire but RN only offers the two self-serve modes, so the
/// picker mirrors RN's `AUDIENCE_MODES`.
public enum PersonaAudienceMode: String, Sendable, Hashable, CaseIterable, Identifiable {
    case open
    case approvalRequired = "approval_required"

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .open: "Open"
        case .approvalRequired: "Approval Required"
        }
    }

    public var blurb: String {
        switch self {
        case .open: "Anyone can follow instantly."
        case .approvalRequired: "You approve each new follower."
        }
    }
}

/// A locally-picked image that hasn't been uploaded yet. Held alongside the
/// remote URL so the editor can preview the pick before `save()` pushes it.
public struct PersonaImagePick: Sendable, Hashable {
    public let data: Data
    public let fileName: String
    public let mimeType: String

    public init(data: Data, fileName: String, mimeType: String) {
        self.data = data
        self.fileName = fileName
        self.mimeType = mimeType
    }
}

/// The editable Beacon. Every field here is accepted by
/// `createPersonaSchema` / `updatePersonaSchema`; the two image slots are
/// pushed separately by the persona-media route.
public struct EditPersonaForm: Sendable, Hashable {
    public var handle: String
    public var displayName: String
    public var bio: String
    public var category: String
    public var audienceLabel: PersonaAudienceLabel
    public var audienceMode: PersonaAudienceMode
    public var links: [PersonaLinkDraft]
    /// Already-hosted images (nil until the Beacon has one).
    public var avatarURL: String?
    public var bannerURL: String?
    /// Freshly picked images awaiting upload.
    public var avatarPick: PersonaImagePick?
    public var bannerPick: PersonaImagePick?

    public init(
        handle: String = "",
        displayName: String = "",
        bio: String = "",
        category: String = "creator",
        audienceLabel: PersonaAudienceLabel = .followers,
        audienceMode: PersonaAudienceMode = .open,
        links: [PersonaLinkDraft] = [],
        avatarURL: String? = nil,
        bannerURL: String? = nil,
        avatarPick: PersonaImagePick? = nil,
        bannerPick: PersonaImagePick? = nil
    ) {
        self.handle = handle
        self.displayName = displayName
        self.bio = bio
        self.category = category
        self.audienceLabel = audienceLabel
        self.audienceMode = audienceMode
        self.links = links
        self.avatarURL = avatarURL
        self.bannerURL = bannerURL
        self.avatarPick = avatarPick
        self.bannerPick = bannerPick
    }

    /// Max 1500 (`personaSchemaFields.bio`).
    public static let bioLimit = 1500
    /// Max 8 (`personaSchemaFields.public_links`).
    public static let linkLimit = 8

    public var normalizedHandle: String {
        handle.trimmingCharacters(in: .whitespaces).replacingOccurrences(
            of: "^@+",
            with: "",
            options: .regularExpression
        )
    }

    public var atHandle: String {
        let handle = normalizedHandle
        return handle.isEmpty ? "" : "@\(handle)"
    }

    public var bioCharCount: String {
        "\(bio.count) / \(Self.bioLimit)"
    }

    public var hasIncompleteLink: Bool {
        links.contains(where: \.isIncomplete)
    }

    /// The public URL RN prints on the share card (`persona.tsx:527`).
    public var shareURL: String {
        let handle = normalizedHandle
        return handle.isEmpty ? "" : "https://pantopus.com/@\(handle)"
    }

    public var wireBody: PersonaWriteBody {
        PersonaWriteBody(
            handle: normalizedHandle,
            displayName: displayName.trimmingCharacters(in: .whitespaces),
            bio: bio.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? nil
                : bio.trimmingCharacters(in: .whitespacesAndNewlines),
            category: category,
            audienceLabel: audienceLabel.rawValue,
            audienceMode: audienceMode.rawValue,
            publicLinks: links.compactMap(\.wireValue)
        )
    }

    /// Project a persona the server just handed back onto the form.
    public static func from(_ dto: PersonaSummaryDTO) -> EditPersonaForm {
        EditPersonaForm(
            handle: dto.handle ?? "",
            displayName: dto.displayName ?? "",
            bio: dto.bio ?? "",
            category: dto.category ?? "creator",
            audienceLabel: PersonaAudienceLabel(rawValue: dto.audienceLabel ?? "") ?? .followers,
            audienceMode: PersonaAudienceMode(rawValue: dto.audienceMode ?? "") ?? .open,
            links: (dto.publicLinks ?? []).prefix(linkLimit).map {
                PersonaLinkDraft(label: $0.label, url: $0.url)
            },
            avatarURL: dto.avatarUrl,
            bannerURL: dto.bannerUrl
        )
    }
}

/// Save lifecycle — drives the sticky-bar CTA label exactly like RN's
/// `saveButtonLabel` (`persona.tsx:525`).
public enum EditPersonaSavePhase: Sendable, Hashable {
    case idle
    case profile
    case avatar
    case banner
}

/// Top-level editor state. The form itself is held on the view-model (so
/// SwiftUI can bind into it) — this enum only carries the load outcome.
public enum EditPersonaState: Sendable, Hashable {
    case loading
    /// Ready to edit. `mode` selects create vs. update on save.
    case editing(EditPersonaMode)
    case error(message: String)
}
