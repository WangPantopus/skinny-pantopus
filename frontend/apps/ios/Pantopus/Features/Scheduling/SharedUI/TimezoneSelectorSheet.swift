//
//  TimezoneSelectorSheet.swift
//  Pantopus
//
//  Foundation (I0b) — C7 timezone selector. A searchable bottom sheet opened
//  from the slot picker's timezone chip: a search field, a pinned "Detected"
//  row for the device zone, and a Common list — each row a real labelled button
//  showing the GMT offset and current local time. The selected checkmark uses
//  the host pillar accent. Changing the zone re-times the slots beneath.
//

import SwiftUI

/// Searchable IANA timezone picker. The parent owns the selected identifier and
/// re-fetches slots in `onSelect`.
public struct TimezoneSelectorSheet: View {
    private let selectedIdentifier: String
    private let accent: Color
    private let onSelect: (String) -> Void
    private let onDone: () -> Void

    @State private var query: String = ""

    /// A curated common set, in display order.
    private static let common: [String] = [
        "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
        "Europe/London", "Europe/Paris", "Europe/Berlin",
        "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"
    ]

    public init(
        selectedIdentifier: String,
        accent: Color = Theme.Color.primary600,
        onSelect: @escaping (String) -> Void,
        onDone: @escaping () -> Void
    ) {
        self.selectedIdentifier = selectedIdentifier
        self.accent = accent
        self.onSelect = onSelect
        self.onDone = onDone
    }

    private var detected: String {
        SchedulingTime.deviceTimeZoneIdentifier
    }

    private var isOverridden: Bool {
        selectedIdentifier != detected
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            searchField
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Spacing.s2) {
                    if query.isEmpty {
                        defaultList
                    } else {
                        searchResults
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s6)
            }
        }
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("scheduling.timezoneSheet")
    }

    // MARK: - Chrome

    private var header: some View {
        ZStack {
            Text("Time zone")
                .pantopusTextStyle(.body)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Color.appText)
            HStack {
                Spacer()
                Button("Done", action: onDone)
                    .font(Theme.Font.small)
                    .fontWeight(.bold)
                    .foregroundStyle(accent)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s3)
    }

    private var searchField: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.search, size: 16, color: Theme.Color.appTextSecondary)
            TextField("Search city or time zone", text: $query)
                .font(Theme.Font.body)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            if !query.isEmpty {
                Button { query = "" } label: {
                    Icon(.x, size: 16, color: Theme.Color.appTextMuted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s2)
    }

    // MARK: - Lists

    @ViewBuilder
    private var defaultList: some View {
        if isOverridden {
            overriddenBanner
        }
        sectionHeader("Detected")
        listCard([detected], detectedChip: true)
        sectionHeader("Common")
        listCard(Self.common)
    }

    @ViewBuilder
    private var searchResults: some View {
        let matches = filteredIdentifiers
        if matches.isEmpty {
            noMatch()
        } else {
            sectionHeader("Results")
            listCard(matches)
        }
    }

    private func listCard(_ identifiers: [String], detectedChip: Bool = false) -> some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(identifiers.enumerated()), id: \.element) { index, identifier in
                row(for: identifier, detectedChip: detectedChip)
                if index < identifiers.count - 1 {
                    Divider()
                        .overlay(Theme.Color.appBorder)
                        .padding(.leading, Spacing.s4)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    private var filteredIdentifiers: [String] {
        let needle = query.lowercased().replacingOccurrences(of: " ", with: "_")
        return Array(
            SchedulingTime.ianaIdentifiers
                .filter { $0.lowercased().contains(needle) }
                .prefix(60)
        )
    }

    private var overriddenBanner: some View {
        // Design (timezone-selector-frames.jsx:316-335): info icon top-aligned,
        // then a vertical block — the description line, and BELOW it the
        // "Reset to detected" button (not beside it).
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.info, size: 14, color: Theme.Color.primary700)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: Spacing.s1 + 1) {
                Text("You changed this from your detected zone.")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.primary700)
                    .fixedSize(horizontal: false, vertical: true)
                Button { onSelect(detected) } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.rotateCcw, size: 12, strokeWidth: 2.4, color: accent)
                        Text("Reset to detected")
                            .pantopusTextStyle(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(accent)
                    }
                }
                .buttonStyle(.plain)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.infoBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.primary100, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.bottom, Spacing.s1)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .pantopusTextStyle(.overline)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.top, Spacing.s2)
            .padding(.horizontal, Spacing.s1)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func noMatch() -> some View {
        VStack(spacing: Spacing.s2) {
            Icon(.searchX, size: 24, strokeWidth: 1.85, color: Theme.Color.appTextSecondary)
                .frame(width: 52, height: 52)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Circle())
            Text("No time zones match \u{201C}\(query)\u{201D}")
                .pantopusTextStyle(.small)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text("Try a city name.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: 190)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s8)
        .padding(.horizontal, Spacing.s4)
        .background(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1, dash: [5]))
        )
        .padding(.top, Spacing.s4)
    }

    // MARK: - Row

    private func row(for identifier: String, detectedChip: Bool = false) -> some View {
        let isSelected = identifier == selectedIdentifier
        return Button {
            onSelect(identifier)
        } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    if isSelected {
                        Icon(.check, size: 18, strokeWidth: 2.6, color: accent)
                    }
                }
                .frame(width: 18)
                HStack(spacing: Spacing.s2) {
                    Text(highlightedName(cityName(identifier)))
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.leading)
                    if detectedChip {
                        Text("Detected")
                            .pantopusTextStyle(.overline)
                            .foregroundStyle(Theme.Color.primary700)
                            .padding(.horizontal, Spacing.s2)
                            .padding(.vertical, 2)
                            .background(Theme.Color.primary50)
                            .clipShape(Capsule())
                    }
                }
                Spacer(minLength: Spacing.s2)
                VStack(alignment: .trailing, spacing: 1) {
                    Text(gmtOffset(identifier))
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Text(localTime(identifier))
                        .pantopusTextStyle(.caption)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: - Formatting

    /// The display name with the active search substring highlighted in amber,
    /// mirroring the design's `<mark>` (case-insensitive, first match).
    private func highlightedName(_ name: String) -> AttributedString {
        var attributed = AttributedString(name)
        let needle = query.trimmingCharacters(in: .whitespaces)
        guard !needle.isEmpty,
              let range = name.range(of: needle, options: .caseInsensitive),
              let lower = AttributedString.Index(range.lowerBound, within: attributed),
              let upper = AttributedString.Index(range.upperBound, within: attributed)
        else { return attributed }
        attributed[lower..<upper].backgroundColor = Theme.Color.warningBg
        return attributed
    }

    private func cityName(_ identifier: String) -> String {
        if let tz = TimeZone(identifier: identifier),
           let name = tz.localizedName(for: .generic, locale: .current), !name.isEmpty {
            let city = identifier.split(separator: "/").last.map { $0.replacingOccurrences(of: "_", with: " ") } ?? ""
            return city.isEmpty ? name : "\(name) — \(city)"
        }
        return identifier.replacingOccurrences(of: "_", with: " ")
    }

    private func gmtOffset(_ identifier: String) -> String {
        guard let tz = TimeZone(identifier: identifier) else { return "" }
        let seconds = tz.secondsFromGMT()
        if seconds == 0 { return "GMT" }
        let sign = seconds < 0 ? "-" : "+"
        let hours = abs(seconds) / 3600
        let minutes = (abs(seconds) % 3600) / 60
        return minutes == 0 ? "GMT\(sign)\(hours)" : String(format: "GMT%@%d:%02d", sign, hours, minutes)
    }

    private func localTime(_ identifier: String) -> String {
        guard let tz = TimeZone(identifier: identifier) else { return "" }
        let fmt = DateFormatter()
        fmt.timeZone = tz
        fmt.timeStyle = .short
        fmt.dateStyle = .none
        return fmt.string(from: Date())
    }
}

#if DEBUG
#Preview {
    TimezoneSelectorSheet(
        selectedIdentifier: "America/New_York",
        onSelect: { _ in },
        onDone: {}
    )
}
#endif
