//
//  SavedPlaceRowView.swift
//  Pantopus
//

import SwiftUI

struct SavedPlaceRowView: View {
    let row: SavedPlaceRow
    let onTap: @MainActor () -> Void
    let onOverflow: @MainActor () -> Void
    let onSwipeOpen: @MainActor () -> Void
    let onSwipeRemove: @MainActor () -> Void

    /// Two 78pt action buttons revealed by the trailing swipe.
    private let revealWidth: CGFloat = 156
    @State private var offset: CGFloat = 0
    @GestureState private var dragging: CGFloat = 0

    var body: some View {
        ZStack(alignment: .trailing) {
            swipeActions
            rowContent
                .background(Theme.Color.appSurface)
                .offset(x: clampedOffset)
                .highPriorityGesture(swipeGesture)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("savedPlaces.row.\(row.id)")
    }

    private var clampedOffset: CGFloat {
        min(0, max(-revealWidth, offset + dragging))
    }

    // MARK: Main row

    private var rowContent: some View {
        HStack(spacing: Spacing.s3) {
            Button(action: onTap) {
                HStack(spacing: Spacing.s3) {
                    typeTile
                    textColumn
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            overflowButton
        }
        .padding(.leading, 14)
        .padding(.trailing, Spacing.s3)
        .padding(.vertical, 11)
    }

    private var typeTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(row.type.tileBackground)
            Icon(row.type.icon, size: 20, color: row.type.tileForeground)
        }
        .frame(width: 44, height: 44)
    }

    private var textColumn: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(row.label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
            HStack(spacing: Spacing.s2) {
                Text(row.subtitle)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
                if let pill = row.type.pillLabel {
                    typePill(pill)
                }
            }
            Text(row.savedCaption)
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextMuted)
                .lineLimit(1)
                .padding(.top, 1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func typePill(_ label: String) -> some View {
        Text(label)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(row.type.tileForeground)
            .padding(.horizontal, 6)
            .padding(.vertical, 1)
            .background(Capsule().fill(row.type.tileBackground))
    }

    private var overflowButton: some View {
        Button(action: onOverflow) {
            Icon(.moreHorizontal, size: 18, color: Theme.Color.appTextMuted)
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("More")
        .accessibilityIdentifier("savedPlaces.row.overflow")
    }

    // MARK: Swipe-to-reveal

    private var swipeActions: some View {
        HStack(spacing: 0) {
            swipeButton(icon: .map, label: "Open", tint: Theme.Color.primary600, id: "savedPlaces.row.swipeOpen") {
                reset()
                onSwipeOpen()
            }
            swipeButton(icon: .trash2, label: "Remove", tint: Theme.Color.error, id: "savedPlaces.row.swipeRemove") {
                reset()
                onSwipeRemove()
            }
        }
        .frame(width: revealWidth)
        .opacity(clampedOffset < -2 ? 1 : 0)
    }

    private func swipeButton(
        icon: PantopusIcon,
        label: String,
        tint: Color,
        id: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Icon(icon, size: 17, color: Theme.Color.appTextInverse)
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(tint)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }

    private var swipeGesture: some Gesture {
        DragGesture(minimumDistance: 14)
            .updating($dragging) { value, state, _ in
                // Keep vertical scrolling with the parent ScrollView.
                if abs(value.translation.width) > abs(value.translation.height) {
                    state = value.translation.width
                }
            }
            .onEnded { value in
                let projected = offset + value.translation.width
                withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
                    offset = projected < -revealWidth / 2 ? -revealWidth : 0
                }
            }
    }

    private func reset() {
        withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
            offset = 0
        }
    }
}
