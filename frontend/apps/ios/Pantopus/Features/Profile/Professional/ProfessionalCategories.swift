//
//  ProfessionalCategories.swift
//  Pantopus
//
//  The professional-category enum the backend validates against —
//  `VALID_CATEGORIES` in `backend/routes/professional.js:32`. Sending a
//  value outside this list fails Joi validation on both
//  `POST /api/professional/profile` and `PATCH /api/professional/profile/me`,
//  so the enable form picks from here rather than free text.
//
//  Mirrors the RN option list at
//  `pantopus/frontend/apps/mobile/src/app/professional.tsx:25`.
//

import Foundation

/// One selectable professional category (backend key + display label).
public struct ProfessionalCategory: Sendable, Hashable, Identifiable {
    public let key: String
    public let label: String

    public var id: String {
        key
    }

    public init(key: String, label: String) {
        self.key = key
        self.label = label
    }

    /// Maximum categories the server accepts (`Joi.array().max(5)`).
    public static let selectionLimit = 5

    /// The 30 server-valid categories, in the RN screen's order.
    public static let all: [ProfessionalCategory] = [
        ProfessionalCategory(key: "handyman", label: "Handyman"),
        ProfessionalCategory(key: "plumber", label: "Plumber"),
        ProfessionalCategory(key: "electrician", label: "Electrician"),
        ProfessionalCategory(key: "landscaping", label: "Landscaping"),
        ProfessionalCategory(key: "cleaning", label: "Cleaning"),
        ProfessionalCategory(key: "painting", label: "Painting"),
        ProfessionalCategory(key: "moving", label: "Moving"),
        ProfessionalCategory(key: "pet_care", label: "Pet Care"),
        ProfessionalCategory(key: "tutoring", label: "Tutoring"),
        ProfessionalCategory(key: "photography", label: "Photography"),
        ProfessionalCategory(key: "catering", label: "Catering"),
        ProfessionalCategory(key: "personal_training", label: "Personal Training"),
        ProfessionalCategory(key: "auto_repair", label: "Auto Repair"),
        ProfessionalCategory(key: "carpentry", label: "Carpentry"),
        ProfessionalCategory(key: "roofing", label: "Roofing"),
        ProfessionalCategory(key: "hvac", label: "HVAC"),
        ProfessionalCategory(key: "pest_control", label: "Pest Control"),
        ProfessionalCategory(key: "appliance_repair", label: "Appliance Repair"),
        ProfessionalCategory(key: "interior_design", label: "Interior Design"),
        ProfessionalCategory(key: "event_planning", label: "Event Planning"),
        ProfessionalCategory(key: "music_lessons", label: "Music Lessons"),
        ProfessionalCategory(key: "web_development", label: "Web Development"),
        ProfessionalCategory(key: "graphic_design", label: "Graphic Design"),
        ProfessionalCategory(key: "writing", label: "Writing"),
        ProfessionalCategory(key: "consulting", label: "Consulting"),
        ProfessionalCategory(key: "childcare", label: "Childcare"),
        ProfessionalCategory(key: "elder_care", label: "Elder Care"),
        ProfessionalCategory(key: "delivery", label: "Delivery"),
        ProfessionalCategory(key: "errand_running", label: "Errand Running"),
        ProfessionalCategory(key: "other", label: "Other")
    ]

    /// Display label for a backend key — falls back to a title-cased split
    /// so an unknown key still reads cleanly.
    public static func label(for key: String) -> String {
        if let match = all.first(where: { $0.key == key }) { return match.label }
        return key.split(separator: "_")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }
}
