//
//  ReviewClaimApprovalPanel.swift
//  Pantopus
//
//  "Before you approve" on the admin claim review: what approval needs — a
//  confirmed identity (the claimant's Stripe Identity check, or the admin's own
//  confirmation) and a document a reviewer checked — as the server tests it
//  (`approval` on `GET /api/admin/claims/:claimId`). Mirrors the web
//  `ClaimReviewApprovalPanel` and Android `ReviewClaimApprovalPanel`.
//

import SwiftUI

enum ReviewClaimApproval {
    /// Accept's blocked reason for a loaded claim approved as `role`, or nil (also when the server didn't send
    /// the panel).
    @MainActor
    static func blockedReason(_ detail: AdminClaimDetailResponse, identityAttested: Bool, role: AdminClaimApprovalRole) -> String? {
        detail.approval.flatMap {
            blockedReason(
                $0,
                identityAttested: identityAttested,
                identityFailed: detail.claim.identityStatus == "failed",
                proof: proof(detail, role: role)
            )
        }
    }

    /// Why Accept is off, or nil when it can go ahead. `proof` is the document status for the role being
    /// granted (`approval.proof` when approving as claimed); identity can be the admin's own confirmation.
    static func blockedReason(
        _ approval: ClaimReviewApprovalDTO,
        identityAttested: Bool,
        identityFailed: Bool,
        proof status: String? = nil
    ) -> String? {
        if identityFailed { return "Their identity check failed, so this claim can\u{2019}t be approved." }
        let proofStatus = status ?? approval.proof
        let identity = approval.identityConfirmed || identityAttested
        let proof = proofStatus == "verified"
        switch (identity, proof) {
        case (true, true): return nil
        case (false, true): return "Confirm the claimant\u{2019}s identity first."
        case (true, false):
            return proofStatus == "pending"
                ? "Check the claimant\u{2019}s document first (Review private documents)."
                : "No document yet. Use Request info to ask for one."
        case (false, false):
            return proofStatus == "pending"
                ? "Confirm the claimant\u{2019}s identity and check their document (Review private documents)."
                : "Needs a confirmed identity and a checked document. Use Request info to ask for a document."
        }
    }

    private static let ownershipDocuments: Set = ["deed", "closing_disclosure", "tax_bill", "escrow_attestation", "title_match"]

    /// `verified` · `pending` · `missing` for approving as `role`. As claimed, the server's own test
    /// (`approval.proof`); as another role, the approval function's rule: owner and admin need an ownership
    /// document, any other role also accepts a utility bill or lease.
    static func proof(_ detail: AdminClaimDetailResponse, role: AdminClaimApprovalRole) -> String {
        if role == .claimed(by: detail.claim.claimType) { return detail.approval?.proof ?? "missing" }
        let accepted = role == .owner || role == .admin ? ownershipDocuments : ownershipDocuments.union(["utility_bill", "lease"])
        let documents = detail.evidence.filter { accepted.contains($0.evidenceType) }
        if documents.contains(where: { $0.eligibleForReview == true }) { return "verified" }
        return documents.contains { $0.status == "pending" && $0.availabilityCode == nil } ? "pending" : "missing"
    }

    static func identityLine(_ approval: ClaimReviewApprovalDTO) -> (title: String, detail: String) {
        if approval.identityConfirmed {
            let name = approval.identityName.map { "Name on ID: \($0). Compare it with the document." }
            return ("Identity confirmed", name ?? "Compare the claimant\u{2019}s name with the document.")
        }
        switch approval.identity {
        case "processing": return ("Identity check in progress", "Stripe is checking the claimant\u{2019}s ID.")
        case "requires_input": return ("Identity check didn\u{2019}t pass", "The claimant can try again.")
        case "started": return ("Identity not confirmed", "The claimant started the ID check but hasn\u{2019}t finished.")
        default:
            if !approval.identityCheckAvailable {
                return (
                    "Identity not confirmed",
                    "In-app ID checks aren\u{2019}t set up yet, so confirm who they are yourself before approving."
                )
            }
            return ("Identity not confirmed", "The claimant hasn\u{2019}t done the ID check yet. They\u{2019}re asked to on their claim.")
        }
    }

    static func proofLine(_ proof: String) -> (title: String, detail: String) {
        switch proof {
        case "verified": ("Document checked", "A reviewer verified a document.")
        case "pending": ("Document waiting for your check", "Use Review private documents to verify it.")
        default: ("No document yet", "The claimant is asked to upload one.")
        }
    }
}

struct ReviewClaimApprovalPanel: View {
    let approval: ClaimReviewApprovalDTO
    /// The document status for the role being granted (`ReviewClaimApproval.proof`).
    let proof: String
    let identityFailed: Bool
    @Binding var identityAttested: Bool
    let disabled: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            let identity = ReviewClaimApproval.identityLine(approval)
            row(
                icon: .idCard,
                title: identity.title,
                detail: identity.detail,
                done: approval.identityConfirmed,
                waiting: approval.identity == "processing"
            )
            .accessibilityIdentifier("reviewClaimDetail_approvalIdentity")
            if !approval.identityConfirmed, !identityFailed {
                Toggle(isOn: $identityAttested) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("I confirmed this person\u{2019}s identity")
                            .font(.system(size: 13.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Text("Turn this on once you\u{2019}ve checked who they are yourself.")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .disabled(disabled)
                .padding(.horizontal, Spacing.s3)
                .padding(.bottom, Spacing.s3)
                .accessibilityIdentifier("reviewClaimDetail_identityAttested")
            }
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            let proofLine = ReviewClaimApproval.proofLine(proof)
            row(
                icon: .fileText,
                title: proofLine.title,
                detail: proofLine.detail,
                done: proof == "verified",
                waiting: proof == "pending"
            )
            .accessibilityIdentifier("reviewClaimDetail_approvalProof")
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
    }

    private func row(icon: PantopusIcon, title: String, detail: String, done: Bool, waiting: Bool) -> some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            Icon(icon, size: 20, color: Theme.Color.appTextMuted)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(detail)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s0)
            if done {
                Icon(.checkCircle2, size: 20, color: Theme.Color.success)
            } else if waiting {
                Icon(.clock, size: 20, color: Theme.Color.info)
            } else {
                Icon(.circle, size: 20, color: Theme.Color.appTextMuted)
            }
        }
        .padding(Spacing.s3)
    }
}

/// The "Before you approve" panel, bound to the review's identity confirmation toggle and to the role
/// being granted (which decides the document it needs).
struct ReviewClaimApprovalSection: View {
    let approval: ClaimReviewApprovalDTO
    let detail: AdminClaimDetailResponse
    let viewModel: ReviewClaimDetailViewModel

    var body: some View {
        ReviewClaimApprovalPanel(
            approval: approval,
            proof: ReviewClaimApproval.proof(detail, role: viewModel.approveAs),
            identityFailed: detail.claim.identityStatus == "failed",
            identityAttested: Binding(get: { viewModel.identityAttested }, set: { viewModel.identityAttested = $0 }),
            disabled: viewModel.reviewingAction != nil
        )
        .accessibilityIdentifier("reviewClaimDetail_approval")
    }
}
