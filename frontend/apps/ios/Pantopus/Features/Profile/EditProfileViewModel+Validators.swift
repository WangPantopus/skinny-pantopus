//
//  EditProfileViewModel+Validators.swift
//  Pantopus
//
//  The editor's per-field checks, each mirroring its Joi rule in
//  `updateProfileSchema` (`backend/routes/users.js:324-351`), and the fields
//  the schema lets you clear.
//

import Foundation

extension EditProfileViewModel {
    /// Static validator table. Each entry mirrors the corresponding Joi
    /// rule in `updateProfileSchema` (`backend/routes/users.js:324-351`).
    static let validators: [EditProfileField: FormValidator] = [
        // Checked again by the server; empty keeps the current username.
        .username: FormValidator { value in
            let username = UsernameAvailabilityChecker.normalize(value)
            return username.isEmpty ? nil : AuthValidation.username(username)
        },
        // Required name fields — Joi `.string().min(1).max(255)`.
        .firstName: .all([.required("First name"), .maxLength(255)]),
        .lastName: .all([.required("Last name"), .maxLength(255)]),
        // Optional name fields with length bounds.
        .middleName: .optionalLength("Middle name", min: 1, max: 255),
        // `.allow('', null)` text fields — only an upper bound applies.
        .bio: .maxLength(2000),
        .tagline: .maxLength(255),
        // E.164 phone (optional). Empty allowed at the validator layer
        // but skipped from the PATCH body (see fieldAllowsEmpty).
        .phoneNumber: .e164Phone(),
        // ISO-8601 date or empty.
        .dateOfBirth: .isoDateOrEmpty(),
        // Optional address fields — Joi enforces min/max only when set.
        .address: .optionalLength("Address", min: 5, max: 255),
        .city: .optionalLength("City", min: 2, max: 100),
        .state: .optionalLength("State", min: 2, max: 50),
        .zipcode: .optionalLength("Zipcode", min: 3, max: 20),
        // Social links — Joi `urlOrEmpty`.
        .website: .urlOrEmpty(),
        .linkedin: .urlOrEmpty(),
        .twitter: .urlOrEmpty(),
        .instagram: .urlOrEmpty(),
        .facebook: .urlOrEmpty(),
        // Visibility enum — restrict to the three schema values.
        .profileVisibility: FormValidator { value in
            ["public", "registered", "private"].contains(value)
                ? nil
                : "Pick a visibility option."
        },
        // Boolean-backed toggles — the only invalid state is an unseeded
        // field, which the loader never produces.
        .showEmail: FormValidator { value in
            ["true", "false"].contains(value) ? nil : "Pick an option."
        },
        .showPhone: FormValidator { value in
            ["true", "false"].contains(value) ? nil : "Pick an option."
        }
    ]

    /// Whether the schema explicitly allows an empty / null payload for
    /// the given field — see the Joi declarations at
    /// `backend/routes/users.js:324-351`.
    static let allowsEmpty: Set<EditProfileField> = [
        .middleName, .bio, .tagline, .dateOfBirth,
        .website, .linkedin, .twitter, .instagram, .facebook
    ]
}
