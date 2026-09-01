//
//  TokenGalleryView.swift
//  Pantopus
//
//  Debug-only gallery of every design-system token. Reachable via the 5-tap
//  easter-egg gesture on the Home screen title — never via a production nav
//  entry.
//

#if DEBUG

import SwiftUI
import UIKit

private extension Color {
    /// Resolve the uppercase `#RRGGBB` hex string for this color, for display
    /// in the debug gallery. Computed at runtime from the asset-catalog
    /// resolution so no raw hex literals appear in feature code.
    var pantopusHexLabel: String {
        let ui = UIColor(self).resolvedColor(with: UITraitCollection(userInterfaceStyle: .light))
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        guard ui.getRed(&r, green: &g, blue: &b, alpha: &a) else { return "?" }
        let ri = Int((r * 255).rounded())
        let gi = Int((g * 255).rounded())
        let bi = Int((b * 255).rounded())
        return String(format: "%02X%02X%02X", ri, gi, bi)
    }
}

/// A scrollable gallery of every design-system token.
///
/// Grouped into Primary / Semantic / Identity / Neutrals / Categories /
/// Spacing / Radii / Shadows / Type, each row showing the token's name,
/// a visual sample, and the raw value.
public struct TokenGalleryView: View {
    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                primarySection
                semanticSection
                identitySection
                neutralSection
                categorySection
                spacingSection
                radiiSection
                shadowsSection
                typeSection
                Section {
                    NavigationLink("Icon gallery") { IconGalleryView() }
                    NavigationLink("Component gallery") { ComponentGalleryView() }
                    NavigationLink("Map+List hybrid shell") { MapListHybridPreviewHost() }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Design Tokens")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    // MARK: - Color sections

    private var primarySection: some View {
        Section("Primary") {
            colorRow("primary50", Theme.Color.primary50)
            colorRow("primary100", Theme.Color.primary100)
            colorRow("primary200", Theme.Color.primary200)
            colorRow("primary300", Theme.Color.primary300)
            colorRow("primary400", Theme.Color.primary400)
            colorRow("primary500", Theme.Color.primary500)
            colorRow("primary600", Theme.Color.primary600)
            colorRow("primary700", Theme.Color.primary700)
            colorRow("primary800", Theme.Color.primary800)
            colorRow("primary900", Theme.Color.primary900)
        }
    }

    private var semanticSection: some View {
        Section("Semantic") {
            colorRow("success", Theme.Color.success)
            colorRow("successLight", Theme.Color.successLight)
            colorRow("successBg", Theme.Color.successBg)
            colorRow("warning", Theme.Color.warning)
            colorRow("warningLight", Theme.Color.warningLight)
            colorRow("warningBg", Theme.Color.warningBg)
            colorRow("error", Theme.Color.error)
            colorRow("errorLight", Theme.Color.errorLight)
            colorRow("errorBg", Theme.Color.errorBg)
            colorRow("info", Theme.Color.info)
            colorRow("infoLight", Theme.Color.infoLight)
            colorRow("infoBg", Theme.Color.infoBg)
        }
    }

    private var identitySection: some View {
        Section("Identity") {
            colorRow("personal", Theme.Color.personal)
            colorRow("personalBg", Theme.Color.personalBg)
            colorRow("home", Theme.Color.home)
            colorRow("homeBg", Theme.Color.homeBg)
            colorRow("business", Theme.Color.business)
            colorRow("businessBg", Theme.Color.businessBg)
        }
    }

    private var neutralSection: some View {
        Section("Neutrals") {
            colorRow("appBg", Theme.Color.appBg)
            colorRow("appSurface", Theme.Color.appSurface)
            colorRow("appSurfaceRaised", Theme.Color.appSurfaceRaised)
            colorRow("appSurfaceSunken", Theme.Color.appSurfaceSunken)
            colorRow("appSurfaceMuted", Theme.Color.appSurfaceMuted)
            colorRow("appBorder", Theme.Color.appBorder)
            colorRow("appBorderStrong", Theme.Color.appBorderStrong)
            colorRow("appBorderSubtle", Theme.Color.appBorderSubtle)
            colorRow("appText", Theme.Color.appText)
            colorRow("appTextStrong", Theme.Color.appTextStrong)
            colorRow("appTextSecondary", Theme.Color.appTextSecondary)
            colorRow("appTextMuted", Theme.Color.appTextMuted)
            colorRow("appTextInverse", Theme.Color.appTextInverse)
            colorRow("appHover", Theme.Color.appHover)
        }
    }

    private var categorySection: some View {
        Section("Categories") {
            colorRow("handyman", Theme.Color.handyman)
            colorRow("cleaning", Theme.Color.cleaning)
            colorRow("moving", Theme.Color.moving)
            colorRow("petCare", Theme.Color.petCare)
            colorRow("childCare", Theme.Color.childCare)
            colorRow("tutoring", Theme.Color.tutoring)
            colorRow("delivery", Theme.Color.delivery)
            colorRow("tech", Theme.Color.tech)
            colorRow("goods", Theme.Color.goods)
            colorRow("gigs", Theme.Color.gigs)
            colorRow("rentals", Theme.Color.rentals)
            colorRow("vehicles", Theme.Color.vehicles)
        }
    }

    // MARK: - Scalar sections

    private var spacingSection: some View {
        Section("Spacing") {
            spacingRow("s0", Spacing.s0)
            spacingRow("s1", Spacing.s1)
            spacingRow("s2", Spacing.s2)
            spacingRow("s3", Spacing.s3)
            spacingRow("s4", Spacing.s4)
            spacingRow("s5", Spacing.s5)
            spacingRow("s6", Spacing.s6)
            spacingRow("s8", Spacing.s8)
            spacingRow("s10", Spacing.s10)
            spacingRow("s12", Spacing.s12)
            spacingRow("s16", Spacing.s16)
        }
    }

    private var radiiSection: some View {
        Section("Radii") {
            radiusRow("xs", Radii.xs)
            radiusRow("sm", Radii.sm)
            radiusRow("md", Radii.md)
            radiusRow("lg", Radii.lg)
            radiusRow("xl", Radii.xl)
            radiusRow("xl2", Radii.xl2)
            radiusRow("xl3", Radii.xl3)
            radiusRow("pill (9999)", min(Radii.xl3 + 8, 28))
        }
    }

    private var shadowsSection: some View {
        Section("Shadows") {
            shadowRow("sm", .sm)
            shadowRow("md", .md)
            shadowRow("lg", .lg)
            shadowRow("xl", .xl)
            shadowRow("primary", .primary)
        }
    }

    private var typeSection: some View {
        Section("Type") {
            typeRow(.h1, "h1 · 30/36 bold")
            typeRow(.h2, "h2 · 24/32 semibold")
            typeRow(.h3, "h3 · 20/28 semibold")
            typeRow(.body, "body · 16/24")
            typeRow(.small, "small · 14/20")
            typeRow(.caption, "caption · 12/16")
            typeRow(.overline, "overline · 11/16 semibold")
        }
    }

    // MARK: - Row helpers

    private func colorRow(_ name: String, _ color: Color) -> some View {
        HStack(spacing: Spacing.s3) {
            RoundedRectangle(cornerRadius: Radii.sm)
                .fill(color)
                .frame(width: 32, height: 32)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.sm)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
            Text(name).pantopusTextStyle(.body).foregroundStyle(Theme.Color.appText)
            Spacer()
            Text(color.pantopusHexLabel)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .monospaced()
        }
        .frame(minHeight: 44)
    }

    private func spacingRow(_ name: String, _ value: CGFloat) -> some View {
        HStack(spacing: Spacing.s3) {
            Text(name)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
                .frame(width: 60, alignment: .leading)
            Rectangle()
                .fill(Theme.Color.primary200)
                .frame(width: max(value, 1), height: 12)
            Spacer()
            Text("\(Int(value)) pt")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .monospaced()
        }
        .frame(minHeight: 44)
    }

    private func radiusRow(_ name: String, _ value: CGFloat) -> some View {
        HStack(spacing: Spacing.s3) {
            Text(name)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
                .frame(width: 80, alignment: .leading)
            RoundedRectangle(cornerRadius: min(value, 28))
                .fill(Theme.Color.primary100)
                .overlay(
                    RoundedRectangle(cornerRadius: min(value, 28))
                        .stroke(Theme.Color.primary600, lineWidth: 1)
                )
                .frame(width: 56, height: 40)
            Spacer()
            Text("\(Int(value)) pt")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .monospaced()
        }
        .frame(minHeight: 44)
    }

    private func shadowRow(_ name: String, _ shadow: PantopusShadow) -> some View {
        HStack(spacing: Spacing.s3) {
            Text(name)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
                .frame(width: 80, alignment: .leading)
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Theme.Color.appSurface)
                .frame(width: 72, height: 44)
                .pantopusShadow(shadow)
                .padding(.vertical, Spacing.s2)
            Spacer()
            Text(String(format: "α %.2f", shadow.opacity))
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .monospaced()
        }
        .frame(minHeight: 60)
    }

    private func typeRow(_ style: PantopusTextStyle, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("The quick brown fox")
                .pantopusTextStyle(style)
                .foregroundStyle(Theme.Color.appText)
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .pantopusLineHeight(style)
        .frame(minHeight: 44)
        .padding(.vertical, Spacing.s1)
    }
}

#Preview {
    TokenGalleryView()
}

#endif
