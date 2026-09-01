//
//  MapListHybridPreview.swift
//  Pantopus
//
//  T6.6a (P24) — DEBUG-only sample consumer of `MapListHybridShell`.
//  Renders the shell with seven sample pins (matching the colors in the
//  design's `map-frames.jsx` mock), a back/title/filter pill, a
//  category chip row, a locate-me / layers control stack, and three
//  preview states so the designer can flip across `.collapsed`,
//  `.standard`, and `.expanded` detents without running the app on
//  device. Not wired into any tab — reachable via `MapListHybridPreviewHost`
//  from the dev gallery.
//

#if DEBUG

import SwiftUI

/// Host that lets the dev gallery cycle through every detent state and
/// flip the active pin so the pulse halo + selection ring are visible.
public struct MapListHybridPreviewHost: View {
    @State private var detent: MapListHybridDetent = .standard
    @State private var selectedPinId: String? = "handyman-1"

    public init() {}

    private static let samplePins: [MapPin] = [
        MapPin(id: "handyman-1", latitude: 40.7494, longitude: -73.9867, color: Color(red: 234 / 255, green: 88 / 255, blue: 12 / 255)),
        MapPin(id: "cleaning-1", latitude: 40.7502, longitude: -73.9840, color: Color(red: 14 / 255, green: 165 / 255, blue: 233 / 255)),
        MapPin(
            id: "moving-1",
            latitude: 40.7470,
            longitude: -73.9810,
            color: Color(red: 124 / 255, green: 58 / 255, blue: 237 / 255),
            state: .pending
        ),
        MapPin(id: "petcare-1", latitude: 40.7459, longitude: -73.9882, color: Color(red: 22 / 255, green: 163 / 255, blue: 74 / 255)),
        MapPin(id: "childcare-1", latitude: 40.7515, longitude: -73.9905, color: Color(red: 219 / 255, green: 39 / 255, blue: 119 / 255)),
        MapPin(
            id: "tutoring-1",
            latitude: 40.7440,
            longitude: -73.9930,
            color: Color(red: 202 / 255, green: 138 / 255, blue: 4 / 255),
            state: .pending
        ),
        MapPin(id: "handyman-2", latitude: 40.7460, longitude: -73.9990, color: Color(red: 234 / 255, green: 88 / 255, blue: 12 / 255))
    ]

    private static let anchor = MapAnchor(latitude: 40.7484, longitude: -73.9857)

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            detentPicker
            MapListHybridShell(
                pins: Self.samplePins,
                anchor: Self.anchor,
                selectedPinId: selectedPinId,
                detent: $detent,
                onPinTap: { id in
                    selectedPinId = id
                    detent = .standard
                },
                topPill: {
                    PreviewTopPill()
                },
                categoryChips: {
                    PreviewCategoryChips()
                },
                mapControls: {
                    PreviewMapControls()
                },
                sheetHeader: {
                    PreviewSheetHeader(count: Self.samplePins.count)
                },
                sheetBody: {
                    PreviewSheetBody(
                        pins: Self.samplePins,
                        selectedPinId: selectedPinId,
                        detent: detent,
                        onSelect: { id in
                            selectedPinId = id
                            detent = .standard
                        },
                        onExpand: {
                            detent = .standard
                        }
                    )
                }
            )
        }
        .background(Theme.Color.appBg)
    }

    private var detentPicker: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(MapListHybridDetent.allCases, id: \.self) { stop in
                Button {
                    withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
                        detent = stop
                    }
                } label: {
                    Text(label(for: stop))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(stop == detent ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                        .padding(.horizontal, Spacing.s3)
                        .frame(height: 28)
                        .background(stop == detent ? Theme.Color.primary600 : Theme.Color.appSurface)
                        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("mapListHybridPreviewDetent_\(stop)")
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    private func label(for detent: MapListHybridDetent) -> String {
        switch detent {
        case .collapsed: "Collapsed (20%)"
        case .standard: "Standard (40%)"
        case .expanded: "Expanded (90%)"
        }
    }
}

// MARK: - Slot stand-ins (preview chrome)

private struct PreviewTopPill: View {
    var body: some View {
        HStack(spacing: Spacing.s0) {
            Button {} label: {
                Icon(.chevronLeft, size: 18, strokeWidth: 2.2, color: Theme.Color.appText)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            Spacer(minLength: Spacing.s1)
            Text("Gigs")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: Spacing.s1)
            Button {} label: {
                Icon(.slidersHorizontal, size: 16, strokeWidth: 2.2, color: Theme.Color.appText)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Filters")
        }
        .padding(.horizontal, 6)
        .padding(.vertical, Spacing.s2)
        .background(.ultraThinMaterial)
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.10), radius: 8, x: 0, y: 4)
        .accessibilityIdentifier("mapListHybridPreviewTopPill")
    }
}

private struct PreviewCategoryChips: View {
    private struct CategoryEntry {
        let key: String
        let label: String
        let color: Color
    }

    private static let categories: [CategoryEntry] = [
        CategoryEntry(key: "all", label: "All", color: Theme.Color.primary600),
        CategoryEntry(key: "handyman", label: "Handyman", color: Color(red: 234 / 255, green: 88 / 255, blue: 12 / 255)),
        CategoryEntry(key: "cleaning", label: "Cleaning", color: Color(red: 14 / 255, green: 165 / 255, blue: 233 / 255)),
        CategoryEntry(key: "moving", label: "Moving", color: Color(red: 124 / 255, green: 58 / 255, blue: 237 / 255)),
        CategoryEntry(key: "petcare", label: "Pet care", color: Color(red: 22 / 255, green: 163 / 255, blue: 74 / 255)),
        CategoryEntry(key: "childcare", label: "Child care", color: Color(red: 219 / 255, green: 39 / 255, blue: 119 / 255)),
        CategoryEntry(key: "tutoring", label: "Tutoring", color: Color(red: 202 / 255, green: 138 / 255, blue: 4 / 255))
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(Self.categories, id: \.key) { entry in
                    let active = entry.key == "all"
                    HStack(spacing: 5) {
                        if entry.key != "all" {
                            Circle()
                                .fill(entry.color)
                                .frame(width: 7, height: 7)
                        }
                        Text(entry.label)
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .frame(height: 28)
                    .background(active ? entry.color : Color.white.opacity(0.96))
                    .overlay(Capsule().stroke(active ? .clear : Theme.Color.appBorder, lineWidth: 1))
                    .clipShape(Capsule())
                    .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
                    .accessibilityIdentifier("mapListHybridPreviewChip_\(entry.key)")
                }
            }
            .padding(.horizontal, 14)
        }
    }
}

private struct PreviewMapControls: View {
    var body: some View {
        VStack(spacing: Spacing.s2) {
            controlButton(icon: .mapPin, label: "Locate me")
            controlButton(icon: .map, label: "Layers")
        }
    }

    private func controlButton(icon: PantopusIcon, label: String) -> some View {
        Button {} label: {
            Icon(icon, size: 16, color: Theme.Color.appText)
                .frame(width: 38, height: 38)
                .background(.ultraThinMaterial)
                .overlay(Circle().stroke(Theme.Color.appBorder, lineWidth: 1))
                .clipShape(Circle())
                .shadow(color: .black.opacity(0.10), radius: 4, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

private struct PreviewSheetHeader: View {
    let count: Int

    var body: some View {
        HStack {
            Text("\(count) gigs nearby")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            HStack(spacing: Spacing.s1) {
                Text("Sort:")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text("Closest")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                Icon(.chevronDown, size: 12, strokeWidth: 2.4, color: Theme.Color.appTextStrong)
            }
            .accessibilityIdentifier("mapListHybridPreviewSort")
        }
        .padding(.horizontal, 18)
        .padding(.top, Spacing.s1)
        .padding(.bottom, Spacing.s3)
    }
}

private struct PreviewSheetBody: View {
    let pins: [MapPin]
    let selectedPinId: String?
    let detent: MapListHybridDetent
    let onSelect: (String) -> Void
    let onExpand: () -> Void

    var body: some View {
        switch detent {
        case .collapsed:
            HStack(spacing: Spacing.s2) {
                Icon(.chevronUp, size: 13, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                Text("Drag up to see the list")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 36)
            .background(Theme.Color.appSurfaceSunken)
            .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            .clipShape(Capsule())
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s3)
            .contentShape(Rectangle())
            .onTapGesture { onExpand() }
            .accessibilityIdentifier("mapListHybridPreviewCollapsedPrompt")
        case .standard:
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(pins.prefix(8)) { pin in
                        Button { onSelect(pin.id) } label: {
                            PreviewCard(pin: pin, selected: pin.id == selectedPinId)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("mapListHybridPreviewCard_\(pin.id)")
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s3)
            }
        case .expanded:
            ScrollView {
                LazyVStack(spacing: Spacing.s0) {
                    ForEach(pins) { pin in
                        Button { onSelect(pin.id) } label: {
                            PreviewRow(pin: pin, selected: pin.id == selectedPinId)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("mapListHybridPreviewRow_\(pin.id)")
                    }
                    Spacer(minLength: 60)
                }
            }
        }
    }
}

private struct PreviewCard: View {
    let pin: MapPin
    let selected: Bool

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(LinearGradient(colors: [pin.color, pin.color.opacity(0.8)], startPoint: .topLeading, endPoint: .bottomTrailing))
                Icon(.hammer, size: 22, color: .white)
            }
            .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Sample task for pin \(pin.id)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text("$60 · 0.2 mi")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
            }
        }
        .padding(Spacing.s3)
        .frame(width: 240, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(selected ? pin.color : Theme.Color.appBorder, lineWidth: selected ? 2 : 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 2)
    }
}

private struct PreviewRow: View {
    let pin: MapPin
    let selected: Bool

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(LinearGradient(colors: [pin.color, pin.color.opacity(0.8)], startPoint: .topLeading, endPoint: .bottomTrailing))
                Icon(.hammer, size: 20, color: .white)
            }
            .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Sample task for pin \(pin.id)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
                Text("$60 · 0.2 mi")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(selected ? pin.color.opacity(0.06) : Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }
}

#Preview("Standard detent") {
    MapListHybridPreviewHost()
}

#endif
