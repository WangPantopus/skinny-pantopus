//
//  AboutView.swift
//  Pantopus
//
//  P8 / T6.2c — Settings → About sub-route. Static screen with
//  version + build, copyright, links to Legal docs and the open-
//  source attributions list.
//

import SwiftUI

public struct AboutView: View {
    private let onBack: @MainActor () -> Void

    public init(onBack: @escaping @MainActor () -> Void) {
        self.onBack = onBack
    }

    public var body: some View {
        ContentDetailShell(
            title: "About",
            onBack: onBack,
            header: { headerView },
            body: { bodyContent }
        )
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("aboutScreen")
    }

    private var headerView: some View {
        VStack(spacing: Spacing.s2) {
            ZStack {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Theme.Color.primary600)
                    .frame(width: 96, height: 96)
                Text("P")
                    .font(.system(size: 44, weight: .heavy))
                    .foregroundStyle(.white)
            }
            .accessibilityHidden(true)
            Text("Pantopus")
                .pantopusTextStyle(.h2)
                .foregroundStyle(Theme.Color.appText)
            Text(Self.versionString())
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityIdentifier("aboutVersion")
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s5)
    }

    private var bodyContent: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            infoCard(
                heading: "Mission",
                body: "A trusted neighborhood platform. We help neighbors swap goods, find help, " +
                    "and stay in touch — without the noise of a public feed."
            )
            infoCard(
                heading: "Built by",
                body: "A small team of people who wanted somewhere better to ask their block for a ladder. Reach us at support@pantopus.app."
            )
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Attributions")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                Text("See Settings → Legal → Open-source licenses for the libraries that power Pantopus.")
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(Spacing.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            Text("\u{00A9} \(Self.currentYear) Pantopus")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
                .frame(maxWidth: .infinity)
                .padding(.top, Spacing.s4)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s4)
    }

    private func infoCard(heading: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(heading)
                .pantopusTextStyle(.h3)
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

    static func versionString() -> String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "Version \(version) (\(build))"
    }

    private static var currentYear: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy"
        return formatter.string(from: Date())
    }
}

#Preview {
    NavigationStack {
        AboutView {}
    }
}
