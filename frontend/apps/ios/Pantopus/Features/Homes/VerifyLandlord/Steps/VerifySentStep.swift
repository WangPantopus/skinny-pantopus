//
//  VerifySentStep.swift
//  Pantopus
//
//  A12.6 terminal frame — the tenant approval request landed. Mirrors
//  RN's `verify-landlord/index.tsx` "pending approval" state: status
//  disc + headline + body + a detail card built entirely from the
//  `HomeLease` row the backend returned (submitted-at, requested start,
//  the message the landlord will read).
//
//  There is no `GET /api/v1/tenant/home/:id/status` route in
//  `backend/routes/landlordTenant.js`, so this screen deliberately does
//  not poll — it renders what the submit answered with and offers the
//  mailed-code path as the alternative.
//

import SwiftUI

struct VerifySentStep: View {
    let result: VerifyLandlordApprovalResult
    let errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            statusDisc
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(result.headline)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(result.body)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            statusPill
            if hasDetails { detailCard }
            if let errorMessage {
                Text(errorMessage)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityIdentifier("verifyLandlordSentError")
            }
            Text("Your landlord will be notified and can approve or deny your request.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("verifyLandlordSentStep")
    }

    private var statusDisc: some View {
        Circle()
            .fill(discBackground)
            .frame(width: 72, height: 72)
            .overlay {
                Icon(discIcon, size: 32, strokeWidth: 2, color: discTint)
            }
            .accessibilityHidden(true)
    }

    private var statusPill: some View {
        HStack(spacing: Spacing.s2) {
            Icon(discIcon, size: 13, color: discTint)
            Text(pillLabel)
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(discTint)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 6)
        .background(discBackground)
        .clipShape(Capsule())
        .accessibilityIdentifier("verifyLandlordSentStatusPill")
    }

    private var hasDetails: Bool {
        result.submittedAt != nil || result.requestedStartAt != nil || result.message != nil
    }

    private var detailCard: some View {
        VStack(spacing: Spacing.s0) {
            let start = VerifySentStep.formatted(result.requestedStartAt)
            let hasMessage = !(result.message ?? "").isEmpty
            if let submitted = VerifySentStep.formatted(result.submittedAt) {
                detailRow(
                    label: "Submitted",
                    value: submitted,
                    showsDivider: start != nil || hasMessage
                )
            }
            if let start {
                detailRow(label: "Requested start", value: start, showsDivider: hasMessage)
            }
            if let message = result.message, !message.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("Your message")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text(message)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s3)
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
        .accessibilityIdentifier("verifyLandlordSentDetails")
    }

    private func detailRow(label: String, value: String, showsDivider: Bool) -> some View {
        VStack(spacing: Spacing.s0) {
            HStack {
                Text(label)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer(minLength: Spacing.s3)
                Text(value)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.trailing)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            if showsDivider {
                Rectangle()
                    .fill(Theme.Color.appBorderSubtle)
                    .frame(height: 1)
                    .padding(.leading, Spacing.s4)
            }
        }
    }

    // MARK: - Tone

    private var discIcon: PantopusIcon {
        switch result.kind {
        case .submitted, .alreadyPending: .clock
        case .alreadyActive: .shieldCheck
        }
    }

    private var discTint: Color {
        switch result.kind {
        case .submitted, .alreadyPending: Theme.Color.primary600
        case .alreadyActive: Theme.Color.success
        }
    }

    private var discBackground: Color {
        switch result.kind {
        case .submitted, .alreadyPending: Theme.Color.primary50
        case .alreadyActive: Theme.Color.successBg
        }
    }

    private var pillLabel: String {
        switch result.kind {
        case .submitted, .alreadyPending: "Pending Approval"
        case .alreadyActive: "Verified Tenant"
        }
    }

    /// ISO-8601 → "Mar 4, 2026". Returns nil when the field is absent or
    /// unparsable so the row simply doesn't render.
    static func formatted(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        guard let date = withFraction.date(from: iso) ?? plain.date(from: iso) else { return nil }
        let out = DateFormatter()
        out.dateFormat = "MMM d, yyyy"
        return out.string(from: date)
    }
}

#Preview("Verify Landlord — request sent") {
    ScrollView {
        VerifySentStep(
            result: VerifyLandlordApprovalResult(
                kind: .submitted,
                submittedAt: "2026-03-04T18:12:00.000Z",
                requestedStartAt: "2026-04-01T00:00:00.000Z",
                message: "Hi, I'm the new tenant in Apt 3B."
            ),
            errorMessage: nil
        )
        .padding(Spacing.s4)
    }
    .background(Theme.Color.appBg)
}
