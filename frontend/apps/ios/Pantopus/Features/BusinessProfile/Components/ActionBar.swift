//
//  ActionBar.swift
//  Pantopus
//
//  A10.6 — the sticky bottom dock: a business-violet primary "Contact"
//  button beside a ghost secondary ("Book" when open, "Call" when
//  newly-claimed / closed), with an optional closed note above.
//
//  Design reference: `docs/designs/A10/business-frames.jsx` (ActionBar).
//

import SwiftUI

@MainActor
struct ActionBar: View {
    let dock: BusinessActionDock
    let onContact: @MainActor () -> Void
    let onBook: @MainActor () -> Void
    let onCall: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            if let note = dock.note {
                HStack(spacing: Spacing.s1) {
                    Icon(.clock, size: 11, color: Theme.Color.warning)
                    Text(note)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, 7)
                .accessibilityElement(children: .combine)
                .accessibilityLabel(note)
            }

            HStack(spacing: Spacing.s2) {
                secondaryButton
                primaryButton
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, dock.note == nil ? 10 : 8)
        .padding(.bottom, Spacing.s2)
        .background(
            Theme.Color.appSurface
                .opacity(0.97)
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                }
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private var primaryButton: some View {
        Button { onContact() } label: {
            HStack(spacing: Spacing.s1) {
                Icon(.messageCircle, size: 16, color: Theme.Color.appTextInverse)
                Text("Contact")
                    .font(.system(size: 14, weight: .bold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Theme.Color.business)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Contact")
        .accessibilityIdentifier("businessProfile.contact")
    }

    private var secondaryButton: some View {
        Button {
            if dock.secondary == .book { onBook() } else { onCall() }
        } label: {
            HStack(spacing: Spacing.s1) {
                Icon(secondaryIcon, size: 16, color: Theme.Color.appText)
                Text(secondaryLabel)
                    .font(.system(size: 14, weight: .semibold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.appText)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(secondaryLabel)
        .accessibilityIdentifier("businessProfile.\(dock.secondary == .book ? "book" : "call")")
    }

    private var secondaryIcon: PantopusIcon {
        dock.secondary == .book ? .calendarPlus : .phone
    }

    private var secondaryLabel: String {
        dock.secondary == .book ? "Book" : "Call"
    }
}

#Preview("ActionBar") {
    VStack {
        Spacer()
        ActionBar(
            dock: BusinessActionDock(secondary: .book, note: nil),
            onContact: {},
            onBook: {},
            onCall: {}
        )
        ActionBar(
            dock: BusinessActionDock(secondary: .call, note: "Closed now — messages answered at 8 AM"),
            onContact: {},
            onBook: {},
            onCall: {}
        )
    }
    .background(Theme.Color.appBg)
}
