//
//  UnlistedDTOs.swift
//  Pantopus
//
//  Unlisted (Wave 4) — "type your address to get it off the internet."
//  DTOs for `backend/routes/unlisted.js` (a claimed home, plus the
//  caller's own removal progress) and `GET /api/public/unlisted`
//  (anonymous; persists nothing, and the address is never stored).
//
//  NOTHING HERE ASSERTS THAT A PERSON IS LISTED ANYWHERE. We do not
//  query people-search sites, because querying one would disclose the
//  address to the exact company the person is trying to leave. There is
//  no `found` field and there must never be one — `methodNote` is the
//  server's sentence saying so, and the UI renders it verbatim.
//
//  TWO NULL-NESSES IN THIS PAYLOAD ARE LOAD-BEARING, so each is modelled
//  as its own type rather than as a bare `nil` the view can shrug off:
//
//  * `state_program == null` means WE DID NOT CHECK this state — it is
//    NOT "your state has no program". Collapsing the two tells someone
//    in danger that no help exists when we simply did not look.
//    → `UnlistedStateProgramAnswer`, which has three cases on purpose.
//  * `removals == null` means the progress read FAILED, which is
//    different from `[]` ("nothing recorded yet"). An empty checklist is
//    a confident claim we cannot make when the read failed.
//    → `UnlistedRemovalProgress`, which also distinguishes "this payload
//    has no progress at all" (the anonymous profile).
//
//  Every vocabulary enum falls back to a safe constant so a server-side
//  addition degrades one field instead of failing the whole decode.
//

import Foundation

// MARK: - Vocabulary

/// How a broker wants to be asked. A method this build has never heard
/// of renders as "check their page" rather than failing the list.
public enum UnlistedBrokerMethod: String, Sendable, Hashable {
    case webForm = "web_form"
    case email
    case phone
    case mail
    case accountRequired = "account_required"
    case unknown
}

extension UnlistedBrokerMethod: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = UnlistedBrokerMethod(rawValue: raw) ?? .unknown
    }
}

/// The four groups the registry is worked through in. The human label
/// arrives on the group itself, so an unrecognised category only costs
/// the icon, never the row.
public enum UnlistedBrokerCategory: String, Sendable, Hashable {
    case peopleSearch = "people_search"
    case backgroundCheck = "background_check"
    case propertyRecords = "property_records"
    case marketing
    case unknown
}

extension UnlistedBrokerCategory: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = UnlistedBrokerCategory(rawValue: raw) ?? .unknown
    }
}

/// Where the resident has got to with one broker. Bookkeeping THEY own —
/// the removal itself happens on the broker's own site; we never act as
/// the person and must never imply we did.
public enum UnlistedRemovalStatus: String, Sendable, Hashable, CaseIterable {
    case todo
    case requested
    case confirmed
    case relisted
    /// A status this build does not know. Never treated as progress.
    case unknown

    /// The four the resident can actually pick, in the order they happen.
    public static let selectable: [UnlistedRemovalStatus] = [.todo, .requested, .confirmed, .relisted]
}

extension UnlistedRemovalStatus: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = UnlistedRemovalStatus(rawValue: raw) ?? .unknown
    }
}

// MARK: - State program (the escape hatch — it leads the surface)

/// One state's Address Confidentiality Program facts, as verified
/// against `source_url`. `exists == false` is a REAL answer ("we
/// checked, this state runs none") and `eligibility` then carries what
/// the state does offer instead — it is never empty filler.
public struct UnlistedStateProgram: Decodable, Sendable, Hashable {
    /// `nil` when the server did not state it. ABSENT IS NOT `false`:
    /// defaulting an unreadable payload to `false` would make the view
    /// say "your state has none" off a field we never actually read —
    /// the exact collapse the three answers exist to prevent. A `nil`
    /// here resolves to `.unconfirmed`, never `.noProgram`.
    public let exists: Bool?
    /// Empty when `exists == false` — the state has no program to name.
    public let name: String
    public let url: String
    /// Who qualifies when a program exists; what the state offers
    /// instead when it does not.
    public let eligibility: String
    public let sourceUrl: String
    public let verifiedAt: String?

    private enum CodingKeys: String, CodingKey {
        case exists, name, url, eligibility
        case sourceUrl = "source_url"
        case verifiedAt = "verified_at"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Deliberately NOT `?? false`. See the property's doc comment.
        exists = try container.decodeIfPresent(Bool.self, forKey: .exists)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? ""
        url = try container.decodeIfPresent(String.self, forKey: .url) ?? ""
        eligibility = try container.decodeIfPresent(String.self, forKey: .eligibility) ?? ""
        sourceUrl = try container.decodeIfPresent(String.self, forKey: .sourceUrl) ?? ""
        verifiedAt = try container.decodeIfPresent(String.self, forKey: .verifiedAt)
    }

    public init(
        exists: Bool?,
        name: String,
        url: String,
        eligibility: String,
        sourceUrl: String,
        verifiedAt: String?
    ) {
        self.exists = exists
        self.name = name
        self.url = url
        self.eligibility = eligibility
        self.sourceUrl = sourceUrl
        self.verifiedAt = verifiedAt
    }

    /// The official page, when there is one to link to.
    public var programURL: URL? {
        URL(string: url.trimmingCharacters(in: .whitespaces))
    }

    /// The page the facts above were verified against.
    public var sourceURL: URL? {
        URL(string: sourceUrl.trimmingCharacters(in: .whitespaces))
    }
}

/// THE THREE ANSWERS, kept apart at the type level so a view cannot
/// accidentally render two of them the same way.
///
/// * `.program`     — this state runs one; name it, say who qualifies, link it.
/// * `.noProgram`   — we checked and it runs none; say what it DOES offer.
/// * `.unconfirmed` — we have not confirmed a program for this state.
///                    NEVER "your state has none".
public enum UnlistedStateProgramAnswer: Sendable, Hashable {
    case program(UnlistedStateProgram)
    case noProgram(UnlistedStateProgram)
    case unconfirmed
}

// MARK: - Brokers

/// One site that republishes county property records, and the exact
/// verified way to leave it. `note` carries the caveat the person
/// actually needs (a dead form, a half-verified flow, a site that
/// relists you) — render it whole; it is not clutter.
public struct UnlistedBroker: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let category: UnlistedBrokerCategory
    /// Tokens into `UnlistedExposureProfile.exposureLabels`.
    public let exposes: [String]
    public let optOutUrl: String
    public let method: UnlistedBrokerMethod
    public let requiresId: Bool
    public let requiresEmail: Bool
    /// `0` means NO processing time is published. Render "not stated" —
    /// never "0 days", which would read as instant.
    public let typicalDays: Int
    public let note: String
    public let sourceUrl: String
    public let verifiedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, name, category, exposes, method, note
        case optOutUrl = "opt_out_url"
        case requiresId = "requires_id"
        case requiresEmail = "requires_email"
        case typicalDays = "typical_days"
        case sourceUrl = "source_url"
        case verifiedAt = "verified_at"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        category = try container.decodeIfPresent(UnlistedBrokerCategory.self, forKey: .category) ?? .unknown
        exposes = try container.decodeIfPresent([String].self, forKey: .exposes) ?? []
        optOutUrl = try container.decodeIfPresent(String.self, forKey: .optOutUrl) ?? ""
        method = try container.decodeIfPresent(UnlistedBrokerMethod.self, forKey: .method) ?? .unknown
        requiresId = try container.decodeIfPresent(Bool.self, forKey: .requiresId) ?? false
        requiresEmail = try container.decodeIfPresent(Bool.self, forKey: .requiresEmail) ?? false
        typicalDays = try container.decodeIfPresent(Int.self, forKey: .typicalDays) ?? 0
        note = try container.decodeIfPresent(String.self, forKey: .note) ?? ""
        sourceUrl = try container.decodeIfPresent(String.self, forKey: .sourceUrl) ?? ""
        verifiedAt = try container.decodeIfPresent(String.self, forKey: .verifiedAt)
    }

    /// The exact page the person should start at.
    public var optOutURL: URL? {
        URL(string: optOutUrl.trimmingCharacters(in: .whitespaces))
    }

    /// `nil` when the site publishes no processing time — the caller
    /// must say "not stated" rather than inventing a number.
    public var statedProcessingDays: Int? {
        typicalDays > 0 ? typicalDays : nil
    }
}

/// Brokers grouped in the order a person should work through them; the
/// `label` is the server's human heading for the category.
public struct UnlistedBrokerGroup: Decodable, Sendable, Hashable, Identifiable {
    public let category: UnlistedBrokerCategory
    /// The category exactly as the server sent it, kept alongside the
    /// typed enum so an unrecognised value still has a stable identity.
    public let rawCategory: String
    public let label: String
    public let brokers: [UnlistedBroker]

    /// The RAW CATEGORY is the identity, not the label.
    ///
    /// This used to be `label`, with a comment claiming that avoided
    /// collisions. It did not: `label` decodes to "" when absent, so two
    /// groups with an unread label both get `id == ""` — and duplicate
    /// ids in a SwiftUI ForEach silently drop a row, which here means an
    /// entire category of removal paths vanishing from a page someone is
    /// using to get their address offline.
    ///
    /// It also matches Android's `place.unlisted.group.${group.category}`,
    /// so the two clients' test identifiers finally agree, and it no
    /// longer re-keys every identifier when a label's copy is edited.
    public var id: String { rawCategory.isEmpty ? (label.isEmpty ? "unknown" : label) : rawCategory }

    private enum CodingKeys: String, CodingKey {
        case category, label, brokers
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        category = try container.decodeIfPresent(UnlistedBrokerCategory.self, forKey: .category) ?? .unknown
        rawCategory = (try? container.decode(String.self, forKey: .category)) ?? ""
        label = try container.decodeIfPresent(String.self, forKey: .label) ?? ""
        brokers = try container.decodeIfPresent([UnlistedBroker].self, forKey: .brokers) ?? []
    }
}

// MARK: - Removal progress (claimed homes only, and personal)

/// One recorded step. Scoped to the caller, never the household: a row
/// saying "this person is erasing their address" is exactly what must
/// not leak to someone they live with.
public struct UnlistedRemoval: Decodable, Sendable, Hashable, Identifiable {
    public let brokerId: String
    public let status: UnlistedRemovalStatus
    public let requestedAt: String?
    public let confirmedAt: String?

    public var id: String { brokerId }

    private enum CodingKeys: String, CodingKey {
        case status
        case brokerId = "broker_id"
        case requestedAt = "requested_at"
        case confirmedAt = "confirmed_at"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        brokerId = try container.decode(String.self, forKey: .brokerId)
        status = try container.decodeIfPresent(UnlistedRemovalStatus.self, forKey: .status) ?? .unknown
        requestedAt = try container.decodeIfPresent(String.self, forKey: .requestedAt)
        confirmedAt = try container.decodeIfPresent(String.self, forKey: .confirmedAt)
    }

    public init(
        brokerId: String,
        status: UnlistedRemovalStatus,
        requestedAt: String?,
        confirmedAt: String?
    ) {
        self.brokerId = brokerId
        self.status = status
        self.requestedAt = requestedAt
        self.confirmedAt = confirmedAt
    }
}

/// `removals` has three distinct meanings and the view must render three
/// distinct things:
///
/// * `.recorded([])`  — nothing done yet. An honest empty checklist.
/// * `.recorded([…])` — what the resident has told us they have done.
/// * `.unavailable`   — the read FAILED (`null` on the wire). Showing an
///                      empty checklist here would claim, falsely, that
///                      nothing has been done.
/// * `.notApplicable` — the key is absent entirely: the anonymous
///                      profile, which has no progress to have.
public enum UnlistedRemovalProgress: Sendable, Hashable {
    case recorded([UnlistedRemoval])
    case unavailable
    case notApplicable

    /// The recorded rows, or `nil` when there is nothing we can honestly
    /// claim about progress.
    public var rows: [UnlistedRemoval]? {
        if case let .recorded(rows) = self { return rows }
        return nil
    }
}

// MARK: - The profile

/// The public exposure profile for an address's STATE — identical for
/// everyone in that state by construction, which is exactly why it can
/// be served anonymously without storing the address.
public struct UnlistedExposureProfile: Decodable, Sendable, Hashable {
    public let state: String?
    /// `nil` means WE DID NOT CHECK. Read `stateProgramAnswer` instead
    /// of testing this directly — the three answers are different.
    public let stateProgram: UnlistedStateProgram?
    public let groups: [UnlistedBrokerGroup]
    public let brokerCount: Int
    /// Exposure token → the human label for it.
    public let exposureLabels: [String: String]
    /// The honesty line. MUST be rendered visibly near the broker list,
    /// verbatim: without it the surface implies a scan we never ran.
    public let methodNote: String
    public let registryVerifiedAt: String?
    /// Present only on the claimed-home route. See `UnlistedRemovalProgress`.
    public let removals: UnlistedRemovalProgress

    private enum CodingKeys: String, CodingKey {
        case state, groups, removals
        case stateProgram = "state_program"
        case brokerCount = "broker_count"
        case exposureLabels = "exposure_labels"
        case methodNote = "method_note"
        case registryVerifiedAt = "registry_verified_at"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        state = try container.decodeIfPresent(String.self, forKey: .state)
        stateProgram = try container.decodeIfPresent(UnlistedStateProgram.self, forKey: .stateProgram)
        groups = try container.decodeIfPresent([UnlistedBrokerGroup].self, forKey: .groups) ?? []
        brokerCount = try container.decodeIfPresent(Int.self, forKey: .brokerCount) ?? 0
        exposureLabels = try container.decodeIfPresent([String: String].self, forKey: .exposureLabels) ?? [:]
        methodNote = try container.decodeIfPresent(String.self, forKey: .methodNote) ?? ""
        registryVerifiedAt = try container.decodeIfPresent(String.self, forKey: .registryVerifiedAt)

        // `null` (the read failed) and "key absent" (the anonymous
        // profile) are different facts, and `decodeIfPresent` collapses
        // them — so ask the container which one this is.
        if container.contains(.removals) {
            if let rows = try container.decodeIfPresent([UnlistedRemoval].self, forKey: .removals) {
                removals = .recorded(rows)
            } else {
                removals = .unavailable
            }
        } else {
            removals = .notApplicable
        }
    }

    /// The state answer, as one of three mutually exclusive cases.
    /// Only a program we actually read `exists` off can produce one of
    /// the two confident answers. A missing key falls to `.unconfirmed`
    /// alongside a missing object — "we did not check" is the honest
    /// answer for both, and it is the only safe direction to fail in.
    public var stateProgramAnswer: UnlistedStateProgramAnswer {
        guard let stateProgram, let exists = stateProgram.exists else { return .unconfirmed }
        return exists ? .program(stateProgram) : .noProgram(stateProgram)
    }

    /// The human label for an `exposes` token. Falls back to the token
    /// made readable so a new server-side token still reads as English.
    public func exposureLabel(_ token: String) -> String {
        if let label = exposureLabels[token], !label.isEmpty { return label }
        let words = token.split(separator: "_").map(String.init)
        guard let first = words.first, !first.isEmpty else { return token }
        let head = first.prefix(1).uppercased() + first.dropFirst()
        return ([head] + words.dropFirst()).joined(separator: " ")
    }

    /// What the resident has recorded for one broker, or `nil` when
    /// there is no honest answer (nothing recorded, or the read failed).
    public func removal(forBrokerId brokerId: String) -> UnlistedRemoval? {
        removals.rows?.first { $0.brokerId == brokerId }
    }
}

// MARK: - Envelopes

/// `GET /api/homes/:id/unlisted`.
public struct UnlistedProfileResponse: Decodable, Sendable, Hashable {
    public let unlisted: UnlistedExposureProfile
}

/// `PUT /api/homes/:id/unlisted/removals/:brokerId` body.
public struct UpdateUnlistedRemovalRequest: Encodable, Sendable, Hashable {
    public let status: String

    public init(status: UnlistedRemovalStatus) {
        self.status = status.rawValue
    }
}

/// `PUT /api/homes/:id/unlisted/removals/:brokerId` response.
public struct UnlistedRemovalResponse: Decodable, Sendable, Hashable {
    public let removal: UnlistedRemoval
}

// MARK: - Anonymous T0 (`GET /api/public/unlisted?address=`)

public enum PublicUnlistedStatus: String, Sendable, Hashable {
    case ready
    /// We could not read a state out of what was typed. This is NOT
    /// `unsupportedRegion`: the removal list is national and still
    /// arrives in full, with `state_program` absent rather than negative.
    /// Rendering the two the same told US residents the product had
    /// nothing for them whenever the address failed to parse.
    case couldNotPlace = "could_not_place"
    case unsupportedRegion = "unsupported_region"
    case unknown
}

extension PublicUnlistedStatus: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PublicUnlistedStatus(rawValue: raw) ?? .unknown
    }
}

/// Only the state comes back — `city` is always nil on this route, since
/// resolving one would mean a third-party geocode and the anonymous path
/// promises the typed address is not sent anywhere. It resolves to a
/// state locally, and is then dropped.
public struct PublicUnlistedPlace: Decodable, Sendable, Hashable {
    public let city: String?
    public let state: String?
}

public struct PublicUnlistedResponse: Decodable, Sendable, Hashable {
    public let status: PublicUnlistedStatus
    public let tier: String?
    public let place: PublicUnlistedPlace?
    public let unlisted: UnlistedExposureProfile?
    public let disclaimer: String?
    /// Carried by `could_not_place` and `unsupported_region`. Only the
    /// latter means "not in the US"; the former still ships a profile.
    public let message: String?
}
