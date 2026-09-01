//
//  CertifiedBody.swift
//  Pantopus
//
//  Concrete body for the Certified mailbox category. The surrounding
//  shell renders the AI summary, key facts, and timeline; this body
//  mirrors the A17.3 notice card and high-stakes delivery terms summary.
//
// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

@MainActor
public struct CertifiedBody: View {
    private let certified: CertifiedDetailDTO
    private let onViewTerms: @MainActor () -> Void

    public init(
        certified: CertifiedDetailDTO,
        onViewTerms: @escaping @MainActor () -> Void
    ) {
        self.certified = certified
        self.onViewTerms = onViewTerms
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if isHighStakes {
                CertifiedTermsSummaryCard(
                    termsURL: certified.termsURL,
                    onViewTerms: certified.termsURL == nil ? nil : onViewTerms
                )
                .padding(.horizontal, Spacing.s4)
            }

            noticeCard
                .padding(.horizontal, Spacing.s4)
        }
    }

    private var isHighStakes: Bool {
        certified.termsURL != nil || certified.acknowledgeBy != nil
    }

    private var noticeParagraphs: [String] {
        guard let body = certified.noticeBody?.trimmingCharacters(in: .whitespacesAndNewlines),
              !body.isEmpty else {
            return ["No notice text was included with this certified item."]
        }
        return body
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private var noticeCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("NOTICE TEXT")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            ForEach(Array(noticeParagraphs.enumerated()), id: \.offset) { _, paragraph in
                Text(paragraph)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel(paragraph)
            }
            if certified.termsURL != nil {
                Button(action: { onViewTerms() }) {
                    HStack(spacing: Spacing.s1) {
                        Text("Show full terms")
                            .font(.system(size: 12, weight: .semibold))
                        Icon(.chevronDown, size: 13, color: Theme.Color.primary600)
                    }
                    .foregroundStyle(Theme.Color.primary600)
                    .frame(minHeight: 44, alignment: .leading)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Show full certified terms")
                .accessibilityIdentifier("certifiedBody_showTerms")
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("certifiedBody_notice")
    }
}

#Preview {
    CertifiedBody(
        certified: CertifiedDetailDTO(
            referenceNumber: "CRT-2026-0091",
            documentType: "Court summons",
            acknowledgeBy: "2026-05-25",
            chain: [
                CertifiedChainStep(id: "sent", label: "Sent", occurredAt: "2026-05-08", isComplete: true),
                CertifiedChainStep(id: "facility", label: "At facility", occurredAt: "2026-05-09", isComplete: true),
                CertifiedChainStep(id: "out_for_delivery", label: "Out for delivery", occurredAt: "2026-05-10", isComplete: true),
                CertifiedChainStep(id: "delivered", label: "Delivered", occurredAt: "2026-05-10", isComplete: true),
                CertifiedChainStep(id: "acknowledged", label: "Acknowledged", occurredAt: nil, isComplete: false)
            ],
            noticeBody: "You are summoned to appear at Cambridge District Court on May 25, 2026 at 10:00 AM. " +
                "Failure to appear may result in additional penalties.",
            termsURL: URL(string: "https://example.com/terms"),
            isAcknowledged: false
        )
    ) {}
        .background(Theme.Color.appBg)
}
