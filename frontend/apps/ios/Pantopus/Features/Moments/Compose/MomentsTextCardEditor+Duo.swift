//
//  MomentsTextCardEditor+Duo.swift
//  Pantopus
//
//  The text card on the iPhone Duo (the founder's Duo boards, approved
//  2026-11-11). Closed (C7): the card fills the column beside the side strip,
//  with Close in the strip; the words a little smaller than on the phone so
//  they fit above the keyboard. Open sideways, flat or like a book (O8): the
//  card whole on the left half above the keyboard, in the Moment's tall
//  shape, as others will see it; on the right Close, where it pins, Next, the
//  backgrounds, the count and Library · Camera · Text.
//

import SwiftUI

extension MomentsTextCardEditor {
    // MARK: - Closed (C7)

    var closedLayout: some View {
        let colors = MomentsPalette.card(model.background)
        return ZStack(alignment: .topLeading) {
            GeometryReader { _ in
                LinearGradient(
                    colors: [colors.top, colors.bottom],
                    startPoint: UnitPoint(x: 0.33, y: 0),
                    endPoint: UnitPoint(x: 0.67, y: 1)
                )
                .frame(width: duo.column.width, height: duo.size.height)
                .clipShape(UnevenRoundedRectangle(bottomTrailingRadius: 24, topTrailingRadius: 24, style: .continuous))
                .onTapGesture { focused = true }
            }
            .ignoresSafeArea()
            VStack(spacing: 0) {
                // Where it pins, in the middle of the room beside Next (Close is in the strip).
                HStack(spacing: 0) {
                    Spacer(minLength: 0)
                    MomentsPlaceChip(place: model.placeChip, style: .onCard)
                    Spacer(minLength: 0)
                    nextButton(ink: colors.top)
                }
                .padding(.horizontal, Spacing.s3)
                .frame(height: 36)
                .padding(.top, 14)
                Spacer(minLength: Spacing.s4)
                field(size: 26, lineSpacing: 2, lines: 8)
                    .padding(.horizontal, 28)
                Spacer(minLength: Spacing.s4)
                counter
                swatches(spacing: 10)
                    .padding(.top, Spacing.s3)
                    .padding(.bottom, focused ? 40 : Spacing.s3)
                if !focused {
                    MomentsModeTabs(model: model)
                        .padding(.bottom, Spacing.s1)
                }
            }
            .frame(width: duo.column.width)
            // Close in the strip, under the clock; the strip ends at the keyboard.
            GeometryReader { geo in
                MomentsStripButtons(screen: duo, height: geo.size.height, top: [closeItem], bottom: nil)
            }
            .ignoresSafeArea(.container)
        }
        .onAppear { focused = true }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.textCard")
    }

    private var closeItem: MomentsStripButtons.Item {
        MomentsStripButtons.Item(id: "moments.camera.close", icon: .x, label: "Close") { onClose() }
    }

    // MARK: - Open sideways (O8)

    var wideLayout: some View {
        let colors = MomentsPalette.card(model.background)
        let column = duo.card
        return ZStack(alignment: .topLeading) {
            // The card in the Moment's tall shape, in the middle of the left half, 12 pt from the top and the keyboard.
            GeometryReader { geo in
                let height = max(geo.size.height - 24, 160)
                let width = (height * 9 / 16).rounded()
                card(colors: colors, width: width, height: height)
                    .offset(x: ((duo.leftHalf.width - width) / 2).rounded(), y: 12)
            }
            .ignoresSafeArea(.container)
            // The right half, in the card's place beside the map.
            GeometryReader { _ in
                ZStack(alignment: .topLeading) {
                    Button(action: onClose) {
                        Icon(.x, size: 26, strokeWidth: 2, color: .white)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Close")
                    .accessibilityIdentifier("moments.camera.close")
                    .offset(x: column.minX, y: column.minY + 2)
                    MomentsPlaceChip(place: model.placeChip, style: .onBlack)
                        .frame(width: column.width - 124)
                        .offset(x: column.minX + 44, y: column.minY + 7)
                    nextButton(ink: colors.top)
                        .frame(width: 72, alignment: .trailing)
                        .offset(x: column.maxX - 72, y: column.minY + 6)
                    Text("Background")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.75))
                        .frame(width: column.width)
                        .accessibilityHidden(true)
                        .offset(x: column.minX, y: column.minY + 122)
                    swatches(spacing: 10)
                        .frame(width: column.width)
                        .offset(x: column.minX, y: column.minY + 146)
                    counter
                        .frame(width: column.width)
                        .offset(x: column.minX, y: column.minY + 210)
                    MomentsModeTabs(model: model)
                        .frame(width: column.width)
                        .offset(x: column.minX, y: column.minY + 328)
                }
            }
            .ignoresSafeArea()
        }
        .onAppear { focused = true }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.textCard")
    }

    /// Board O8's card: 217 x 385 above the drawn keyboard, the words 16 pt; larger with more room.
    private func card(colors: (top: Color, bottom: Color), width: CGFloat, height: CGFloat) -> some View {
        let scale = width / 217
        return ZStack {
            LinearGradient(colors: [colors.top, colors.bottom], startPoint: UnitPoint(x: 0.33, y: 0), endPoint: UnitPoint(x: 0.67, y: 1))
            // A vertical field is taller than its lines and keeps them at its top: it gets the words' own height
            // (a hidden copy measures it at the same width), so the card centers them as the posted card does.
            field(size: 16 * scale, lineSpacing: 1.4 * scale, lines: 14)
                .frame(height: wideWordsHeight > 0 ? wideWordsHeight : nil)
                .background(alignment: .top) {
                    Text(model.text.isEmpty ? "What's happening here?" : model.text)
                        .font(.system(size: 16 * scale, weight: .semibold))
                        .lineSpacing(1.4 * scale)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .hidden()
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { wideWordsHeight = $0 }
                }
                .padding(.horizontal, 18 * scale)
                .padding(.vertical, 20 * scale)
        }
        .frame(width: width, height: height)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 21, style: .continuous).strokeBorder(Color.white.opacity(0.1), lineWidth: 1).padding(-1))
        .contentShape(Rectangle())
        .onTapGesture { focused = true }
    }

    // MARK: - Parts

    /// The words, white and centered, on the card.
    func field(size: CGFloat, lineSpacing: CGFloat, lines: Int) -> some View {
        TextField(
            "",
            text: Binding(get: { model.text }, set: { model.text = $0 }),
            prompt: Text("What's happening here?").foregroundColor(Color.white.opacity(0.6)),
            axis: .vertical
        )
        .font(.system(size: size, weight: .semibold))
        .lineSpacing(lineSpacing)
        .multilineTextAlignment(.center)
        .foregroundStyle(.white)
        .tint(.white)
        .lineLimit(1...lines)
        .focused($focused)
        .accessibilityLabel("Your text")
        .accessibilityIdentifier("moments.textCard.field")
    }

    var counter: some View {
        Text("\(model.text.count) / \(MomentsComposerModel.textLimit)")
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(Color.white.opacity(0.78))
            .accessibilityIdentifier("moments.textCard.count")
    }
}
