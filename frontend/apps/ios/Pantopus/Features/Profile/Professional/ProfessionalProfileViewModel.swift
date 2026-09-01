//
//  ProfessionalProfileViewModel.swift
//  Pantopus
//
//  A.5 (A13.11) / P1-F — drives the Professional Profile editor.
//
//  The production initializer hydrates from `GET /api/professional/profile/me`
//  (route `professional.js:164`) plus `GET /api/professional/verification/status`
//  (route `professional.js:372`). The backend record is intentionally thin
//  (headline / categories / pricing / verification), so the editor maps the
//  overlapping fields — title ← headline, skills ← categories, the
//  verification pill ← verification_status, and the visibility toggles ←
//  is_public / is_active. Sections the backend doesn't store on `profile/me`
//  (company name, certifications, portfolio) start empty until their
//  dedicated endpoints are wired. Save issues a best-effort `PATCH
//  /profile/me` for the safe fields (headline + public/active flags);
//  `categories` is enum-constrained server-side so free-text skills are not
//  written here.
//
//  Previews / tests still seed deterministic content via `init(seed:)` /
//  `init(simulateFailure:)`, bypassing the network.
//

import Foundation
import Observation

// The professional editor holds the whole form — categories, pricing, service
// area and verification — in one observable object, matching Android's single
// ProfessionalProfileViewModel. Splitting it would fork the parity contract.
// swiftlint:disable file_length type_body_length
@Observable
@MainActor
public final class ProfessionalProfileViewModel {
    public private(set) var state: ProfessionalProfileState = .loading
    /// Surfaced by the view after submit / discard; cleared on auto-dismiss.
    public var toast: ToastMessage?
    /// Drives the destructive "Disable professional mode?" confirm.
    public var showsDisableConfirm = false
    /// True while `DELETE /profile/me` is in flight.
    public private(set) var isDisabling = false

    /// Live working copy + the last-saved baseline used by Discard.
    private var content: ProfessionalProfileContent?
    private var baseline: ProfessionalProfileContent?
    /// Working copy for the enable (create / re-enable) form.
    private var draft: ProfessionalEnableDraft?

    private let api: APIClient
    private let mode: Mode

    private enum Mode {
        case live
        case sample(seed: ProfessionalProfileContent, baseline: ProfessionalProfileContent)
        case failure
    }

    /// Production initializer — live `GET /api/professional/profile/me`.
    /// Public-safe: no `APIClient` parameter (the client is module-internal).
    public convenience init() {
        self.init(api: .shared)
    }

    /// Designated live initializer. `api` injectable for tests.
    init(api: APIClient) {
        self.api = api
        mode = .live
    }

    /// Sample/preview path. `baseline` defaults to `seed`; pass `.published`
    /// when seeding the pending frame so Discard rolls back to the clean copy.
    public init(seed: ProfessionalProfileContent, baseline: ProfessionalProfileContent? = nil) {
        api = .shared
        mode = .sample(seed: seed, baseline: baseline ?? seed)
    }

    /// Failure path — `load()` resolves to `.error` (previews / tests).
    public init(simulateFailure: Bool) {
        api = .shared
        mode = simulateFailure ? .failure : .live
    }

    // MARK: - Loading

    public func load() async {
        state = .loading
        switch mode {
        case .failure:
            state = .error(message: "We couldn't load your professional profile.")
        case let .sample(seed, base):
            content = seed
            baseline = base
            recompute()
        case .live:
            await fetchLive()
        }
    }

    public func refresh() async {
        await load()
    }

    private func fetchLive() async {
        do {
            let response: ProfessionalProfileResponse = try await api.request(
                ProfessionalEndpoints.profileMe()
            )
            // `profile: null` (200) means professional mode has never been
            // enabled; `is_active: false` means it was disabled. Both are the
            // create state, not an error — RN `professional.tsx:100`.
            guard let profile = response.profile, profile.isActive != false else {
                enterCreateMode(from: response.profile)
                return
            }
            await hydrate(profile)
        } catch {
            // Older deployments 404 `profile/me` instead of returning null —
            // still the create state, not a failure.
            if let apiError = error as? APIError, case .notFound = apiError {
                enterCreateMode(from: nil)
                return
            }
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "We couldn't load your professional profile."
            )
        }
    }

    /// Map an **active** backend record into the editor and render it.
    private func hydrate(_ profile: ProfessionalProfileDTO) async {
        let verification: ProfessionalVerificationStatusResponse? = try? await api.request(
            ProfessionalEndpoints.verificationStatus()
        )
        let mapped = Self.makeContent(
            from: profile,
            verification: verification,
            proName: currentProName()
        )
        draft = nil
        content = mapped
        baseline = mapped
        recompute()
    }

    /// Switch to the "professional mode is off" form, seeded from a
    /// soft-disabled record when one exists.
    private func enterCreateMode(from dto: ProfessionalProfileDTO?) {
        content = nil
        baseline = nil
        let seeded = ProfessionalEnableDraft.from(dto)
        draft = seeded
        state = .create(seeded)
    }

    private func currentProName() -> String {
        if case let .signedIn(user) = AuthManager.shared.state {
            return user.displayName ?? ""
        }
        return ""
    }

    // MARK: - Enable / disable professional mode

    public func updateDraftHeadline(_ value: String) {
        mutateDraft { $0.headline = String(value.prefix(200)) }
    }

    public func updateDraftBio(_ value: String) {
        mutateDraft { $0.bio = String(value.prefix(2000)) }
    }

    public func updateDraftCity(_ value: String) {
        mutateDraft { $0.city = value }
    }

    public func updateDraftState(_ value: String) {
        mutateDraft { $0.state = value }
    }

    public func updateDraftRadius(_ value: String) {
        mutateDraft { $0.radiusKm = String(value.filter(\.isNumber).prefix(3)) }
    }

    public func updateDraftHourlyRate(_ value: String) {
        mutateDraft { $0.hourlyRate = value.filter { $0.isNumber || $0 == "." } }
    }

    public func setDraftPublic(_ isOn: Bool) {
        mutateDraft { $0.isPublic = isOn }
    }

    /// Add/remove a category, capped at the server's 5 (`professional.js:45`).
    public func toggleDraftCategory(_ key: String) {
        mutateDraft { draft in
            if let index = draft.categories.firstIndex(of: key) {
                draft.categories.remove(at: index)
            } else if draft.canSelectMoreCategories {
                draft.categories.append(key)
            }
        }
    }

    /// Turn professional mode on. A never-created profile goes through
    /// `POST /api/professional/profile`; a soft-disabled one is switched
    /// back on with `PATCH /profile/me { is_active: true }` — same split as
    /// RN `professional.tsx:141`.
    public func enable() async {
        guard var working = draft, !working.isSubmitting else { return }
        working.isSubmitting = true
        working.errorMessage = nil
        draft = working
        state = .create(working)

        let endpoint = working.isReEnable
            ? ProfessionalEndpoints.updateProfileMe(Self.updateRequest(from: working))
            : ProfessionalEndpoints.createProfile(Self.enableRequest(from: working))
        do {
            let response: ProfessionalProfileResponse = try await api.request(endpoint)
            if let profile = response.profile {
                await hydrate(profile)
            } else {
                await fetchLive()
            }
            toast = ToastMessage(text: "Professional mode enabled", kind: .success)
        } catch {
            let message = (error as? APIError)?.errorDescription
                ?? "Failed to enable professional mode"
            working.isSubmitting = false
            working.errorMessage = message
            draft = working
            state = .create(working)
            toast = ToastMessage(text: message, kind: .error)
        }
    }

    /// Open the destructive confirm — nothing is sent until it's accepted.
    public func requestDisable() {
        showsDisableConfirm = true
    }

    /// `DELETE /api/professional/profile/me` — soft-disable. The row
    /// survives, so the screen drops back into the re-enable form.
    public func disableConfirmed() async {
        guard !isDisabling else { return }
        isDisabling = true
        defer { isDisabling = false }
        do {
            let response: ProfessionalProfileResponse = try await api.request(
                ProfessionalEndpoints.disableProfile()
            )
            enterCreateMode(from: response.profile)
            toast = ToastMessage(text: "Professional mode disabled", kind: .neutral)
        } catch {
            toast = ToastMessage(text: "Could not disable", kind: .error)
        }
    }

    /// Body for the first-time enable (`POST /profile`).
    static func enableRequest(from draft: ProfessionalEnableDraft) -> ProfessionalEnableRequest {
        ProfessionalEnableRequest(
            headline: trimmedOrNil(draft.headline),
            bio: trimmedOrNil(draft.bio),
            categories: draft.categories.isEmpty ? nil : draft.categories,
            serviceArea: serviceArea(from: draft),
            pricingMeta: pricing(from: draft),
            isPublic: draft.isPublic
        )
    }

    /// Body for re-enabling a soft-disabled row (`PATCH /profile/me`).
    static func updateRequest(from draft: ProfessionalEnableDraft) -> ProfessionalProfileUpdateRequest {
        ProfessionalProfileUpdateRequest(
            headline: trimmedOrNil(draft.headline),
            bio: trimmedOrNil(draft.bio),
            isPublic: draft.isPublic,
            isActive: true,
            categories: draft.categories.isEmpty ? nil : draft.categories,
            serviceArea: serviceArea(from: draft),
            pricingMeta: pricing(from: draft)
        )
    }

    private static func serviceArea(from draft: ProfessionalEnableDraft) -> ProfessionalServiceAreaInput? {
        // Joi caps radius at 1…500 (`professional.js:50`) — a blank or
        // out-of-range field would fail validation for the whole request.
        let radius = min(max(Int(draft.radiusKm) ?? 50, 1), 500)
        let area = ProfessionalServiceAreaInput(
            city: trimmedOrNil(draft.city),
            state: trimmedOrNil(draft.state),
            radiusKm: radius
        )
        return area.isEmpty ? nil : area
    }

    private static func pricing(from draft: ProfessionalEnableDraft) -> ProfessionalPricingInput? {
        guard let rate = Double(draft.hourlyRate), rate > 0 else { return nil }
        return ProfessionalPricingInput(hourlyRate: rate, currency: "USD")
    }

    private static func trimmedOrNil(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func mutateDraft(_ transform: (inout ProfessionalEnableDraft) -> Void) {
        guard var working = draft else { return }
        transform(&working)
        working.errorMessage = nil
        draft = working
        state = .create(working)
    }

    // MARK: - Field edits

    public func updateTitle(_ value: String) {
        mutate { $0.title.value = value
            $0.title.touched = true
        }
    }

    public func updateYearsInRole(_ value: String) {
        let digitsOnly = value.filter(\.isNumber)
        mutate { $0.yearsInRole.value = digitsOnly
            $0.yearsInRole.touched = true
        }
    }

    public func setVisibility(_ id: String, isOn: Bool) {
        mutate { content in
            guard let index = content.visibility.firstIndex(where: { $0.id == id }) else { return }
            content.visibility[index].isOn = isOn
        }
    }

    /// Add/remove a backend category on an **active** profile, capped at
    /// the server's 5 (`professional.js:45`). The Skills chips are the
    /// rendered projection of `categories`, so both move together.
    public func toggleCategory(_ key: String) {
        mutate { content in
            if let index = content.categories.firstIndex(of: key) {
                content.categories.remove(at: index)
                content.skills.removeAll { $0.id == key }
            } else if content.canSelectMoreCategories {
                content.categories.append(key)
                content.skills.append(
                    ProSkill(
                        id: key,
                        label: Self.categoryLabel(key),
                        icon: Self.categoryIcon(key)
                    )
                )
            }
        }
    }

    public func updateServiceCity(_ value: String) {
        mutate { $0.serviceCity.value = value
            $0.serviceCity.touched = true
        }
    }

    public func updateServiceState(_ value: String) {
        mutate { $0.serviceState.value = value
            $0.serviceState.touched = true
        }
    }

    public func updateServiceRadius(_ value: String) {
        let digitsOnly = String(value.filter(\.isNumber).prefix(3))
        mutate { $0.serviceRadiusKm.value = digitsOnly
            $0.serviceRadiusKm.touched = true
        }
    }

    public func updateHourlyRate(_ value: String) {
        let filtered = value.filter { $0.isNumber || $0 == "." }
        mutate { $0.hourlyRate.value = filtered
            $0.hourlyRate.touched = true
        }
    }

    public func removeSkill(_ id: String) {
        mutate {
            $0.skills.removeAll { $0.id == id }
            // Live skill ids are backend category keys — keep the two in
            // sync so the PATCH drops the category too.
            $0.categories.removeAll { $0 == id }
        }
    }

    public func removeCertification(_ id: String) {
        mutate { $0.certifications.removeAll { $0.id == id } }
    }

    /// Append a fresh trade chip. The point is to exercise the fresh-dot +
    /// verified→pending transition.
    public func addSkill() {
        mutate {
            $0.skills.append(
                ProSkill(id: "skill-\(UUID().uuidString)", label: "New skill", icon: .plus, isFresh: true)
            )
        }
    }

    /// Append a fresh, pending certification placeholder.
    public func addCertification() {
        mutate {
            $0.certifications.append(
                Certification(
                    id: "cert-\(UUID().uuidString)",
                    name: "New certification",
                    issuer: "Awaiting upload",
                    issued: "—",
                    expires: "—",
                    status: .pending,
                    isFresh: true
                )
            )
        }
    }

    /// Append a fresh portfolio link whose preview is still resolving.
    public func addPortfolioLink() {
        mutate {
            $0.portfolio.append(
                PortfolioLink(
                    id: "link-\(UUID().uuidString)",
                    host: "link",
                    title: "New link",
                    url: "Fetching preview…",
                    state: .loading,
                    isFresh: true
                )
            )
        }
    }

    // MARK: - Commit / revert

    /// Revert all unsaved edits back to the last-saved baseline.
    public func discard() {
        guard let baseline else { return }
        content = baseline
        recompute()
        toast = ToastMessage(text: "Edits discarded.", kind: .neutral)
    }

    /// Submit edits for verification. Commits the working copy as the new
    /// baseline (clearing dirty/fresh markers); pending claim statuses stay
    /// pending — they await server confirmation. On the live path this also
    /// fires a best-effort `PATCH /profile/me` for the safe fields.
    public func saveAndSubmit() {
        guard var working = content, working.isDirty else { return }
        let pending = working.pendingCount
        working.title.commit()
        working.yearsInRole.commit()
        working.serviceCity.commit()
        working.serviceState.commit()
        working.serviceRadiusKm.commit()
        working.hourlyRate.commit()
        working.originalCategories = working.categories
        working.company.isDirty = false
        for index in working.skills.indices {
            working.skills[index].isFresh = false
        }
        for index in working.certifications.indices {
            working.certifications[index].isFresh = false
        }
        for index in working.portfolio.indices {
            working.portfolio[index].isFresh = false
        }
        for index in working.visibility.indices {
            working.visibility[index].originalOn = working.visibility[index].isOn
        }
        content = working
        baseline = working
        recompute()
        if case .live = mode { persist(working) }
        toast = ToastMessage(
            text: pending > 0
                ? "Submitted — \(pending) \(pending == 1 ? "claim" : "claims") in review."
                : "Professional profile published.",
            kind: .success
        )
    }

    /// Write the editable backend fields with `PATCH /profile/me`
    /// (`professional.js:190`) — headline, public/active flags, and the
    /// three RN also writes: `categories[]`, `service_area.city/state/
    /// radius_km` and `pricing_meta.hourly_rate/currency`
    /// (`professional.tsx:123`).
    private func persist(_ content: ProfessionalProfileContent) {
        let request = Self.updateRequest(from: content)
        let api = api
        // Inherits this type's `@MainActor` isolation, so the toast
        // assignment below is already on the main actor.
        Task {
            do {
                _ = try await api.request(
                    ProfessionalEndpoints.updateProfileMe(request),
                    as: ProfessionalProfileResponse.self
                )
            } catch {
                toast = ToastMessage(
                    text: (error as? APIError)?.errorDescription ?? "Couldn't save your profile.",
                    kind: .error
                )
            }
        }
    }

    /// Body for the active-profile save. Empty text fields are omitted
    /// rather than sent blank — Joi rejects an out-of-range radius and an
    /// empty `service_area` object outright (`professional.js:67`).
    static func updateRequest(from content: ProfessionalProfileContent) -> ProfessionalProfileUpdateRequest {
        let radius = min(max(Int(content.serviceRadiusKm.value) ?? 50, 1), 500)
        let area = ProfessionalServiceAreaInput(
            city: trimmedOrNil(content.serviceCity.value),
            state: trimmedOrNil(content.serviceState.value),
            radiusKm: radius
        )
        let rate = Double(content.hourlyRate.value)
        return ProfessionalProfileUpdateRequest(
            headline: content.title.value,
            isPublic: content.visibility.first { $0.id == "publicProfile" }?.isOn,
            isActive: content.visibility.first { $0.id == "activeForHire" }?.isOn,
            categories: content.categories,
            serviceArea: area.isEmpty ? nil : area,
            pricingMeta: (rate ?? 0) > 0 ? ProfessionalPricingInput(hourlyRate: rate, currency: "USD") : nil
        )
    }

    // MARK: - Verification

    /// `POST /api/professional/verification/start` (`professional.js:310`)
    /// — RN's "Start verification" CTA (`professional.tsx:386`), which
    /// sends tier 1 and reloads the profile on success.
    public func startVerification(tier: Int = 1) async {
        guard case .live = mode else { return }
        guard var working = content, !working.verification.isStarting else { return }
        working.verification.isStarting = true
        content = working
        recompute()
        do {
            let response: ProfessionalVerificationStartResponse = try await api.request(
                ProfessionalEndpoints.startVerification(ProfessionalVerificationStartRequest(tier: tier))
            )
            toast = ToastMessage(text: response.message ?? "Verification started", kind: .success)
            await load()
        } catch {
            working.verification.isStarting = false
            content = working
            recompute()
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Failed to start verification",
                kind: .error
            )
        }
    }

    // MARK: - Mapping (pure — unit-test surface)

    /// Project the backend professional record into editor content. Fields
    /// the backend doesn't store on `profile/me` start empty.
    public static func makeContent(
        from dto: ProfessionalProfileDTO?,
        verification: ProfessionalVerificationStatusResponse?,
        proName: String
    ) -> ProfessionalProfileContent {
        let status = verificationStatus(dto?.verificationStatus ?? verification?.status)
        let locality = [dto?.serviceArea?.city, dto?.serviceArea?.state]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        let categories = dto?.categories ?? []
        let skills = categories.map {
            ProSkill(id: $0, label: categoryLabel($0), icon: categoryIcon($0))
        }
        let rate = dto?.pricingMeta?.hourlyRate
        return ProfessionalProfileContent(
            proName: proName,
            strength: strength(for: dto),
            title: FormFieldState(id: "title", originalValue: dto?.headline ?? ""),
            yearsInRole: FormFieldState(id: "yearsInRole", originalValue: ""),
            company: CompanyClaim(name: "", locality: locality, status: status),
            skills: skills,
            certifications: [],
            portfolio: [],
            visibility: visibilityRows(isPublic: dto?.isPublic ?? false, isActive: dto?.isActive ?? false),
            categories: categories,
            serviceCity: FormFieldState(id: "serviceCity", originalValue: dto?.serviceArea?.city ?? ""),
            serviceState: FormFieldState(id: "serviceState", originalValue: dto?.serviceArea?.state ?? ""),
            serviceRadiusKm: FormFieldState(
                id: "serviceRadiusKm",
                originalValue: dto?.serviceArea?.radiusKm.map { String(Int($0)) } ?? ""
            ),
            hourlyRate: FormFieldState(
                id: "hourlyRate",
                originalValue: rate.map { $0 == $0.rounded() ? String(Int($0)) : String($0) } ?? ""
            ),
            verification: ProVerificationSummary(
                status: status,
                tier: dto?.verificationTier ?? verification?.tier
            )
        )
    }

    static func verificationStatus(_ raw: String?) -> ProVerificationStatus {
        switch raw {
        case "verified": .verified
        case "pending": .pending
        default: .unverified
        }
    }

    /// `pet_care` → `Pet Care`, using the server's category catalogue so
    /// special-cased labels (`hvac` → `HVAC`) read correctly.
    static func categoryLabel(_ key: String) -> String {
        ProfessionalCategory.label(for: key)
    }

    static func categoryIcon(_ key: String) -> PantopusIcon {
        switch key {
        case "plumber": .droplet
        case "electrician": .zap
        case "carpentry": .hammer
        case "cleaning": .sparkles
        case "pet_care", "childcare", "elder_care": .users
        default: .wrench
        }
    }

    /// Coarse 0–100 completeness heuristic — the backend record has no
    /// strength field, so it's derived from filled fields + verification.
    static func strength(for dto: ProfessionalProfileDTO?) -> Int {
        guard let dto else { return 0 }
        var score = 40
        if !(dto.headline ?? "").isEmpty { score += 15 }
        if !(dto.bio ?? "").isEmpty { score += 10 }
        if !(dto.categories ?? []).isEmpty { score += 15 }
        switch dto.verificationStatus {
        case "verified": score += 20
        case "pending": score += 10
        default: break
        }
        return min(score, 100)
    }

    private static func visibilityRows(isPublic: Bool, isActive: Bool) -> [ProVisibilityRow] {
        [
            ProVisibilityRow(
                id: "publicProfile",
                label: "Public profile",
                sub: "Neighbors can open your professional profile from search and gigs.",
                isOn: isPublic
            ),
            ProVisibilityRow(
                id: "activeForHire",
                label: "Active for hire",
                sub: "Show as available to take on new work.",
                isOn: isActive
            )
        ]
    }

    // MARK: - Private

    private func mutate(_ transform: (inout ProfessionalProfileContent) -> Void) {
        guard var working = content else { return }
        transform(&working)
        content = working
        recompute()
    }

    private func recompute() {
        guard let content else { state = .loading
            return
        }
        let dirty = content.dirtyCount
        state = dirty == 0
            ? .verified(content)
            : .pending(content, dirtyCount: dirty, pendingCount: content.pendingCount)
    }
}

// swiftlint:enable type_body_length
