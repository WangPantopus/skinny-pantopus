//
//  CTAs.swift
//  Pantopus
//
//  Call-to-action slots for the Content Detail shell. `FABCreateCTA` is
//  the concrete one used by HomeDashboard; the rest ship as `EmptyView`
//  stubs so screens can reference them without branching at compile time.
//

import SwiftUI

/// One action in the FAB bottom-sheet.
public struct FABSheetAction: Sendable, Identifiable {
    public let id: String
    public let title: String
    public let icon: PantopusIcon

    public init(id: String = UUID().uuidString, title: String, icon: PantopusIcon) {
        self.id = id
        self.title = title
        self.icon = icon
    }
}

/// 56pt primary-filled plus button; reveals a bottom-sheet menu.
public struct FABCreateCTA: View {
    private let actions: [FABSheetAction]
    private let onSelect: @MainActor (String) -> Void

    @State private var sheetVisible = false

    public init(actions: [FABSheetAction], onSelect: @escaping @MainActor (String) -> Void) {
        self.actions = actions
        self.onSelect = onSelect
    }

    public var body: some View {
        Button { sheetVisible = true } label: {
            Icon(.plusCircle, size: 26, color: Theme.Color.appTextInverse)
                .frame(width: 56, height: 56)
                .background(Theme.Color.primary600)
                .clipShape(Circle())
                .pantopusShadow(.primary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Create")
        .accessibilityIdentifier("homeDashboardFab")
        .sheet(isPresented: $sheetVisible) {
            FABSheet(actions: actions) { id in
                sheetVisible = false
                onSelect(id)
            }
            .presentationDetents([.fraction(0.35), .medium])
        }
    }
}

private struct FABSheet: View {
    let actions: [FABSheetAction]
    let onSelect: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Create")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
                .padding(.vertical, Spacing.s2)
            ForEach(actions) { action in
                Button { onSelect(action.id) } label: {
                    HStack(spacing: Spacing.s3) {
                        Icon(action.icon, size: 20, color: Theme.Color.primary600)
                            .frame(width: 36, height: 36)
                            .background(Theme.Color.primary100)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                        Text(action.title)
                            .pantopusTextStyle(.body)
                            .foregroundStyle(Theme.Color.appText)
                        Spacer()
                        Icon(.chevronRight, size: 18, color: Theme.Color.appTextSecondary)
                    }
                    .frame(minHeight: 56)
                    .padding(.horizontal, Spacing.s3)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(action.title)
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appBg)
    }
}

/// Sticky bottom action row — stubbed until a screen needs it.
public struct StickyBottomActionStub: View {
    public init() {}
    public var body: some View {
        EmptyView()
    }
}

/// Convenience empty CTA for screens that don't need one.
public struct NoCTA: View {
    public init() {}
    public var body: some View {
        EmptyView()
    }
}
