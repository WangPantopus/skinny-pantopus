//
//  DataExportView.swift
//  Pantopus
//
//  WS5.3 — GDPR data-export request UI. No backend export job yet;
//  routes users to privacy@ until `GET/POST /api/users/export` lands.
//

import SwiftUI

public struct DataExportView: View {
    private let onBack: @MainActor () -> Void

    public init(onBack: @escaping @MainActor () -> Void) {
        self.onBack = onBack
    }

    public var body: some View {
        ContentDetailShell(
            title: "Data export",
            onBack: onBack,
            header: { headerView },
            body: { contentBody },
            cta: { ctaBar }
        )
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("dataExport")
    }

    private var headerView: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Download your data")
                .pantopusTextStyle(.h2)
                .foregroundStyle(Theme.Color.appText)
            Text(
                "You can request a copy of the personal data Pantopus stores about you. " +
                    "Automated ZIP export is coming soon — for now we process requests by email."
            )
            .pantopusTextStyle(.small)
            .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
    }

    private var contentBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            infoCard(
                title: "What's included",
                body: "Profile, homes, gigs, messages metadata, wallet history, and settings " +
                    "preferences — packaged as human-readable files."
            )
            infoCard(
                title: "Timing",
                body: "We respond within 30 days. You'll receive a secure download link at the " +
                    "email on your account."
            )
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s4)
    }

    private func infoCard(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(body)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var ctaBar: some View {
        VStack(spacing: Spacing.s2) {
            PrimaryButton(title: "Email privacy team") {
                if let url = URL(string: "mailto:privacy@pantopus.com?subject=Data%20export%20request") {
                    await openURL(url)
                }
            }
            .accessibilityIdentifier("dataExportRequestCTA")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
    }

    @MainActor
    private func openURL(_ url: URL) async {
        _ = await UIApplication.shared.open(url, options: [:])
    }
}
