//
//  CertifiedTermsSheet.swift
//  Pantopus
//
//  Modal sheet shown when the user taps "View terms" on a certified
//  mail item. Renders the terms URL with a primary CTA that opens it
//  in the system browser. Fetching the document body is left for a
//  later prompt — the design says "fetch as plain text or render as
//  in-line markdown if backend returns markdown" but no fetch endpoint
//  exists today.
//
// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

@MainActor
public struct CertifiedTermsSheet: View {
    private let termsURL: URL
    private let onDismiss: @MainActor () -> Void
    @Environment(\.openURL) private var openURL

    public init(termsURL: URL, onDismiss: @escaping @MainActor () -> Void) {
        self.termsURL = termsURL
        self.onDismiss = onDismiss
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HStack {
                Text("Certified delivery terms")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button(action: { onDismiss() }) {
                    Icon(.x, size: 20, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
            }

            Text("Review the delivery terms before signing for this certified item.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)

            CertifiedTermsSummaryCard(
                termsURL: nil,
                onViewTerms: nil
            )

            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Document URL")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(termsURL.absoluteString)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(3)
                    .truncationMode(.middle)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))

            PrimaryButton(title: "Open in browser") {
                await MainActor.run {
                    openURL(termsURL)
                    onDismiss()
                }
            }

            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("certifiedTermsSheet")
    }
}

/// Compact high-stakes summary shown directly above the notice body.
@MainActor
public struct CertifiedTermsSummaryCard: View {
    private let termsURL: URL?
    private let onViewTerms: (@MainActor () -> Void)?

    public init(
        termsURL: URL?,
        onViewTerms: (@MainActor () -> Void)? = nil
    ) {
        self.termsURL = termsURL
        self.onViewTerms = onViewTerms
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.shieldCheck, size: 18, color: Theme.Color.warning)
                    .frame(width: 32, height: 32)
                    .background(Theme.Color.warningBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Certified delivery terms")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("A high-stakes item needs a signed delivery receipt before Pantopus marks it complete.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            VStack(alignment: .leading, spacing: Spacing.s2) {
                SummaryBullet(icon: .checkCircle, text: "Signing confirms receipt only.")
                SummaryBullet(icon: .flag, text: "It does not waive appeal, dispute, or payment rights.")
                SummaryBullet(icon: .archive, text: "Pantopus stores the receipt with the chain of custody.")
            }

            if termsURL != nil, let onViewTerms {
                Button(action: { onViewTerms() }) {
                    HStack(spacing: Spacing.s1) {
                        Text("Review full terms")
                            .font(.system(size: 12, weight: .semibold))
                        Icon(.chevronRight, size: 13, color: Theme.Color.primary600)
                    }
                    .foregroundStyle(Theme.Color.primary600)
                    .frame(minHeight: 44, alignment: .leading)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Review full certified delivery terms")
                .accessibilityIdentifier("certifiedTermsSummary_review")
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("certifiedTermsSummary")
    }

    private struct SummaryBullet: View {
        let icon: PantopusIcon
        let text: String

        var body: some View {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(icon, size: 13, color: Theme.Color.warning)
                    .frame(width: 18, height: 18)
                    .accessibilityHidden(true)
                Text(text)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

#Preview {
    CertifiedTermsSheet(
        termsURL: URL(string: "https://example.com/certified-terms.pdf")!
    ) {}
}
