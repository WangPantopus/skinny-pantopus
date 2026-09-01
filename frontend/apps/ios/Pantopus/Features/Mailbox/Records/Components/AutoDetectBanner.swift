//
//  AutoDetectBanner.swift
//  Pantopus
//
//  The Home Records "Auto-detect assets" affordance. Idle it is a scan
//  button; after a scan turns up candidates it becomes a banner with a
//  Review action that opens the link suggestions.
//
//  Mirrors `ui/screens/mailbox/home_records/components/AutoDetectBanner.kt`.
//

import SwiftUI

struct AutoDetectBanner: View {
    let detectionCount: Int
    let isScanning: Bool
    let onScan: () -> Void
    let onReview: () -> Void

    var body: some View {
        if detectionCount > 0 {
            reviewBanner
        } else {
            scanButton
        }
    }

    private var reviewBanner: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.sparkles, size: 18, color: Theme.Color.warning)
            VStack(alignment: .leading, spacing: 1) {
                Text("\(detectionCount) potential asset\(detectionCount == 1 ? "" : "s") detected")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.warning)
                Text("We found appliance mentions in your recent mail.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s2)
            Button(action: onReview) {
                Text("Review")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 7)
                    .background(Theme.Color.warning)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("homeRecords_autoDetect_review")
        }
        .padding(Spacing.s3)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("homeRecords_autoDetect_banner")
    }

    private var scanButton: some View {
        Button(action: onScan) {
            HStack(spacing: Spacing.s2) {
                if isScanning {
                    ProgressView()
                        .controlSize(.small)
                    Text("Scanning your recent mail…")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.warning)
                } else {
                    Icon(.fileSearch, size: 16, color: Theme.Color.warning)
                    Text("Scan mail for new assets")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.warning)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Theme.Color.warningBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isScanning)
        .accessibilityIdentifier("homeRecords_autoDetect_scan")
    }
}

#if DEBUG
#Preview("Idle") {
    AutoDetectBanner(detectionCount: 0, isScanning: false, onScan: {}, onReview: {})
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}

#Preview("Detected") {
    AutoDetectBanner(detectionCount: 3, isScanning: false, onScan: {}, onReview: {})
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
#endif
