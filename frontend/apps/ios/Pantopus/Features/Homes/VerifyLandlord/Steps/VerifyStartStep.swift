//
//  VerifyStartStep.swift
//  Pantopus
//
//  A12.5 — Verify landlord start. Renders two variants:
//   - canonical:  HomeChip + h2 + `What you'll need` requirements card
//                 + `Why verify your landlord?` expandable row.
//   - fast-track: HomeChip + green success notice with the existing
//                 landlord chip + shorter requirements card + same
//                 expandable row, with the h2 swapped to
//                 "Join as a verified tenant".
//

import SwiftUI

struct VerifyStartStep: View {
    let content: VerifyLandlordStartContent
    @State private var isWhyExpanded = false

    var body: some View {
        VerifyLandlordHomeChipView(label: content.homeChip.label)

        if let landlord = content.existingLandlord, content.isFastTrack {
            VerifyFastTrackNotice(landlord: landlord)
        }

        HeadlineBlock(
            content.isFastTrack ? "Join as a verified tenant" : "Confirm who you rent from",
            subtitle: content.isFastTrack ? fastTrackSubcopy : canonicalSubcopy
        )

        RequirementsCardBlock(rows: requirementRows)

        VerifyWhyWeAskRow(isExpanded: $isWhyExpanded)
    }

    private var canonicalSubcopy: String {
        "Verifying your landlord links this rental to a real owner so you can send rent, " +
            "raise maintenance tickets, and resolve disputes inside Pantopus. " +
            "We'll ask them to confirm by email — they don't need an account."
    }

    private var fastTrackSubcopy: String {
        "Shorter process — we just need to confirm you're really on the lease for " +
            "Apt 3B. No email to your landlord required."
    }

    private var requirementRows: [RequirementsRow] {
        if content.isFastTrack {
            return [
                RequirementsRow(
                    id: "lease-page",
                    icon: .check,
                    title: "A signed lease — just one page",
                    subcopy: "Any page showing your name and unit number. " +
                        "We only need it to match you to the existing rental."
                ),
                RequirementsRow(
                    id: "move-in",
                    icon: .check,
                    title: "Confirm your move-in date",
                    subcopy: "We'll prefill what your landlord already submitted — you just confirm."
                ),
                RequirementsRow(
                    id: "time-fast",
                    icon: .check,
                    title: "About a minute",
                    subcopy: "No email to the landlord this time — they've already verified."
                )
            ]
        }
        return [
            RequirementsRow(
                id: "lease",
                icon: .check,
                title: "A signed lease agreement",
                subcopy: "PDF, photo, or scan. Current term only — older leases are fine if still active."
            ),
            RequirementsRow(
                id: "contact",
                icon: .check,
                title: "Landlord contact info",
                subcopy: "Their name, email, and phone. We send a one-time confirmation link to them."
            ),
            RequirementsRow(
                id: "time",
                icon: .check,
                title: "A few minutes",
                subcopy: "Most verifications take 3–4 min on your side. Landlord confirms in their inbox."
            )
        ]
    }
}

/// Home identity chip — green pillar dot + address. Mirrors the
/// HomeContextChip used by ClaimStartStep but renders the renting label
/// from the design ("Renting · 412 Elm St, Apt 3B").
private struct VerifyLandlordHomeChipView: View {
    let label: String

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.home, size: 11, color: Theme.Color.home)
            Text(label.uppercased())
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.home)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.homeBg)
        .clipShape(Capsule())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
        .accessibilityIdentifier("verifyLandlordHomeChip")
    }
}

/// Fast-track success notice: green success-bg card containing the
/// "Landlord already verified" header and the existing landlord chip
/// (Business violet tile + name + verified pill).
private struct VerifyFastTrackNotice: View {
    let landlord: VerifyLandlordExistingLandlord

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                Circle()
                    .fill(Theme.Color.success)
                    .frame(width: 30, height: 30)
                    .overlay {
                        Icon(.badgeCheck, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                    }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("Landlord already verified for this building")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.success)
                    Text(
                        "\(landlord.otherTenantsCount) other tenants in this building have " +
                            "completed verification with the same landlord, so we can fast-track yours."
                    )
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextStrong)
                }
            }
            ExistingLandlordChip(landlord: landlord)
        }
        .padding(Spacing.s4)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("verifyLandlordFastTrackNotice")
    }
}

/// One-row chip showing the existing verified landlord (business tile
/// + name + verifier meta + verified pill). Composes the violet
/// `businessBg` disc, the address-style meta, and the green success
/// pill from the design.
private struct ExistingLandlordChip: View {
    let landlord: VerifyLandlordExistingLandlord

    var body: some View {
        HStack(spacing: Spacing.s3) {
            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                .fill(Theme.Color.businessBg)
                .frame(width: 30, height: 30)
                .overlay {
                    Icon(.building2, size: 15, strokeWidth: 2, color: Theme.Color.business)
                }
            VStack(alignment: .leading, spacing: 1) {
                Text(landlord.name)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text("\(landlord.verifiedAt) · \(landlord.contactName)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VerifiedPill()
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("verifyLandlordExistingLandlord")
    }
}

private struct VerifiedPill: View {
    var body: some View {
        HStack(spacing: 3) {
            Icon(.check, size: 9, strokeWidth: 3, color: Theme.Color.success)
            Text("VERIFIED")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.successBg)
        .clipShape(Capsule())
    }
}

/// Tap-to-expand explainer block. Closed state shows the header row;
/// open state reveals a longer paragraph below.
private struct VerifyWhyWeAskRow: View {
    @Binding var isExpanded: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Button {
                withPantopusAnimation(.componentState, reduceMotion: reduceMotion) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: Spacing.s3) {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.appSurface)
                        .frame(width: 28, height: 28)
                        .overlay {
                            Icon(.shieldCheck, size: 15, strokeWidth: 2.2, color: Theme.Color.primary600)
                        }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Why verify your landlord?")
                            .pantopusTextStyle(.body)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.primary700)
                        Text("Verified rentals get safer payouts and dispute support.")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer(minLength: Spacing.s0)
                    Icon(
                        isExpanded ? .chevronUp : .chevronRight,
                        size: 16,
                        color: Theme.Color.primary600
                    )
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isExpanded ? "Hide why we verify your landlord" : "Show why we verify your landlord")
            .accessibilityIdentifier("verifyLandlordWhyWeAsk")

            if isExpanded {
                Text(
                    "Linking a verified landlord lets us route maintenance tickets to the right "
                        + "person, escrow rent so deposits stay safe, and step in if a dispute "
                        + "needs a neutral reviewer."
                )
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextStrong)
                .padding(.leading, Spacing.s10)
                .accessibilityIdentifier("verifyLandlordWhyWeAskDetail")
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary100, lineWidth: 1)
        }
    }
}

#Preview("Verify Landlord — Start canonical") {
    ScrollView {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            VerifyStartStep(content: VerifyLandlordSampleData.canonical)
        }
        .padding(Spacing.s4)
    }
    .background(Theme.Color.appBg)
}

#Preview("Verify Landlord — Start fast-track") {
    ScrollView {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            VerifyStartStep(content: VerifyLandlordSampleData.fastTrack)
        }
        .padding(Spacing.s4)
    }
    .background(Theme.Color.appBg)
}
