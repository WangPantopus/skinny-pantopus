//
//  EditPersonaViewModel.swift
//  Pantopus
//
//  A13.12 — Backs the creator-facing Edit Beacon editor.
//
//  `load()` resolves the signed-in user's Beacon from
//  `GET /api/personas/me` (`backend/routes/personas.js:367`). When the
//  response carries `persona: null` the editor opens as an empty *create*
//  form; otherwise it opens pre-filled in *edit* mode.
//
//  `save()` mirrors RN `persona.tsx:424-524` exactly:
//    1. `POST /api/personas` (create) or `PATCH /api/personas/:id` (edit)
//    2. then the avatar upload, then the banner upload, each via
//       `POST /api/upload/persona-media/:id?type=…`
//  A media failure after a successful profile write keeps the saved
//  profile and surfaces "Profile details saved. Media still needs
//  attention." — the profile write is never rolled back.
//

import Foundation
import Observation

@Observable
@MainActor
public final class EditPersonaViewModel {
    public private(set) var state: EditPersonaState = .loading
    /// The live form. Bound directly by the view.
    public var form = EditPersonaForm()
    public private(set) var categories: [PersonaCategoryOption] = PersonaCategoryOption.fallback
    public private(set) var savePhase: EditPersonaSavePhase = .idle
    /// Inline banner under the sticky bar — success or failure copy.
    public private(set) var statusMessage: String?
    public private(set) var saveError: String?
    /// Set once a save lands so the caller can offer "View Beacon".
    public private(set) var savedHandle: String?

    private var loadedForm = EditPersonaForm()
    private let api: APIClient
    private let uploader: MultipartUploader

    init(api: APIClient = .shared, uploader: MultipartUploader = .shared) {
        self.api = api
        self.uploader = uploader
    }

    // MARK: - Derived

    public var isSaving: Bool {
        savePhase != .idle
    }

    public var isDirty: Bool {
        form != loadedForm
    }

    /// `handle` + `display_name` are the only server-required fields.
    public var isValid: Bool {
        !form.normalizedHandle.isEmpty
            && !form.displayName.trimmingCharacters(in: .whitespaces).isEmpty
            && !form.hasIncompleteLink
            && form.bio.count <= EditPersonaForm.bioLimit
    }

    public var isCreate: Bool {
        if case .editing(.create) = state { return true }
        return false
    }

    /// RN `saveButtonLabel` (`persona.tsx:525`).
    public var saveButtonLabel: String {
        switch savePhase {
        case .avatar: "Uploading avatar..."
        case .banner: "Uploading banner..."
        case .profile: "Saving profile..."
        case .idle: isCreate ? "Publish Beacon" : "Save Beacon"
        }
    }

    public var canAddLink: Bool {
        form.links.count < EditPersonaForm.linkLimit
    }

    // MARK: - Loading

    public func load() async {
        state = .loading
        saveError = nil
        statusMessage = nil
        do {
            let me: PersonaMeResponse = try await api.request(AudienceProfileEndpoints.me)
            if let persona = me.persona {
                form = EditPersonaForm.from(persona)
                loadedForm = form
                state = .editing(.edit(personaId: persona.id))
            } else {
                form = EditPersonaForm()
                loadedForm = form
                state = .editing(.create)
            }
        } catch {
            state = .error(message: Self.message(for: error, fallback: "Beacon could not load."))
            return
        }
        await loadCategories()
    }

    public func refresh() async {
        await load()
    }

    /// Best-effort — the fallback ladder already covers the low-risk
    /// categories, so a failure here never blocks editing.
    private func loadCategories() async {
        guard let response = try? await api.request(
            PersonaEditEndpoints.categories,
            as: PersonaCategoryPoliciesResponse.self
        ) else { return }
        let options = response.categories.map { policy in
            PersonaCategoryOption(
                value: policy.category,
                label: Self.titleCase(policy.label ?? policy.category),
                isEnabled: policy.enabled ?? true,
                isSensitive: policy.sensitive ?? false,
                requirements: policy.requirements ?? []
            )
        }
        if !options.isEmpty { categories = options }
    }

    // MARK: - Editing intents

    public func setCategory(_ value: String) {
        form.category = value
        clearStatus()
    }

    public func setAudienceLabel(_ value: PersonaAudienceLabel) {
        form.audienceLabel = value
        clearStatus()
    }

    public func setAudienceMode(_ value: PersonaAudienceMode) {
        form.audienceMode = value
        clearStatus()
    }

    public func addLink() {
        guard canAddLink else { return }
        form.links.append(PersonaLinkDraft())
        clearStatus()
    }

    public func removeLink(id: String) {
        form.links.removeAll { $0.id == id }
        clearStatus()
    }

    public func updateLink(id: String, label: String? = nil, url: String? = nil) {
        guard let index = form.links.firstIndex(where: { $0.id == id }) else { return }
        if let label { form.links[index].label = label }
        if let url { form.links[index].url = url }
        clearStatus()
    }

    public func attachAvatar(_ pick: PersonaImagePick) {
        form.avatarPick = pick
        clearStatus()
    }

    public func attachBanner(_ pick: PersonaImagePick) {
        form.bannerPick = pick
        clearStatus()
    }

    public func removeAvatarPick() {
        form.avatarPick = nil
        clearStatus()
    }

    public func removeBannerPick() {
        form.bannerPick = nil
        clearStatus()
    }

    // MARK: - Save

    /// Create or update the Beacon, then push any picked images. Returns
    /// the saved handle on full success so the caller can route to the
    /// public profile; nil when anything failed.
    @discardableResult
    public func save() async -> String? {
        guard case let .editing(mode) = state, !isSaving else { return nil }
        saveError = nil
        statusMessage = nil
        savedHandle = nil

        guard !form.normalizedHandle.isEmpty,
              !form.displayName.trimmingCharacters(in: .whitespaces).isEmpty else {
            saveError = "Add a handle and display name first."
            return nil
        }
        guard !form.hasIncompleteLink else {
            saveError = "Each public link needs both a label and a URL."
            return nil
        }

        savePhase = .profile
        let personaId: String
        do {
            let endpoint: Endpoint = switch mode {
            case .create:
                PersonaEditEndpoints.create(form.wireBody)
            case let .edit(existingId):
                PersonaEditEndpoints.update(personaId: existingId, body: form.wireBody)
            }
            let response: PersonaWriteResponse = try await api.request(endpoint)
            guard let persona = response.persona else {
                savePhase = .idle
                saveError = "Beacon saved, but the server returned no profile."
                return nil
            }
            personaId = persona.id
            applySaved(persona, mode: .edit(personaId: persona.id))
        } catch {
            savePhase = .idle
            saveError = Self.message(for: error, fallback: "Could not save Beacon. Please try again.")
            return nil
        }

        // Media legs. RN keeps the profile save even when an upload fails.
        do {
            if let pick = form.avatarPick {
                savePhase = .avatar
                let response = try await uploader.uploadPersonaMedia(
                    personaId: personaId,
                    kind: .avatar,
                    file: MultipartFile(
                        fieldName: "file",
                        filename: pick.fileName,
                        mimeType: pick.mimeType,
                        data: pick.data
                    )
                )
                form.avatarURL = response.url
                form.avatarPick = nil
            }
            if let pick = form.bannerPick {
                savePhase = .banner
                let response = try await uploader.uploadPersonaMedia(
                    personaId: personaId,
                    kind: .banner,
                    file: MultipartFile(
                        fieldName: "file",
                        filename: pick.fileName,
                        mimeType: pick.mimeType,
                        data: pick.data
                    )
                )
                form.bannerURL = response.url
                form.bannerPick = nil
            }
        } catch {
            loadedForm = form
            savePhase = .idle
            statusMessage = "Profile details saved. Media still needs attention."
            saveError = Self.message(for: error, fallback: "Please try the image upload again.")
            return nil
        }

        loadedForm = form
        savePhase = .idle
        let message = mode.isCreate ? "Beacon created." : "Beacon saved."
        statusMessage = message
        savedHandle = form.normalizedHandle
        return form.normalizedHandle
    }

    // MARK: - Helpers

    private func applySaved(_ persona: PersonaSummaryDTO, mode: EditPersonaMode) {
        // Keep any not-yet-uploaded picks; take everything else from the
        // server so a normalised handle / trimmed bio round-trips.
        let avatarPick = form.avatarPick
        let bannerPick = form.bannerPick
        var next = EditPersonaForm.from(persona)
        next.avatarPick = avatarPick
        next.bannerPick = bannerPick
        form = next
        loadedForm = next
        state = .editing(mode)
    }

    private func clearStatus() {
        statusMessage = nil
        saveError = nil
    }

    static func titleCase(_ value: String) -> String {
        value
            .replacingOccurrences(of: "_", with: " ")
            .split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }

    static func message(for error: any Error, fallback: String) -> String {
        if let apiError = error as? APIError, let description = apiError.errorDescription {
            return description
        }
        if let localized = error as? any LocalizedError, let description = localized.errorDescription {
            return description
        }
        return fallback
    }
}
