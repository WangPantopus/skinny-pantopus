//
//  EditProfileViewModel.swift
//  Pantopus
//
//  Fetches `GET /api/users/profile` (`backend/routes/users.js:1427`) and
//  submits `PATCH /api/users/profile` (`backend/routes/users.js:1503`).
//  Every editable field is defined in `updateProfileSchema`
//  (`backend/routes/users.js:324-351`) and is mirrored 1:1 below.
//
//  The avatar is NOT part of `updateProfileSchema` — it has its own
//  multipart route, `POST /api/upload/profile-picture`
//  (`backend/routes/upload.js:236`), which writes `profile_picture_url`
//  server-side. `uploadAvatar(...)` below drives that leg and then
//  refreshes the session user so the new photo appears app-wide (RN
//  `src/app/profile/edit.tsx:75-106`).
//
//  Note: the design also calls for an editable email when unverified and
//  boolean visibility toggles (`profile_visibility_public` +
//  `show_in_neighbor_discovery`). Neither exists in `updateProfileSchema`
//  today, so those affordances stay omitted until the backend adds the
//  keys.
//

import Foundation
import Observation

/// Stable identifiers for every editable field in the Edit Profile form.
/// Order mirrors `updateProfileSchema` declaration order so the form layout
/// reads top-down in the same order as the backend contract.
public enum EditProfileField: String, CaseIterable, Sendable {
    // About
    case firstName
    case middleName
    case lastName
    case bio
    case tagline

    // Contact
    case phoneNumber
    case dateOfBirth

    // Address
    case address
    case city
    case state
    case zipcode

    // Social links — backend stores these in the `social_links` jsonb
    // column but accepts them as flat keys on PATCH.
    case website
    case linkedin
    case twitter
    case instagram
    case facebook

    /// Visibility
    case profileVisibility
    /// Contact visibility — `"true"` / `"false"` strings so the whole form
    /// stays on one `FormFieldState` machinery. Mapped to the booleans
    /// `showEmail` / `showPhone` on PATCH (`backend/routes/users.js:2076`).
    case showEmail
    case showPhone
}

/// Observed state for the Edit Profile screen.
public enum EditProfileState: Sendable {
    case loading
    case loaded
    case error(String)
}

/// Avatar leg state. Kept separate from `EditProfileState` because the
/// form stays fully usable while a photo uploads, and an upload failure
/// must not blank the form.
public enum EditProfileAvatarState: Sendable, Equatable {
    case idle
    case uploading
    /// Read + upload failures both land here so the block can render a
    /// real error line with a retry affordance instead of a silent no-op.
    case failed(message: String)
}

/// ViewModel backing `EditProfileView`.
@Observable
@MainActor
final class EditProfileViewModel {
    private(set) var state: EditProfileState = .loading
    /// Email is read-only; captured so the view can render it.
    private(set) var email: String = ""
    /// True while the verified flag on the fetched profile is set.
    private(set) var emailVerified: Bool = false

    /// Field states keyed by `EditProfileField`.
    var fields: [EditProfileField: FormFieldState] = [:]
    /// Busy flag for the Save CTA.
    private(set) var isSaving: Bool = false
    /// Toast surfaced by the view after a successful PATCH or failure.
    var toast: ToastMessage?
    /// Increments to trigger the first-invalid shake on submit.
    private(set) var shakeTrigger: Int = 0
    /// Set when a successful save should pop the screen.
    private(set) var shouldDismiss: Bool = false

    /// Current avatar, hydrated from the profile and replaced in place
    /// after a successful upload.
    private(set) var avatarURL: URL?
    /// Display initial rendered when there is no avatar yet.
    private(set) var avatarInitial: String = "?"
    /// Upload leg state — drives the spinner / error line on the block.
    private(set) var avatarState: EditProfileAvatarState = .idle

    /// Working skill list, saved with `PUT /api/users/skills` alongside
    /// the profile PATCH. See `EditProfileViewModel+Skills.swift`.
    var skills: [String] = []
    /// Last-saved skill list — the dirty baseline for `skills`.
    var savedSkills: [String] = []
    /// Text sitting in the add-skill input.
    var skillDraft: String = ""
    /// Bio "Generate with AI" leg state.
    var bioDraftState: EditProfileBioDraftState = .idle

    let api: APIClient
    private let uploader: MultipartUploader

    init(api: APIClient = .shared, uploader: MultipartUploader = .shared) {
        self.api = api
        self.uploader = uploader
        for field in EditProfileField.allCases {
            fields[field] = FormFieldState(id: field.rawValue, originalValue: "")
        }
    }

    /// Push a picked image to `POST /api/upload/profile-picture`, then
    /// refresh the session user so every avatar in the app flips at once.
    /// `data == nil` means the picker handed back an item we couldn't
    /// read (revoked photo access, iCloud asset still downloading) — that
    /// surfaces as a real error, not a silent no-op.
    func uploadAvatar(data: Data?, filename: String, mimeType: String) async {
        guard let data, !data.isEmpty else {
            avatarState = .failed(message: "Couldn't read that photo. Check Photos access in Settings and try again.")
            toast = ToastMessage(text: "Couldn't read that photo.", kind: .error)
            return
        }
        guard NetworkMonitor.shared.isOnline else {
            avatarState = .failed(message: "You're offline. Try again when you're back online.")
            toast = ToastMessage(text: "You're offline. Try again when you're back online.", kind: .error)
            return
        }
        avatarState = .uploading
        do {
            let response = try await uploader.uploadProfilePicture(
                MultipartFile(
                    fieldName: "file",
                    filename: filename,
                    mimeType: mimeType,
                    data: data
                )
            )
            let next = response.user?.profilePictureURL ?? response.url
            avatarURL = URL(string: next)
            avatarState = .idle
            toast = ToastMessage(text: "Profile photo updated.", kind: .success)
            await AuthManager.shared.refreshCurrentUser()
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't upload that photo."
            avatarState = .failed(message: message)
            toast = ToastMessage(text: message, kind: .error)
        }
    }

    /// Clear a failed upload so the block returns to its resting pose.
    func dismissAvatarError() {
        if case .failed = avatarState { avatarState = .idle }
    }

    /// Initial load; no-op when already loaded.
    func load() async {
        if case .loaded = state { return }
        state = .loading
        do {
            let response: ProfileResponse = try await api.request(UsersEndpoints.profile())
            hydrate(from: response.user)
            // Seeded here rather than in `hydrate(from:)`: the PATCH echo
            // carries no `skills` key (`backend/routes/users.js:2194`), so
            // hydrating skills there would blank the list after every save.
            skills = response.user.skills ?? []
            savedSkills = skills
            state = .loaded
        } catch {
            state = .error((error as? APIError)?.errorDescription ?? "Couldn't load profile.")
        }
    }

    /// Retry after an error.
    func refresh() async {
        await load()
    }

    /// Update a field's value and re-run its validator.
    func update(_ field: EditProfileField, to value: String) {
        guard var snapshot = fields[field] else { return }
        snapshot.value = value
        snapshot.touched = true
        snapshot.error = validator(for: field).validate(value)
        fields[field] = snapshot
    }

    /// Current aggregate dirty + validity.
    var aggregate: FormAggregate {
        FormAggregate(fields: EditProfileField.allCases.compactMap { fields[$0] })
    }

    /// Convenience exposes for `FormShell` so the view doesn't have to
    /// thread `aggregate.isValid` / `aggregate.isDirty` through the call
    /// site.
    var isValid: Bool {
        aggregate.isValid
    }

    /// Skills ride their own PUT, so they widen the form's dirty state
    /// without appearing in `aggregate`.
    var isDirty: Bool {
        aggregate.isDirty || isSkillsDirty
    }

    /// True when the working skill list differs from the last-saved one.
    var isSkillsDirty: Bool {
        skills != savedSkills
    }

    /// Number of editable fields whose current value differs from the
    /// last-saved baseline. Drives the A13.9 sticky "N unsaved" pill.
    /// The skill list counts as one such field.
    var dirtyFieldCount: Int {
        fields.values.filter(\.isDirty).count + (isSkillsDirty ? 1 : 0)
    }

    /// Revert all unsaved edits to the last-saved baseline.
    func discardChanges() {
        for field in EditProfileField.allCases {
            guard var snapshot = fields[field] else { continue }
            snapshot.value = snapshot.originalValue
            snapshot.touched = false
            snapshot.error = validator(for: field).validate(snapshot.originalValue)
            fields[field] = snapshot
        }
        skills = savedSkills
        skillDraft = ""
    }

    /// Runs all validators and returns the first failing field id, if any.
    @discardableResult
    func validateAll() -> EditProfileField? {
        var firstInvalid: EditProfileField?
        for field in EditProfileField.allCases {
            guard var snapshot = fields[field] else { continue }
            let message = validator(for: field).validate(snapshot.value)
            snapshot.error = message
            snapshot.touched = true
            fields[field] = snapshot
            if firstInvalid == nil, message != nil { firstInvalid = field }
        }
        return firstInvalid
    }

    /// Submit the profile PATCH and, when the skill list changed, the
    /// skills PUT. Returns true only when every dirty leg landed.
    ///
    /// The two legs are independent on the wire, so each one re-baselines
    /// itself the moment it succeeds: a failure on one never discards the
    /// other's edits, and a retry re-sends only what is still dirty.
    @discardableResult
    func save() async -> Bool {
        if let invalidField = validateAll() {
            shakeTrigger &+= 1
            toast = ToastMessage(text: "Fix the highlighted field.", kind: .error)
            Analytics.track(.formEditProfileValidationError(field: invalidField.rawValue))
            return false
        }
        let fieldsDirty = aggregate.isDirty
        let skillsDirty = isSkillsDirty
        guard fieldsDirty || skillsDirty else { return false }
        if !NetworkMonitor.shared.isOnline {
            // P15: don't silently queue. Surface the error inline.
            toast = ToastMessage(
                text: "You're offline. Try again when you're back online.",
                kind: .error
            )
            Analytics.track(.formEditProfileSubmit(result: .error))
            return false
        }
        isSaving = true
        defer { isSaving = false }
        var failure: String?
        if fieldsDirty {
            do {
                let response: ProfileUpdateResponse = try await api.request(
                    UsersEndpoints.updateProfile(buildRequest())
                )
                hydrate(from: response.user)
            } catch {
                failure = (error as? APIError)?.errorDescription ?? "Couldn't save profile."
            }
        }
        if skillsDirty {
            do {
                // The route trims, dedupes and caps the list, then echoes
                // the cleaned array (`backend/routes/users.js:2254`) — so
                // the echo, not the local list, becomes the new baseline.
                let response: UpdateSkillsResponse = try await api.request(
                    ProfileTabsEndpoints.updateSkills(UpdateSkillsRequest(skills: skills))
                )
                skills = response.skills
                savedSkills = response.skills
            } catch {
                failure = failure ?? (error as? APIError)?.errorDescription ?? "Couldn't save skills."
            }
        }
        if let failure {
            toast = ToastMessage(text: failure, kind: .error)
            Analytics.track(.formEditProfileSubmit(result: .error))
            return false
        }
        toast = ToastMessage(text: "Profile updated.", kind: .success)
        shouldDismiss = true
        Analytics.track(.formEditProfileSubmit(result: .success))
        return true
    }

    /// Invoked by the view when the dismiss should take effect.
    func acknowledgeDismiss() {
        shouldDismiss = false
    }

    // MARK: - Private

    private func hydrate(from profile: UserProfile) {
        email = profile.email
        emailVerified = profile.verified
        // A just-uploaded avatar wins over the PATCH echo: `PATCH
        // /api/users/profile` doesn't touch `profile_picture_url`, but a
        // stale row would otherwise flip the block back to initials.
        if avatarURL == nil {
            avatarURL = (profile.profilePictureURL ?? profile.avatarURL ?? profile.profilePicture)
                .flatMap(URL.init(string:))
        }
        avatarInitial = Self.initial(
            firstName: profile.firstName,
            name: profile.name,
            username: profile.username
        )
        seed(.firstName, profile.firstName)
        seed(.middleName, profile.middleName ?? "")
        seed(.lastName, profile.lastName)
        seed(.bio, profile.bio ?? "")
        seed(.tagline, profile.tagline ?? "")
        seed(.phoneNumber, profile.phoneNumber ?? "")
        seed(.dateOfBirth, profile.dateOfBirth ?? "")
        seed(.address, profile.address ?? "")
        seed(.city, profile.city ?? "")
        seed(.state, profile.state ?? "")
        seed(.zipcode, profile.zipcode ?? "")
        seed(.website, profile.socialLinks?.website ?? "")
        seed(.linkedin, profile.socialLinks?.linkedin ?? "")
        seed(.twitter, profile.socialLinks?.twitter ?? "")
        seed(.instagram, profile.socialLinks?.instagram ?? "")
        seed(.facebook, profile.socialLinks?.facebook ?? "")
        seed(.profileVisibility, profile.profileVisibility ?? "public")
        seed(.showEmail, Self.boolString(profile.showEmail))
        seed(.showPhone, Self.boolString(profile.showPhone))
    }

    /// Bridge between the string-valued form machinery and the two boolean
    /// contact-visibility keys.
    static func boolString(_ value: Bool?) -> String {
        (value ?? false) ? "true" : "false"
    }

    /// First glyph of the best available display name — matches the RN
    /// `displayInitial` fallback on the avatar circle.
    static func initial(firstName: String, name: String, username: String) -> String {
        for candidate in [firstName, name, username] {
            let trimmed = candidate.trimmingCharacters(in: .whitespacesAndNewlines)
            if let first = trimmed.first { return String(first).uppercased() }
        }
        return "?"
    }

    private func seed(_ field: EditProfileField, _ value: String) {
        var snapshot = FormFieldState(id: field.rawValue, originalValue: value)
        snapshot.error = validator(for: field).validate(value)
        fields[field] = snapshot
    }

    /// Per-field validator, looked up via `Self.validators` so this stays
    /// well below the SwiftLint cyclomatic-complexity ceiling.
    private func validator(for field: EditProfileField) -> FormValidator {
        Self.validators[field] ?? FormValidator { _ in nil }
    }

    /// Static validator table. Each entry mirrors the corresponding Joi
    /// rule in `updateProfileSchema` (`backend/routes/users.js:324-351`).
    private static let validators: [EditProfileField: FormValidator] = [
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
    private static let allowsEmpty: Set<EditProfileField> = [
        .middleName, .bio, .tagline, .dateOfBirth,
        .website, .linkedin, .twitter, .instagram, .facebook
    ]

    // swiftlint:disable cyclomatic_complexity

    /// Assemble a PATCH body with only the dirty fields. Empty strings are
    /// included for fields whose schema entry has `.allow('', null)` (so
    /// the user can clear them); fields without that allowance are
    /// skipped when empty so we don't send a value the server will reject.
    ///
    /// The 17-case switch below mirrors the schema 1:1; cyclomatic
    /// complexity is intentionally high and adding indirection would only
    /// hide the mapping.
    private func buildRequest() -> ProfileUpdateRequest {
        var update = ProfileUpdateRequest()
        for field in EditProfileField.allCases {
            guard let snapshot = fields[field], snapshot.isDirty else { continue }
            let trimmed = snapshot.value.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty && !Self.allowsEmpty.contains(field) { continue }
            switch field {
            case .firstName: update.firstName = trimmed
            case .middleName: update.middleName = trimmed
            case .lastName: update.lastName = trimmed
            case .bio: update.bio = trimmed
            case .tagline: update.tagline = trimmed
            case .phoneNumber: update.phoneNumber = trimmed
            case .dateOfBirth: update.dateOfBirth = trimmed
            case .address: update.address = trimmed
            case .city: update.city = trimmed
            case .state: update.state = trimmed
            case .zipcode: update.zipcode = trimmed
            case .website: update.website = trimmed
            case .linkedin: update.linkedin = trimmed
            case .twitter: update.twitter = trimmed
            case .instagram: update.instagram = trimmed
            case .facebook: update.facebook = trimmed
            case .profileVisibility: update.profileVisibility = trimmed
            case .showEmail: update.showEmail = trimmed == "true"
            case .showPhone: update.showPhone = trimmed == "true"
            }
        }
        return update
    }
    // swiftlint:enable cyclomatic_complexity
}
