//
//  ChannelHeader.swift
//  Pantopus
//
//  A14.5 Notifications — the tinted column-header band that opens each
//  category card. Three mono letters (P · E · S) right-aligned over the
//  `ChannelTriad` chips below, in an `appSurfaceMuted` strip with a
//  hairline bottom border. Lives beside `ChannelChip` / `ChannelTriad`
//  (P1.2) so the shared `GroupedListView` can render it without reaching
//  into a feature folder.
//

import SwiftUI

/// The P/E/S column-header band. Letters are decorative — the chips
/// below carry the full "Push / Email / SMS" accessibility labels — so
/// the band is hidden from VoiceOver to avoid a redundant announcement.
@MainActor
public struct ChannelHeader: View {
    public init() {}

    public var body: some View {
        HStack(spacing: Spacing.s0) {
            Spacer(minLength: Spacing.s0)
            HStack(spacing: Spacing.s1) {
                ForEach(ChannelGlyph.allCases, id: \.self) { glyph in
                    Text(glyph.letter)
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .kerning(0.6)
                        .frame(width: 22)
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, 10)
        .padding(.bottom, 6)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.appBorder.opacity(0.6))
                .frame(height: 1)
        }
        .accessibilityHidden(true)
    }
}

#Preview("Channel header") {
    VStack(spacing: Spacing.s0) {
        ChannelHeader()
        Text("Row content sits below")
            .font(.system(size: 13))
            .padding(Spacing.s4)
    }
    .background(Theme.Color.appSurface)
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
