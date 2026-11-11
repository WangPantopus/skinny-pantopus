//
//  MomentsTextCardEditor+Table.swift
//  Pantopus
//
//  The text card on the iPhone Duo half folded on a table (the founder's
//  Duo board T4, approved 2026-11-11): the card stands up on the top half as
//  others will see it, in the Moment's tall shape, over its colors dimmed.
//  The system's keyboard fills the whole flat half (measured on the Duo
//  simulator), so Close, where it pins, Next, the count and the backgrounds
//  sit on the standing half beside the card. With the keyboard down, the
//  flat half has Library · Camera · Text.
//

import SwiftUI

extension MomentsTextCardEditor {
    /// Board T4, from the screen's top-left corner.
    var tableLayout: some View {
        let colors = MomentsPalette.card(model.background)
        let fold = duo.fold ?? CGRect(x: 0, y: ((duo.size.height - 40) / 2).rounded(), width: duo.size.width, height: 40)
        let width = (fold.minY * 9 / 16).rounded()
        let card = CGRect(x: ((duo.size.width - width) / 2).rounded(), y: 0, width: width, height: fold.minY)
        // Beside the card: 16 pt from it and from the screen's edges; on the right, below the clock.
        let sideWidth = max(card.minX - 32, 0)
        let rightTop = max(Spacing.s4, duo.occludedBottom(from: card.maxX, to: duo.size.width) + Spacing.s4)
        return GeometryReader { _ in
            ZStack(alignment: .topLeading) {
                Color(white: 0.05)
                Color.black
                    .frame(width: duo.size.width, height: fold.maxY)
                LinearGradient(
                    colors: [colors.top, colors.bottom],
                    startPoint: UnitPoint(x: 0.33, y: 0),
                    endPoint: UnitPoint(x: 0.67, y: 1)
                )
                .overlay(Color.black.opacity(0.58))
                .frame(width: duo.size.width, height: fold.minY)
                .onTapGesture { focused = true }
                tableCard(colors: colors, size: card.size)
                    .offset(x: card.minX)
                Button(action: onClose) {
                    Icon(.x, size: 22, strokeWidth: 2.2, color: .white)
                        .frame(width: 44, height: 44)
                        .background(Circle().fill(Color.white.opacity(0.12)))
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
                .accessibilityIdentifier("moments.camera.close")
                .offset(x: Spacing.s4, y: Spacing.s4)
                MomentsPlaceChip(place: model.placeChip, style: .onBlack)
                    .frame(maxWidth: sideWidth, alignment: .leading)
                    .offset(x: Spacing.s4, y: 72)
                nextButton(ink: colors.top)
                    .frame(width: 72, alignment: .trailing)
                    .offset(x: duo.size.width - Spacing.s5 - 72, y: rightTop)
                counter
                    .frame(width: sideWidth)
                    .offset(x: card.maxX + Spacing.s4, y: rightTop + 62)
                swatchGrid
                    .frame(width: sideWidth)
                    .offset(x: card.maxX + Spacing.s4, y: rightTop + 86)
                if !focused {
                    MomentsModeTabs(model: model)
                        .frame(width: duo.size.width)
                        .offset(y: fold.maxY + 372.5)
                }
            }
        }
        .ignoresSafeArea()
        .onAppear { focused = true }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.textCard")
    }

    /// The card as others will see it: the words 19 pt, centered. A vertical field is taller than its lines and keeps
    /// them at its top, so it gets the words' own height (a hidden copy measures it at the same width), as on board O8.
    private func tableCard(colors: (top: Color, bottom: Color), size: CGSize) -> some View {
        ZStack {
            LinearGradient(colors: [colors.top, colors.bottom], startPoint: UnitPoint(x: 0.33, y: 0), endPoint: UnitPoint(x: 0.67, y: 1))
            field(size: 19, lineSpacing: 5.5, lines: 14)
                .frame(height: wideWordsHeight > 0 ? wideWordsHeight : nil)
                .background(alignment: .top) {
                    Text(model.text.isEmpty ? "What's happening here?" : model.text)
                        .font(.system(size: 19, weight: .semibold))
                        .lineSpacing(5.5)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .hidden()
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { wideWordsHeight = $0 }
                }
                .padding(.horizontal, 22)
                .padding(.vertical, Spacing.s6)
        }
        .frame(width: size.width, height: size.height)
        .shadow(color: .black.opacity(0.5), radius: 30)
        .contentShape(Rectangle())
        .onTapGesture { focused = true }
    }

    /// The six backgrounds in two rows of three, beside the card.
    private var swatchGrid: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                ForEach(Array(MomentsComposerModel.backgrounds.prefix(3)), id: \.self) { swatch($0) }
            }
            HStack(spacing: 10) {
                ForEach(Array(MomentsComposerModel.backgrounds.dropFirst(3)), id: \.self) { swatch($0) }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Background color")
    }
}
