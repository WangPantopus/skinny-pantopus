//
//  SchedulingStubScaffold.swift
//  Pantopus
//
//  Foundation (I0b) — the shared placeholder body every routed stub renders
//  until its feature stream builds the real screen. Keeps stubs uniform and
//  guarantees each `SchedulingRoute` case resolves to a view that renders in a
//  `#Preview` without crashing. Tokens only — no hardcoded colors/spacing.
//

import SwiftUI

/// A calm, themed "coming together" placeholder shown by every routed
/// `SchedulingRoute` stub. Replaced when the owning feature stream builds out
/// the screen.
struct SchedulingStubScaffold: View {
    let screenID: String
    let title: String
    let stream: String

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Spacer(minLength: 0)
            ZStack {
                Circle()
                    .fill(Theme.Color.primary50)
                    .frame(width: 72, height: 72)
                Icon(.calendarClock, size: 30, strokeWidth: 1.8, color: Theme.Color.primary600)
            }
            VStack(spacing: Spacing.s2) {
                Text(title)
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                Text(verbatim: "Foundation stub · \(screenID) · \(stream)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Text("Routing is wired and ready for the \(stream) stream to build this screen.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.s8)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("scheduling.stub.\(screenID)")
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        SchedulingStubScaffold(screenID: "A1", title: "Scheduling Hub", stream: "I1")
    }
}
#endif
