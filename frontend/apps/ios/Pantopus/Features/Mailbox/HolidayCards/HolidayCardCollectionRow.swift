//
//  HolidayCardCollectionRow.swift
//  Pantopus
//
//  The collections at the top of "Pick a card" (`holiday_cards`; the web's
//  `SendCardFlow`): each one's name as a pill, on one line that scrolls
//  sideways, the one shown in wax red. VoiceOver reads the row as
//  "Collections" and says which one is selected.
//

import SwiftUI

struct HolidayCardCollectionRow: View {
    let collections: [HolidayCardCollection]
    /// The collection whose pictures show under the row.
    let shown: HolidayCardCollection
    let onPick: (HolidayCardCollection) -> Void

    var body: some View {
        ScrollViewReader { scroller in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(collections) { collection in
                        chip(collection, isShown: collection.id == shown.id) {
                            onPick(collection)
                            withAnimation(.easeOut(duration: 0.25)) { scroller.scrollTo(collection.id, anchor: .center) }
                        }
                        .id(collection.id)
                    }
                }
                .padding(.horizontal, Spacing.s4)
            }
            // Out to the screen's edges, so the names scroll under them.
            .padding(.horizontal, -Spacing.s4)
            // The one shown sits mid-row, clear of the edges; back from step
            // 3 that's the collection holding the chosen card.
            .onAppear { scroller.scrollTo(shown.id, anchor: .center) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Collections")
        .accessibilityIdentifier("sendCardCollections")
    }

    /// A name as a pill: the flow's paper button, or wax red for the one shown.
    private func chip(_ collection: HolidayCardCollection, isShown: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(collection.name)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(isShown ? MailPaper.waxText : MailPaper.cardTextSoft)
                .lineLimit(1)
                .fixedSize()
                .padding(.horizontal, Spacing.s4)
                .frame(height: 36)
                .background(isShown ? MailPaper.wax : MailPaper.cardField, in: Capsule())
                .overlay(Capsule().strokeBorder(isShown ? MailPaper.wax : MailPaper.cardFieldEdge, lineWidth: 1))
                // Drawn 36 points tall, touched across 44.
                .padding(.vertical, Spacing.s1)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(collection.name)
        .accessibilityAddTraits(isShown ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("sendCardCollection.\(collection.id)")
    }
}
