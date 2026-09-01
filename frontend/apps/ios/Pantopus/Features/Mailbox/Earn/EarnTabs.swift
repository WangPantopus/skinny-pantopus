//
//  EarnTabs.swift
//  Pantopus
//
//  A10.11 Earn is two surfaces under one roof:
//
//  * **Offers** — the paid-offer wall the Mailbox Earn drawer exists for
//    (RN `src/app/mailbox/earn.tsx`): open an envelope, dwell, bank the
//    reward. This is the default tab because it is where money is made.
//  * **Earnings** — the designed A10.11 dashboard (balance hero, ways to
//    earn, recent earnings, payout settings, tax docs) fed by
//    `/api/mailbox/earnings/*`.
//
//  The strip below reuses the `ListOfRows` underline vocabulary so the
//  switch reads like every other tabbed surface in the app.
//

import SwiftUI

/// Which half of the Earn surface is showing.
public enum EarnTab: String, Hashable, CaseIterable, Sendable {
    case offers
    case earnings

    public var label: String {
        switch self {
        case .offers: "Offers"
        case .earnings: "Earnings"
        }
    }
}

/// Two-up underline tab strip for `EarnView`.
struct EarnTabStrip: View {
    @Binding var selected: EarnTab

    var body: some View {
        HStack(spacing: Spacing.s5) {
            ForEach(EarnTab.allCases, id: \.self) { tab in
                Button { selected = tab } label: {
                    VStack(spacing: Spacing.s1) {
                        Text(tab.label)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(
                                selected == tab
                                    ? Theme.Color.primary600
                                    : Theme.Color.appTextSecondary
                            )
                        Rectangle()
                            .fill(selected == tab ? Theme.Color.primary600 : .clear)
                            .frame(height: 2)
                    }
                    .frame(minHeight: 40)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.label)
                .accessibilityIdentifier("earnTab.\(tab.rawValue)")
                .accessibilityAddTraits(selected == tab ? [.isButton, .isSelected] : .isButton)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }
}

#Preview("Earn tabs") {
    StatefulPreviewWrapper(EarnTab.offers) { binding in
        EarnTabStrip(selected: binding)
    }
}

/// Tiny binding host so the strip can be previewed interactively.
private struct StatefulPreviewWrapper<Value, Content: View>: View {
    @State private var value: Value
    private let content: (Binding<Value>) -> Content

    init(_ value: Value, @ViewBuilder content: @escaping (Binding<Value>) -> Content) {
        _value = State(initialValue: value)
        self.content = content
    }

    var body: some View {
        content($value)
    }
}
