//
//  PulseReactionPicker.swift
//  Pantopus
//
//  The emoji picker for a post's reactions: the seven emoji in one row, in
//  a popover anchored to the control that opened it (a Pulse card's
//  reaction pill, the post page's add-reaction button). Picking an emoji
//  sets it and closes the picker; picking the viewer's own takes it away.
//

import SwiftUI

/// The seven reaction emoji side by side, the viewer's own selected.
struct PulseReactionPicker: View {
    let selected: PostReactionEmoji?
    let onPick: @MainActor (PostReactionEmoji) -> Void

    var body: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(PostReactionEmoji.allCases) { emoji in
                option(emoji)
            }
        }
        .padding(Spacing.s1)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pulseReactionPicker")
    }

    private func option(_ emoji: PostReactionEmoji) -> some View {
        let isSelected = selected == emoji
        return Button { onPick(emoji) } label: {
            Text(emoji.rawValue)
                .font(.system(size: 24))
                .frame(width: 40, height: 40)
                .background(isSelected ? Theme.Color.primary100 : Color.clear, in: Circle())
                .overlay {
                    Circle().stroke(isSelected ? Theme.Color.primary600.opacity(0.35) : Color.clear, lineWidth: 1)
                }
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(emoji.name)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("pulseReactionOption_\(emoji.id)")
    }
}

extension View {
    /// Shows the reaction picker in a popover from this control while
    /// `isPresented` (a popover on iPhone too); a pick closes it.
    func pulseReactionPicker(
        isPresented: Binding<Bool>,
        selected: PostReactionEmoji?,
        onPick: @escaping @MainActor (PostReactionEmoji) -> Void
    ) -> some View {
        popover(isPresented: isPresented) {
            PulseReactionPicker(selected: selected) { emoji in
                isPresented.wrappedValue = false
                onPick(emoji)
            }
            .presentationCompactAdaptation(.popover)
            // A solid bubble: through the system's glass, the card's own buttons showed between the emoji.
            .presentationBackground(Theme.Color.appSurface)
        }
    }
}
