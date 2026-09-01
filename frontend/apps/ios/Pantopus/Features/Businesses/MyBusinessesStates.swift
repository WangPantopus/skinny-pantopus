//
//  MyBusinessesStates.swift
//  Pantopus
//
//  A08 — non-loaded states for My businesses: the proof-led empty state,
//  the loading skeleton, and the error view. Split out of
//  MyBusinessesView.swift to keep each file under the 500-line limit.
//

import SwiftUI

// MARK: - Empty state

struct MyBusinessesEmptyView: View {
    let onCreate: @Sendable () -> Void
    let onClaim: @Sendable () -> Void

    private struct Proof: Identifiable {
        let id = UUID()
        let icon: PantopusIcon
        let title: String
        let sub: String
    }

    private let proofs: [Proof] = [
        Proof(icon: .idCard, title: "EIN / Tax ID", sub: "IRS-issued · verified within 1 business day"),
        Proof(icon: .fileText, title: "State registration certificate", sub: "Upload Articles of Incorporation or DBA"),
        Proof(icon: .creditCard, title: "Linked payment processor", sub: "Stripe, Square, or Toast · instant")
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.s0) {
                disc
                    .padding(.bottom, Spacing.s5)
                Text("Create your first verified business page")
                    .font(.system(size: 20, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.Color.appText)
                    .padding(.bottom, Spacing.s2)
                Text(
                    "Reach repeat clients who know you, take quotes inside Pantopus, "
                        + "and earn the violet verified mark. Pick a proof to start."
                )
                .font(.system(size: 13))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.bottom, Spacing.s5)

                VStack(spacing: Spacing.s1) {
                    ForEach(proofs) { proof in
                        proofRow(proof)
                    }
                }
                .padding(.bottom, Spacing.s5)

                Button { onCreate() } label: {
                    HStack(spacing: Spacing.s2) {
                        Icon(.building2, size: 16, color: Theme.Color.appTextInverse)
                        Text("Create a business")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .padding(.horizontal, Spacing.s5)
                    .padding(.vertical, Spacing.s3)
                    .background(
                        LinearGradient(
                            colors: [Theme.Color.business, Theme.Color.businessDark],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    .pantopusShadow(WizardIdentity.business.ctaShadow)
                }
                .buttonStyle(.plain)
                .padding(.bottom, Spacing.s2)
                .accessibilityIdentifier("myBusinessesCreate")

                Button { onClaim() } label: {
                    HStack(spacing: Spacing.s1) {
                        Text("Already listed? Claim an existing page")
                            .font(.system(size: 12.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Icon(.arrowUpRight, size: 12, color: Theme.Color.appTextSecondary)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("myBusinessesClaim")
            }
            .padding(.horizontal, Spacing.s6)
            .padding(.vertical, Spacing.s10)
            .frame(maxWidth: .infinity)
        }
        .accessibilityIdentifier("myBusinessesEmpty")
    }

    private var disc: some View {
        ZStack(alignment: .bottomTrailing) {
            Icon(.building2, size: 40, strokeWidth: 1.7, color: Theme.Color.business)
                .frame(width: 96, height: 96)
                .background(Circle().fill(Theme.Color.businessBg))
            Icon(.check, size: 16, strokeWidth: 3, color: Theme.Color.appTextInverse)
                .frame(width: 30, height: 30)
                .background(Circle().fill(Theme.Color.business))
                .overlay(Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 2))
        }
    }

    private func proofRow(_ proof: Proof) -> some View {
        Button { onCreate() } label: {
            HStack(spacing: Spacing.s3) {
                Icon(proof.icon, size: 16, color: Theme.Color.business)
                    .frame(width: 32, height: 32)
                    .background(Theme.Color.businessBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(proof.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(proof.sub)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Loading + error

struct MyBusinessesSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                Shimmer(width: nil, height: 60, cornerRadius: Radii.lg)
                ForEach(0..<3, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: Spacing.s3) {
                        HStack(spacing: Spacing.s3) {
                            Shimmer(width: 56, height: 56, cornerRadius: Radii.xl)
                            VStack(alignment: .leading, spacing: Spacing.s1) {
                                Shimmer(width: 160, height: 14)
                                Shimmer(width: 120, height: 11)
                                Shimmer(width: 90, height: 18, cornerRadius: Radii.pill)
                            }
                            Spacer()
                        }
                        Shimmer(width: nil, height: 44, cornerRadius: Radii.md)
                    }
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
        }
    }
}

struct MyBusinessesErrorView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load your businesses")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            PrimaryButton(title: "Try again") { await MainActor.run { retry() } }
                .frame(maxWidth: 240)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
