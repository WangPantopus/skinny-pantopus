//
//  AddHomeSteps.swift
//  Pantopus
//
//  Step identifiers + persistable form state for the Add-Home wizard.
//  Used both by `AddHomeWizardViewModel` and the SceneStorage-backed
//  restoration glue in `AddHomeWizardView`.
//

import Foundation

/// The four pre-success steps of the Add-Home wizard, in order.
public enum AddHomeStep: Int, CaseIterable, Sendable {
    case address = 0
    case confirm
    case role
    case review
    case success

    /// Total number of "step N of M" steps shown in the readout. Excludes
    /// the success terminal.
    public static let progressTotal: Int = 4

    /// One-indexed position used in the "N of M" top-bar readout.
    public var stepNumber: Int? {
        switch self {
        case .address: 1
        case .confirm: 2
        case .role: 3
        case .review: 4
        case .success: nil
        }
    }
}

/// Structured address fields selected by the search-first step. The
/// source is a deterministic candidate fixture until the API contract
/// lands, but downstream wizard steps keep consuming this shape.
public struct AddHomeAddressFields: Codable, Sendable, Equatable {
    public var street: String
    public var unit: String
    public var city: String
    public var state: String
    public var zipCode: String

    public init(
        street: String = "",
        unit: String = "",
        city: String = "",
        state: String = "",
        zipCode: String = ""
    ) {
        self.street = street
        self.unit = unit
        self.city = city
        self.state = state
        self.zipCode = zipCode
    }

    /// True when every required component (street/city/state/zip) has at
    /// least one non-whitespace character.
    public var isComplete: Bool {
        !trimmed(street).isEmpty
            && !trimmed(city).isEmpty
            && !trimmed(state).isEmpty
            && !trimmed(zipCode).isEmpty
    }

    private func trimmed(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

/// User's role on the home being added — picked in step 3.
public enum AddHomeRole: String, CaseIterable, Codable, Sendable {
    case owner
    case tenant
    case householdMember

    /// Wire value sent in `CreateHomeRequest` (a `name` hint, not the
    /// canonical role field — the role is implied by the verification
    /// flow on the server).
    public var label: String {
        switch self {
        case .owner: "Owner"
        case .tenant: "Tenant"
        case .householdMember: "Household member"
        }
    }

    /// `claimed_role` sent with `POST /api/homes/:id/claim`
    /// (`backend/routes/home.js:6482`). Values mirror RN's role picker
    /// (`src/components/homes/types.ts:17-20`).
    public var claimedRole: String {
        switch self {
        case .owner: "owner"
        case .tenant: "renter"
        case .householdMember: "household"
        }
    }
}

/// Canonical `home_type` values accepted by `createHomeSchema`
/// (`backend/routes/home.js:70`), paired with the chip labels RN shows in
/// its Details step (`src/components/homes/types.ts:12-14`).
///
/// RN's picker sends its own label lowercased, which emits `duplex` — a
/// value the Joi enum rejects. We carry the canonical key on the case and
/// only the label in the UI, so the chip reads "Duplex" and the wire
/// value is the valid `multi_unit`.
public enum AddHomeHomeType: String, CaseIterable, Codable, Sendable {
    case house
    case apartment
    case condo
    case townhouse
    case studio
    case multiUnit = "multi_unit"
    case mobileHome = "mobile_home"
    case rv
    case trailer
    case other

    public var label: String {
        switch self {
        case .house: "House"
        case .apartment: "Apartment"
        case .condo: "Condo"
        case .townhouse: "Townhouse"
        case .studio: "Studio"
        case .multiUnit: "Duplex"
        case .mobileHome: "Mobile Home"
        case .rv: "RV"
        case .trailer: "Trailer"
        case .other: "Other"
        }
    }

    /// Decode a canonical `home_type` from `property-suggestions`.
    public static func from(canonical: String?) -> AddHomeHomeType? {
        guard let canonical else { return nil }
        return AddHomeHomeType(rawValue: canonical.lowercased())
    }
}

/// The eight editable property fields RN's Details step collects
/// (`src/components/homes/DetailsStep.tsx:113-172`), pre-filled from
/// `POST /api/homes/property-suggestions`. Kept as strings so partially
/// typed numeric input round-trips without clobbering the user's edit.
public struct AddHomeDetailsFields: Codable, Sendable, Equatable {
    public var nickname: String
    public var homeType: AddHomeHomeType
    public var bedrooms: String
    public var bathrooms: String
    public var sqFt: String
    public var lotSqFt: String
    public var yearBuilt: String
    public var description: String

    public init(
        nickname: String = "",
        homeType: AddHomeHomeType = .house,
        bedrooms: String = "",
        bathrooms: String = "",
        sqFt: String = "",
        lotSqFt: String = "",
        yearBuilt: String = "",
        description: String = ""
    ) {
        self.nickname = nickname
        self.homeType = homeType
        self.bedrooms = bedrooms
        self.bathrooms = bathrooms
        self.sqFt = sqFt
        self.lotSqFt = lotSqFt
        self.yearBuilt = yearBuilt
        self.description = description
    }
}

/// One "Networks & codes" row on the Setup step. Values are POSTed to
/// `POST /api/homes/:id/access` once the home exists — RN does the same
/// in `finalizeCreatedHome` (`useHomeForm.ts:321-336`).
///
/// Deliberately **not** part of `AddHomeFormState`: the secret value is a
/// Wi-Fi / alarm / gate password and must never be written to
/// `@SceneStorage`.
public struct AddHomeAccessItem: Identifiable, Sendable, Equatable {
    public let id: UUID
    public var accessType: AddHomeAccessType
    public var label: String
    public var secretValue: String
    /// Per-row reveal toggle for the masked secret field.
    public var isRevealed: Bool
    /// Inline validation messages (label / value must be filled together).
    public var labelError: String?
    public var valueError: String?

    public init(
        id: UUID = UUID(),
        accessType: AddHomeAccessType = .wifi,
        label: String = "",
        secretValue: String = "",
        isRevealed: Bool = false,
        labelError: String? = nil,
        valueError: String? = nil
    ) {
        self.id = id
        self.accessType = accessType
        self.label = label
        self.secretValue = secretValue
        self.isRevealed = isRevealed
        self.labelError = labelError
        self.valueError = valueError
    }

    public var isBlank: Bool {
        label.trimmingCharacters(in: .whitespaces).isEmpty
            && secretValue.trimmingCharacters(in: .whitespaces).isEmpty
    }

    public var isComplete: Bool {
        !label.trimmingCharacters(in: .whitespaces).isEmpty
            && !secretValue.trimmingCharacters(in: .whitespaces).isEmpty
    }
}

/// `access_type` values RN offers on the Setup step
/// (`src/components/homes/types.ts:26-34`). The raw value is the wire
/// value on `POST /api/homes/:id/access`
/// (`backend/routes/home.js:5735`).
public enum AddHomeAccessType: String, CaseIterable, Sendable {
    case wifi
    case doorCode = "door_code"
    case gateCode = "gate_code"
    case lockbox
    case garage
    case alarm
    case other

    public var label: String {
        switch self {
        case .wifi: "WiFi"
        case .doorCode: "Door code"
        case .gateCode: "Gate code"
        case .lockbox: "Lockbox"
        case .garage: "Garage"
        case .alarm: "Alarm"
        case .other: "Other"
        }
    }

    /// Fallback label applied when the user picks a type without having
    /// typed one (RN `DEFAULT_ACCESS_LABELS`, `types.ts:36-44`).
    public var defaultLabel: String {
        switch self {
        case .wifi: "Main WiFi"
        case .doorCode: "Front door"
        case .gateCode: "Gate"
        case .lockbox: "Lockbox"
        case .garage: "Garage"
        case .alarm: "Alarm"
        case .other: "Access code"
        }
    }

    public var valueFieldLabel: String {
        self == .wifi ? "Password" : "Code / value"
    }

    public var valuePlaceholder: String {
        self == .wifi ? "••••••••" : "Enter code"
    }

    public var labelPlaceholder: String {
        self == .wifi ? "e.g. Main WiFi, Guest" : "e.g. Front door"
    }
}

/// Snapshot of all wizard form state. Encoded into `@SceneStorage` so the
/// in-progress wizard survives process death and config changes per
/// acceptance criterion #5.
public struct AddHomeFormState: Codable, Sendable, Equatable {
    public var step: Int
    public var address: AddHomeAddressFields
    public var isPrimary: Bool
    public var role: AddHomeRole?
    /// Details step fields (nickname / type / beds / baths / sizes /
    /// year / description).
    public var details: AddHomeDetailsFields

    public init(
        step: Int = AddHomeStep.address.rawValue,
        address: AddHomeAddressFields = .init(),
        isPrimary: Bool = true,
        role: AddHomeRole? = nil,
        details: AddHomeDetailsFields = .init()
    ) {
        self.step = step
        self.address = address
        self.isPrimary = isPrimary
        self.role = role
        self.details = details
    }

    public static let empty = AddHomeFormState()
}

/// Parse an `WIFI:`-prefixed QR payload into SSID + password. Verbatim
/// port of RN's `parseWifiQr` (`src/components/homes/utils.ts:17-37`) —
/// including the escape handling for `\;`, `\,`, `\:` and `\\`.
public func parseWifiQRPayload(_ raw: String) -> (ssid: String, password: String)? {
    guard raw.hasPrefix("WIFI:") else { return nil }
    let body = String(raw.dropFirst("WIFI:".count))
    var ssid = ""
    var password = ""
    for part in body.split(separator: ";", omittingEmptySubsequences: false) {
        let segment = String(part)
        guard let separator = segment.firstIndex(of: ":"), separator != segment.startIndex else {
            continue
        }
        let key = String(segment[segment.startIndex..<separator])
        let value = String(segment[segment.index(after: separator)...])
        if key == "S" { ssid = unescapeWifiQRValue(value) }
        if key == "P" { password = unescapeWifiQRValue(value) }
    }
    guard !ssid.isEmpty else { return nil }
    return (ssid, password)
}

/// `\;` → `;`, `\,` → `,`, `\:` → `:`, `\\` → `\`.
/// RN `unescapeWifiQrValue` (`utils.ts:17-19`).
public func unescapeWifiQRValue(_ value: String) -> String {
    var out = ""
    var isEscaping = false
    for character in value {
        if isEscaping {
            if character == ";" || character == "," || character == ":" || character == "\\" {
                out.append(character)
            } else {
                out.append("\\")
                out.append(character)
            }
            isEscaping = false
        } else if character == "\\" {
            isEscaping = true
        } else {
            out.append(character)
        }
    }
    if isEscaping { out.append("\\") }
    return out
}
