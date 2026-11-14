//
//  MomentsHeightsChip.swift
//  Pantopus
//
//  Under the Moments map's top row, at the left (board H2): the "Elevation"
//  chip, which turns the pins' height tags on and off, and beside it the
//  key's five colours, which open the key ("Elevation above sea level") and
//  close it again. The board's key is a card at the bottom of the map; the
//  real map's bottom holds Play all, +, the row of faces and the cards, so
//  the key opens here instead and goes when the map is touched.
//
//  All of it shows only while the map's answer says heights are on for you
//  (`heights_on`, contract v3.9). The chip's choice is kept on the phone, per
//  account, and starts on.
//

import SwiftUI

struct MomentsHeightsBar: View {
    let viewModel: MomentsMapViewModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if viewModel.heightsOn {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack(spacing: Spacing.s2) {
                    chip
                    if viewModel.showsHeightTags { keyButton.transition(.opacity) }
                    if let time = viewModel.sunChipTime { MomentsSunChip(time: time).transition(.opacity) }
                }
                if viewModel.showsHeightTags, viewModel.heightsKeyOpen {
                    MomentsHeightKey()
                        .onTapGesture { viewModel.heightsKeyOpen = false }
                        .transition(reduceMotion ? .opacity : .scale(scale: 0.92, anchor: .topLeading).combined(with: .opacity))
                }
            }
            .animation(reduceMotion ? nil : .snappy(duration: 0.22), value: viewModel.heightsKeyOpen)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: viewModel.showsHeightTags)
        }
    }

    private var chip: some View {
        let on = viewModel.showsHeightTags
        return Button { viewModel.toggleHeightTags() } label: {
            HStack(spacing: 6) {
                // The mountains are wider than they are tall: room for them, so they don't touch the word.
                Icon(.mountain, size: 15, strokeWidth: 2.25, color: on ? .white : Theme.Color.appText)
                    .frame(width: 24)
                Text("Elevation")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(on ? .white : Theme.Color.appText)
                if on { Icon(.check, size: 13, strokeWidth: 2.75, color: .white) }
            }
            .padding(.horizontal, 14)
            .frame(height: Self.chipHeight)
            .background { chipSurface(on: on) }
            .frame(minHeight: 44)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Elevation")
        .accessibilityValue(on ? "On" : "Off")
        .accessibilityHint("Shows how high above sea level each Moment was made")
        .accessibilityAddTraits(.isToggle)
        .accessibilityIdentifier("moments.heights.chip")
    }

    /// On, the board's filled chip; off, the map's glass, like the pills beside it.
    @ViewBuilder
    private func chipSurface(on: Bool) -> some View {
        if on {
            Capsule()
                .fill(Theme.Color.primarySolid)
                .shadow(color: Theme.Color.primarySolid.opacity(0.35), radius: 5, x: 0, y: 2)
        } else {
            Capsule().fill(.clear).momentsGlass(Capsule())
        }
    }

    /// The key, folded: its five colours. A tap opens it.
    private var keyButton: some View {
        Button { viewModel.heightsKeyOpen.toggle() } label: {
            HStack(spacing: Spacing.s1) {
                ForEach(MomentHeightBand.allCases, id: \.self) { band in
                    Circle().fill(MomentsPalette.height(band)).frame(width: 8, height: 8)
                }
                Icon(viewModel.heightsKeyOpen ? .chevronUp : .chevronDown, size: 12, strokeWidth: 2.25, color: Theme.Color.appTextSecondary)
                    .padding(.leading, 2)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: Self.chipHeight)
            .momentsGlass(Capsule())
            .frame(minHeight: 44)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Elevation colors")
        .accessibilityValue(viewModel.heightsKeyOpen ? "Open" : "Closed")
        .accessibilityHint("Shows what each color means")
        .accessibilityIdentifier("moments.heights.keyButton")
    }

    static let chipHeight: CGFloat = 36
    /// How much lower "Your Moment is live" sits while the chip is under the top row.
    static let drop: CGFloat = 44
}

/// Board H2's key: "Elevation above sea level", a bar per band with where it starts, and flying.
private struct MomentsHeightKey: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Elevation above sea level")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            HStack(alignment: .top, spacing: Spacing.s1) {
                ForEach(MomentHeightBand.allCases, id: \.self) { band in
                    VStack(alignment: .leading, spacing: 5) {
                        bar(band)
                        Text(band.keyLabel)
                            .font(.system(size: 11.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .frame(width: 292)
        .momentsGlass(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Elevation above sea level: " + MomentHeightBand.allCases.map(\.spoken).joined(separator: "; "))
        .accessibilityHint("Closes")
        .accessibilityIdentifier("moments.heights.key")
    }

    /// A band's bar; flying is a broken one, with its plane, so it never reads as a fifth step up.
    @ViewBuilder
    private func bar(_ band: MomentHeightBand) -> some View {
        let color = MomentsPalette.height(band)
        if band == .flying {
            HStack(spacing: 3) {
                ForEach(0..<4, id: \.self) { _ in Capsule().fill(color) }
                Icon(.plane, size: 10, strokeWidth: 2.5, color: color)
            }
            .frame(height: 7)
        } else {
            Capsule().fill(color).frame(height: 7)
        }
    }
}

extension MomentsMapViewModel {
    /// The pins carry height tags: heights are on for you and the chip hasn't turned them off.
    var showsHeightTags: Bool {
        heightsOn && !heightTagsOff
    }

    /// "Your Moment is live" sits under the chip while there is one.
    var heightsNoteDrop: CGFloat {
        heightsOn ? MomentsHeightsBar.drop : 0
    }

    /// The map's answer said whether heights are on for you: with them, the chip's last choice on this phone.
    func heightsAnswered(_ on: Bool) {
        if on, let key = Self.heightTagsOffKey { heightTagsOff = UserDefaults.standard.bool(forKey: key) }
        if heightsOn != on { heightsOn = on }
        if !on { closeHeightsKey() }
    }

    /// The chip: tags on or off, kept on the phone per account. The key goes with the tags.
    func toggleHeightTags() {
        heightTagsOff.toggle()
        if heightTagsOff { closeHeightsKey() }
        if let key = Self.heightTagsOffKey { UserDefaults.standard.set(heightTagsOff, forKey: key) }
    }

    func closeHeightsKey() {
        if heightsKeyOpen { heightsKeyOpen = false }
    }

    /// Kept as "off", so a phone that has never seen the chip starts with the tags on.
    private static var heightTagsOffKey: String? {
        guard case let .signedIn(user) = AuthManager.shared.state else { return nil }
        return "pantopus.moments.heightTagsOff.\(user.id)"
    }
}
