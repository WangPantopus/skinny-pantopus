//
//  PrivacyHandshakeViewModel.swift
//  Pantopus
//
//  T3.4 Privacy Handshake — VM that conforms to WizardModel so it
//  plugs into the shared WizardShell chrome. Owns the two-step
//  state machine (handle entry → tier selection) plus the three
//  terminal cases (free success, paid → opens Checkout, already
//  member).
//

// swiftlint:disable type_body_length

import Foundation
import Observation

@Observable
@MainActor
public final class PrivacyHandshakeViewModel: WizardModel {
    public private(set) var state: HandshakeUiState = .loading

    private let api: APIClient
    private let onDismiss: @MainActor () -> Void
    private let personaHandle: String
    /// When opening from a locked broadcast, pre-select the post's
    /// `target_tier_rank` on the tier-selection step.
    private let preselectedTierRank: Int?

    private var ready: HandshakeReadyContent?
    private var isSubmitting: Bool = false

    init(
        personaHandle: String,
        preselectedTierRank: Int? = nil,
        api: APIClient = .shared,
        onDismiss: @escaping @MainActor () -> Void = {}
    ) {
        self.personaHandle = personaHandle
        self.preselectedTierRank = preselectedTierRank
        self.api = api
        self.onDismiss = onDismiss
    }

    public func load() async {
        state = .loading
        do {
            let personaResp: PersonaMeResponse =
                try await api.request(PrivacyHandshakeEndpoints.persona(handle: personaHandle))
            guard let persona = personaResp.persona else {
                state = .error(message: "Public Profile not found.")
                return
            }
            let tiersResp: PersonaTiersResponse =
                try await api.request(PrivacyHandshakeEndpoints.tiers(handle: personaHandle))
            let suggestion: FanHandleSuggestionResponse =
                try await api.request(PrivacyHandshakeEndpoints.fanHandleSuggestion(handle: personaHandle))
            let followStatus: FollowStatusResponse =
                try await api.request(PrivacyHandshakeEndpoints.followStatus(personaId: persona.id))

            let preview = Self.previewFrom(persona: persona)
            let tierOptions = tiersResp.tiers.map(Self.option)
            let isMember = followStatus.following == true
                || (followStatus.status ?? "") == "active"
            let initialHandle = HandshakeHandleState(
                value: suggestion.suggestion ?? "",
                locked: suggestion.locked ?? false
            )
            let defaultRank = preselectedTierRank
                ?? tierOptions.first { $0.rank == 1 }?.rank
                ?? tierOptions.first?.rank ?? 1
            let content = HandshakeReadyContent(
                persona: preview,
                tierOptions: tierOptions,
                step: isMember ? .alreadyMember : .handleEntry,
                handle: initialHandle,
                selectedTierRank: defaultRank
            )
            ready = content
            state = .ready(content)
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't open Privacy Handshake."
            state = .error(message: message)
        }
    }

    // MARK: - User actions

    /// Text-field edit. The view binds the field through this so the
    /// VM owns the validation state.
    public func setHandle(_ value: String) {
        guard var current = ready else { return }
        var handle = current.handle
        handle.value = value
        handle.error = nil
        handle.matchesUsername = false // server-derived; cleared on edit
        current = HandshakeReadyContent(
            persona: current.persona,
            tierOptions: current.tierOptions,
            step: current.step,
            handle: handle,
            selectedTierRank: current.selectedTierRank
        )
        ready = current
        state = .ready(current)
    }

    public func setAcknowledgedUsingUsername(_ value: Bool) {
        guard var current = ready else { return }
        var handle = current.handle
        handle.acknowledgedUsingUsername = value
        current = HandshakeReadyContent(
            persona: current.persona,
            tierOptions: current.tierOptions,
            step: current.step,
            handle: handle,
            selectedTierRank: current.selectedTierRank
        )
        ready = current
        state = .ready(current)
    }

    public func selectTier(rank: Int) {
        guard var current = ready else { return }
        current = HandshakeReadyContent(
            persona: current.persona,
            tierOptions: current.tierOptions,
            step: current.step,
            handle: current.handle,
            selectedTierRank: rank
        )
        ready = current
        state = .ready(current)
    }

    // MARK: - WizardModel

    public var chrome: WizardChrome {
        guard let current = ready else {
            return WizardChrome(
                title: "Privacy Handshake",
                progressLabel: .stepOf(current: 1, total: 2),
                progressFraction: 0,
                leading: .close,
                primaryCTALabel: "Continue",
                primaryCTAEnabled: false,
                isSubmitting: false,
                dirty: false,
                showsProgressBar: true
            )
        }
        switch current.step {
        case .handleEntry:
            return WizardChrome(
                title: "Privacy Handshake",
                progressLabel: .stepOf(current: 1, total: 2),
                progressFraction: 0.5,
                leading: .close,
                primaryCTALabel: "Continue",
                primaryCTAEnabled: current.handle.isValid
                    && (!current.handle.matchesUsername || current.handle.acknowledgedUsingUsername),
                isSubmitting: false,
                // Wizard is short enough that nothing the user has
                // typed yet is worth a discard-confirm dialog —
                // close should just silently dismiss.
                dirty: false,
                showsProgressBar: true
            )
        case .tierSelection, .submitting:
            let tier = current.selectedTier
            let label: String
            if let tier {
                if tier.isFree {
                    let singular = Self.singularizeAudienceLabel(current.persona.audienceLabel)
                    label = "Become a \(singular)"
                } else {
                    label = "Continue · \(tier.priceLabel)"
                }
            } else {
                label = "Continue"
            }
            return WizardChrome(
                title: "Privacy Handshake",
                progressLabel: .stepOf(current: 2, total: 2),
                progressFraction: 1.0,
                leading: .back,
                primaryCTALabel: label,
                primaryCTAEnabled: tier != nil,
                isSubmitting: current.step == .submitting,
                dirty: false,
                showsProgressBar: true
            )
        case .opensCheckout:
            return WizardChrome(
                title: "Opening Checkout",
                progressLabel: .hidden,
                progressFraction: nil,
                leading: .close,
                primaryCTALabel: "Opening Checkout…",
                primaryCTAEnabled: false,
                isSubmitting: true,
                dirty: false,
                showsProgressBar: false
            )
        case .completedFree:
            return WizardChrome(
                title: "You're following",
                progressLabel: .hidden,
                progressFraction: nil,
                leading: .close,
                primaryCTALabel: "Done",
                primaryCTAEnabled: true,
                secondaryCTA: WizardSecondaryCTA(
                    label: "Manage notifications",
                    identifier: "handshakeManageNotifications"
                ),
                isSubmitting: false,
                dirty: false,
                showsProgressBar: false
            )
        case .alreadyMember:
            return WizardChrome(
                title: "Already a follower",
                progressLabel: .hidden,
                progressFraction: nil,
                leading: .close,
                primaryCTALabel: "Done",
                primaryCTAEnabled: true,
                secondaryCTA: WizardSecondaryCTA(
                    label: "Manage notifications",
                    identifier: "handshakeManageNotifications"
                ),
                isSubmitting: false,
                dirty: false,
                showsProgressBar: false
            )
        }
    }

    public func leadingTapped() {
        guard let current = ready else { onDismiss()
            return
        }
        switch current.step {
        case .tierSelection:
            transition(to: .handleEntry)
        default:
            onDismiss()
        }
    }

    public func discardConfirmed() {
        onDismiss()
    }

    public func primaryTapped() {
        guard let current = ready else { return }
        switch current.step {
        case .handleEntry:
            transition(to: .tierSelection)
        case .tierSelection:
            submitHandshake()
        case .opensCheckout, .submitting:
            break
        case .completedFree, .alreadyMember:
            onDismiss()
        }
    }

    public func secondaryTapped() {
        // The success steps expose "Manage notifications" — the host
        // routes that to the notification preferences sheet. No
        // network call from here.
        onDismiss()
    }

    // MARK: - Network

    private func submitHandshake() {
        guard let current = ready, !isSubmitting else { return }
        guard let tier = current.selectedTier else { return }
        guard current.handle.isValid else {
            var handle = current.handle
            handle.error = "Handle must be 3–40 letters, numbers, dots, dashes, or underscores."
            update(handle: handle)
            return
        }
        isSubmitting = true
        transition(to: .submitting)
        let body = HandshakeBody(
            tierRank: tier.rank,
            fanHandle: current.handle.value.trimmingCharacters(in: .whitespacesAndNewlines),
            fanDisplayName: nil,
            fanAvatarUrl: nil,
            acknowledgedPlatformTrust: true,
            acknowledgedUsingPantopusUsername: current.handle.matchesUsername
                ? current.handle.acknowledgedUsingUsername
                : nil
        )
        Task { @MainActor in
            do {
                let response: HandshakeSubmitResponse =
                    try await api.request(
                        PrivacyHandshakeEndpoints.submit(personaId: current.persona.id, body: body)
                    )
                isSubmitting = false
                if response.requiresPayment == true, let url = response.subscribeUrl {
                    transition(to: .opensCheckout(subscribeUrl: url))
                } else if (response.follow?.status ?? response.status) == "active" {
                    transition(to: .completedFree)
                } else {
                    transition(to: .completedFree)
                }
            } catch {
                isSubmitting = false
                handleSubmitError(error)
            }
        }
    }

    private func handleSubmitError(_ error: any Error) {
        guard var current = ready else { return }
        var handle = current.handle
        let parsed = Self.parseHandshakeError(error)
        switch parsed {
        case .handleTaken:
            handle.error = "That handle is already taken. Try another."
        case .usernameRequiresAck:
            handle.matchesUsername = true
            handle.error = "Confirm you want to reuse your Pantopus username."
        case let .validation(message):
            handle.error = message ?? "That handle isn't valid."
        case .other:
            handle.error = (error as? APIError)?.errorDescription ?? "Couldn't follow. Try again."
        }
        current = HandshakeReadyContent(
            persona: current.persona,
            tierOptions: current.tierOptions,
            step: .handleEntry,
            handle: handle,
            selectedTierRank: current.selectedTierRank
        )
        ready = current
        state = .ready(current)
    }

    enum HandshakeErrorKind: Equatable {
        case handleTaken
        case usernameRequiresAck
        case validation(message: String?)
        case other
    }

    /// Public for VM tests — maps an APIError into the user-facing
    /// branch the handle row should render.
    static func parseHandshakeError(_ error: any Error) -> HandshakeErrorKind {
        guard let apiError = error as? APIError,
              case let .clientError(status, message) = apiError
        else { return .other }
        let decoded = message
            .flatMap { $0.data(using: .utf8) }
            .flatMap { try? JSONDecoder().decode(HandshakeValidationErrorDTO.self, from: $0) }
        switch status {
        case 409:
            if decoded?.code == "fan_handle_taken" { return .handleTaken }
            return .handleTaken
        case 400:
            if decoded?.code == "pantopus_username_requires_ack" {
                return .usernameRequiresAck
            }
            return .validation(message: decoded?.error)
        default:
            return .other
        }
    }

    private func transition(to step: HandshakeStep) {
        guard let current = ready else { return }
        let next = HandshakeReadyContent(
            persona: current.persona,
            tierOptions: current.tierOptions,
            step: step,
            handle: current.handle,
            selectedTierRank: current.selectedTierRank
        )
        ready = next
        state = .ready(next)
    }

    private func update(handle: HandshakeHandleState) {
        guard let current = ready else { return }
        let next = HandshakeReadyContent(
            persona: current.persona,
            tierOptions: current.tierOptions,
            step: current.step,
            handle: handle,
            selectedTierRank: current.selectedTierRank
        )
        ready = next
        state = .ready(next)
    }

    // MARK: - Projection

    static func previewFrom(persona: PersonaSummaryDTO) -> HandshakePersonaPreview {
        HandshakePersonaPreview(
            id: persona.id,
            handle: persona.handle ?? "",
            displayName: persona.displayName ?? persona.handle ?? "Public Profile",
            avatarUrl: persona.avatarUrl,
            bio: persona.bio,
            audienceLabel: persona.audienceLabel ?? "Followers",
            followerCount: persona.followerCount ?? 0
        )
    }

    /// "followers" → "follower"; "Members" → "member"; "fans" → "fan".
    /// Rough singularization for the "Become a <X>" CTA. Only used
    /// for display.
    static func singularizeAudienceLabel(_ label: String) -> String {
        let lower = label.lowercased()
        if lower.hasSuffix("s") { return String(lower.dropLast()) }
        return lower
    }

    static func option(_ dto: PersonaTierDTO) -> HandshakeTierOption {
        HandshakeTierOption(
            id: dto.id,
            rank: dto.rank,
            name: dto.name,
            description: dto.description,
            priceCents: dto.priceCents ?? 0,
            currency: dto.currency ?? "usd"
        )
    }
}
