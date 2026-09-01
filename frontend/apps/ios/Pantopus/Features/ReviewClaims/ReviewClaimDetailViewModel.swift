//
//  ReviewClaimDetailViewModel.swift
//  Pantopus
//
//  P1.1 — Admin claim-detail view-model. Loads the full claim payload
//  (claimant identity, home record, evidence) for one claim id and
//  exposes Accept / Challenge / Reject handlers that hit the
//  `POST /api/admin/claims/:id/review` endpoint.
//
//  P7.2 (A13.3) — the "Request more info" verdict became "Challenge": a
//  bottom-sheet composer with reason chips + a question field. The
//  reasons + drafted question are folded into the review note that
//  rides along with the `.challenge` action.
//

import Foundation
import Observation
import SwiftUI

@MainActor
public enum ReviewClaimDetailState {
    case loading
    case loaded(AdminClaimDetailResponse)
    case error(message: String)
}

/// One pickable reason inside the Challenge composer. Labels are
/// word-for-word with the A13.3 design + the Android mirror
/// (`ChallengeReason` in `ReviewClaimDetailViewModel.kt`).
public enum ChallengeReason: String, CaseIterable, Sendable, Hashable, Identifiable {
    case identityUnclear
    case documentsAltered
    case shareDisputed
    case dontRecognize
    case other

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .identityUnclear: "Identity unclear"
        case .documentsAltered: "Documents look altered"
        case .shareDisputed: "Ownership share disputed"
        case .dontRecognize: "Don't recognize claimant"
        case .other: "Other"
        }
    }
}

@Observable
@MainActor
public final class ReviewClaimDetailViewModel {
    public private(set) var state: ReviewClaimDetailState = .loading
    public private(set) var reviewingAction: AdminClaimReviewAction?
    public private(set) var toast: ToastMessage?

    // MARK: Challenge composer state

    /// Reasons the reviewer has toggled on in the Challenge composer.
    public private(set) var selectedReasons: Set<ChallengeReason> = []
    /// The free-text question the reviewer drafts for the claimant.
    public var challengeQuestion: String = ""

    private let api: APIClient
    private let claimId: String
    private var loadedOnce = false

    init(
        claimId: String,
        api: APIClient = .shared
    ) {
        self.claimId = claimId
        self.api = api
    }

    public func load() async {
        // Same pattern as the queue VM — refetch on every appear so the
        // admin always sees fresh state.
        if !loadedOnce { state = .loading }
        do {
            let response: AdminClaimDetailResponse = try await api.request(
                AdminEndpoints.claimDetail(claimId: claimId)
            )
            state = .loaded(response)
            loadedOnce = true
        } catch {
            state = .error(message: "Couldn't load claim details. Try again.")
        }
    }

    /// Submit the reviewer decision. Surfaces a toast on success + sets
    /// the toast text on failure so the host can show the in-screen
    /// error without spawning a separate state.
    public func review(
        _ action: AdminClaimReviewAction,
        note: String? = nil
    ) async -> Bool {
        guard reviewingAction == nil else { return false }
        reviewingAction = action
        defer { reviewingAction = nil }

        do {
            let _: AdminClaimReviewResponse = try await api.request(
                AdminEndpoints.reviewClaim(
                    claimId: claimId,
                    request: AdminClaimReviewRequest(action: action, note: note)
                )
            )
            toast = ToastMessage(text: Self.successCopy(for: action), kind: .success)
            // Refresh detail so the body shows the new state.
            await load()
            return true
        } catch {
            toast = ToastMessage(text: "Couldn't review this claim. Try again.", kind: .error)
            return false
        }
    }

    public func clearToast() {
        toast = nil
    }

    // MARK: - Challenge composer

    /// Toggle a reason chip in the Challenge composer.
    public func toggleReason(_ reason: ChallengeReason) {
        if selectedReasons.contains(reason) {
            selectedReasons.remove(reason)
        } else {
            selectedReasons.insert(reason)
        }
    }

    /// The Send-challenge CTA stays disabled until the reviewer has
    /// drafted at least a question (the design requires the textarea).
    public var canSendChallenge: Bool {
        !challengeQuestion.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Submit the drafted challenge. Folds the picked reasons + question
    /// into the review note carried by the `.challenge` action. Clears
    /// the composer on success so a re-open starts blank.
    public func submitChallenge() async -> Bool {
        let note = Self.composeChallengeNote(
            reasons: selectedReasons,
            question: challengeQuestion
        )
        let ok = await review(.challenge, note: note)
        if ok { resetChallengeComposer() }
        return ok
    }

    /// Reset composer state — called on successful send + on dismiss so a
    /// fresh open never inherits stale picks.
    public func resetChallengeComposer() {
        selectedReasons = []
        challengeQuestion = ""
    }

    /// Fold the picked reasons + drafted question into a single review
    /// note. Reasons lead (in declaration order, regardless of tap order)
    /// so the claimant reads a tidy "Reasons: …" header before the
    /// free-text. Returns `nil` when both are empty.
    static func composeChallengeNote(
        reasons: Set<ChallengeReason>,
        question: String
    ) -> String? {
        let trimmed = question.trimmingCharacters(in: .whitespacesAndNewlines)
        let reasonLabels = ChallengeReason.allCases
            .filter { reasons.contains($0) }
            .map(\.label)
        var parts: [String] = []
        if !reasonLabels.isEmpty {
            parts.append("Reasons: " + reasonLabels.joined(separator: ", "))
        }
        if !trimmed.isEmpty {
            parts.append(trimmed)
        }
        let note = parts.joined(separator: "\n\n")
        return note.isEmpty ? nil : note
    }

    private static func successCopy(for action: AdminClaimReviewAction) -> String {
        switch action {
        case .approve: "Claim accepted. The claimant is now a verified owner."
        case .reject: "Claim rejected. The claimant has been notified."
        case .challenge: "Challenge sent. The claimant has 14 days to respond."
        }
    }
}
