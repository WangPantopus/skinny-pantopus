//
//  EditProfileViewModel+Skills.swift
//  Pantopus
//
//  The two Edit Profile legs that don't ride `PATCH /api/users/profile`:
//  the skills editor (`PUT /api/users/skills`,
//  `backend/routes/users.js:2246`, mounted at `backend/app.js:306`) and
//  the "Generate with AI" bio draft (`POST /api/ai/draft/post`,
//  `backend/routes/ai.js:218`, mounted at `backend/app.js:403`).
//
//  Skills are held as a working list on the view-model and committed by
//  `save()` next to the profile PATCH; the AI draft writes straight into
//  the bio field so it stays dirty-tracked and rides that PATCH.
//

import Foundation

/// "Generate with AI" leg state for the bio field. Separate from
/// `EditProfileState` for the same reason as the avatar: the form stays
/// usable while the draft is in flight, and a failed draft must not
/// blank the bio the user already typed.
public enum EditProfileBioDraftState: Sendable, Equatable {
    case idle
    case generating
    case failed(message: String)
}

extension EditProfileViewModel {
    /// `PUT /api/users/skills` caps the list at 50 entries and each entry
    /// at 100 characters (`backend/routes/users.js:2256-2263`).
    static let maxSkills = 50
    static let maxSkillLength = 100
    /// Joi `draftPostSchema` caps `text` at 2000 (`backend/routes/ai.js:82`).
    static let maxBioPromptLength = 2000

    // MARK: - Skills editor

    /// Commit the add-skill input to the working list. Mirrors the web
    /// editor (`frontend/apps/web/src/hooks/useProfileForm.ts:233`) and
    /// pre-applies the route's own trim / dedupe / cap rules so the CTA
    /// never sends something the server would reject.
    func addSkill() {
        let trimmed = skillDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard trimmed.count <= Self.maxSkillLength else {
            toast = ToastMessage(text: "Skills are capped at \(Self.maxSkillLength) characters.", kind: .error)
            return
        }
        guard skills.count < Self.maxSkills else {
            toast = ToastMessage(text: "You can list up to \(Self.maxSkills) skills.", kind: .error)
            return
        }
        // The route dedupes exactly; we match case-insensitively so the
        // chip row doesn't show "Plumbing" and "plumbing" side by side.
        guard !skills.contains(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame }) else {
            skillDraft = ""
            return
        }
        skills.append(trimmed)
        skillDraft = ""
    }

    /// Drop one skill from the working list (tap-to-remove on the chip).
    func removeSkill(_ skill: String) {
        skills.removeAll { $0 == skill }
    }

    /// Whether the add-skill CTA can fire — an empty input or a full list
    /// would only produce a no-op or a server rejection.
    var canAddSkill: Bool {
        let trimmed = skillDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && skills.count < Self.maxSkills
    }

    // MARK: - Generate bio with AI

    /// Whether "Generate with AI" can fire. False while a draft is in
    /// flight and false when the form carries nothing to prompt with —
    /// a CTA the server would refuse must not be tappable.
    var canGenerateBio: Bool {
        bioDraftState != .generating && !bioPrompt().isEmpty
    }

    /// Draft a bio through `POST /api/ai/draft/post` and write the result
    /// into the bio field, where it stays dirty-tracked and rides the
    /// existing profile PATCH. The prompt is composed only from what the
    /// user already entered — name, skills, tagline, city.
    func generateBio() async {
        guard bioDraftState != .generating else { return }
        let prompt = bioPrompt()
        guard !prompt.isEmpty else {
            bioDraftState = .failed(
                message: "Add your name, tagline, city or a skill first so the draft has something to work from."
            )
            return
        }
        guard NetworkMonitor.shared.isOnline else {
            bioDraftState = .failed(message: "You're offline. Try again when you're back online.")
            return
        }
        bioDraftState = .generating
        do {
            let response: AIPostDraftResponse = try await api.request(
                AIEndpoints.draftPost(AIDraftPostRequest(text: prompt))
            )
            let content = response.draft.content.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !content.isEmpty else {
                bioDraftState = .failed(message: "The draft came back empty. Try again.")
                return
            }
            // `update(_:to:)` re-runs the bio validator (max 2000, per
            // `updateProfileSchema`) and marks the field dirty.
            update(.bio, to: content)
            bioDraftState = .idle
        } catch {
            bioDraftState = .failed(
                message: (error as? APIError)?.errorDescription ?? "Couldn't draft a bio. Try again."
            )
        }
    }

    /// Clear a failed draft so the row returns to its resting pose.
    func dismissBioDraftError() {
        if case .failed = bioDraftState { bioDraftState = .idle }
    }

    /// Compose the draft prompt from the fields the user already filled.
    /// Returns "" when there is nothing to work with, so `canGenerateBio`
    /// can keep the CTA disabled instead of sending an empty prompt the
    /// route's `min(1)` rule would 400 on.
    func bioPrompt() -> String {
        func value(_ field: EditProfileField) -> String {
            (fields[field]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        }
        var lines: [String] = []
        let name = [value(.firstName), value(.lastName)]
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        if !name.isEmpty { lines.append("Name: \(name)") }
        let tagline = value(.tagline)
        if !tagline.isEmpty { lines.append("Tagline: \(tagline)") }
        let city = value(.city)
        if !city.isEmpty { lines.append("City: \(city)") }
        if !skills.isEmpty { lines.append("Skills: \(skills.joined(separator: ", "))") }
        guard !lines.isEmpty else { return "" }
        let instruction = "Write a short first-person profile bio (2-3 sentences) for this neighbor."
        return String(([instruction] + lines).joined(separator: "\n").prefix(Self.maxBioPromptLength))
    }
}
