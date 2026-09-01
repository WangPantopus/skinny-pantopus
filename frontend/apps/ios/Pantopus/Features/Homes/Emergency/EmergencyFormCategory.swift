//
//  EmergencyFormCategory.swift
//  Pantopus
//
//  P2.8 — Form-side category enum for the Add Emergency Info form.
//  Carries the seven user-facing categories called out in the prompt
//  (allergy / medical condition / medication / contact / pet-medical /
//  power-of-attorney / other) and maps each onto the existing four-
//  bucket `EmergencyCategory` palette so the form, detail, and list
//  tiles re-use the same visual language.
//

import SwiftUI

/// Form-side category enum exposed by the Add Emergency Info form.
/// Each case maps to a single `EmergencyCategory` for tile styling and
/// carries the backend `type` string that the POST body uses.
public enum EmergencyFormCategory: String, CaseIterable, Sendable, Identifiable {
    case allergy
    case medicalCondition = "medical_condition"
    case medication
    case contact
    case petMedical = "pet_medical"
    case powerOfAttorney = "power_of_attorney"
    case other

    public var id: String {
        rawValue
    }

    /// Long-form label rendered on the category picker.
    public var label: String {
        switch self {
        case .allergy: "Allergy"
        case .medicalCondition: "Medical condition"
        case .medication: "Medication"
        case .contact: "Contact"
        case .petMedical: "Pet medical"
        case .powerOfAttorney: "Power of attorney"
        case .other: "Other"
        }
    }

    /// Per-category glyph rendered on the tile.
    public var icon: PantopusIcon {
        switch self {
        case .allergy: .alertTriangle
        case .medicalCondition: .heartPulse
        case .medication: .cross
        case .contact: .phone
        case .petMedical: .pawPrint
        case .powerOfAttorney: .fileSignature
        case .other: .info
        }
    }

    /// Severity-relevant categories — surface the severity chip on the
    /// form and detail. Pure contacts and power-of-attorney rows do not
    /// take a severity, so the chip is hidden.
    public var supportsSeverity: Bool {
        switch self {
        case .allergy, .medicalCondition, .medication, .petMedical, .other:
            true
        case .contact, .powerOfAttorney:
            false
        }
    }

    /// Mapping to the existing four-bucket palette for tile styling.
    /// Medical-flavoured rows (allergy / condition / medication /
    /// pet-medical) re-use the rose-tinted medical palette; contact and
    /// power-of-attorney use the sky contact palette; other falls back
    /// to contact (the safest household default).
    public var palette: EmergencyCategory {
        switch self {
        case .allergy, .medicalCondition, .medication, .petMedical:
            .medical
        case .contact, .powerOfAttorney, .other:
            .contact
        }
    }

    /// Backend `type` string used by `POST /api/homes/:id/emergencies`.
    /// The server stores `type` as a free-form string so adding the
    /// seven form-side values alongside the nine list-of-rows values
    /// does not break the existing list projection.
    public var backendType: String {
        rawValue
    }

    /// Resolve the form category for a backend type string. Returns
    /// `nil` for the legacy list-of-rows types (`shutoff_water` etc.)
    /// — those rows are still rendered by the list view but cannot be
    /// edited through the form.
    public static func from(type: String) -> EmergencyFormCategory? {
        EmergencyFormCategory(rawValue: type)
    }
}
