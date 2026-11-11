//
//  MomentsPostStage+Table.swift
//  Pantopus
//
//  Post on the iPhone Duo half folded on a table (the founder's Duo board
//  T5, approved 2026-11-11): the picture stands up whole on the top half
//  over a blurred copy of itself, with Retake; the flat half has a card with
//  a bigger map of where it pins and the options beside it (the phone
//  sheet's, without its small map). Typing a caption, the system's keyboard
//  fills the flat half, so the card rises above it onto the standing half.
//

import SwiftUI

extension MomentsPostStage {
    /// Board T5, from the screen's top-left corner.
    var tableStage: some View {
        let fold = duo.fold ?? CGRect(x: 0, y: ((duo.size.height - 40) / 2).rounded(), width: duo.size.width, height: 40)
        let tall = CGSize(width: (fold.minY * 9 / 16).rounded(), height: fold.minY)
        let card = CGSize(width: max(duo.size.width - 24, 0), height: 431)
        return ZStack(alignment: .topLeading) {
            GeometryReader { _ in
                ZStack(alignment: .topLeading) {
                    Color(white: 0.05)
                    Color.black
                        .frame(width: duo.size.width, height: fold.maxY)
                    blurredCopy
                        .frame(width: duo.size.width, height: fold.minY)
                    picture
                        .frame(width: tall.width, height: tall.height)
                        .clipped()
                        .shadow(color: .black.opacity(0.55), radius: 30)
                        .offset(x: ((duo.size.width - tall.width) / 2).rounded())
                    retakeButton
                        .offset(x: Spacing.s4, y: Spacing.s4)
                }
            }
            .ignoresSafeArea()
            // 12 pt in from the flat half's edges; above the keyboard while a caption is typed.
            GeometryReader { geo in
                MomentsTablePostCard(model: model, onPosted: onPosted)
                    .frame(width: card.width, height: card.height)
                    .offset(x: Spacing.s3, y: min(fold.maxY + 12.5, geo.size.height - Spacing.s3 - card.height))
            }
            .ignoresSafeArea(.container)
        }
    }
}

/// Board T5's card: the map of where it pins, 290 × 407, beside the options and Post.
private struct MomentsTablePostCard: View {
    let model: MomentsComposerModel
    let onPosted: () -> Void
    @Environment(AuthManager.self) private var auth

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            MomentsPostMap(
                pin: model.pin,
                showArea: model.showArea,
                me: me,
                placeholder: model.locating == .unavailable ? "Location is off" : "Finding where you are…",
                height: 407
            )
            .frame(width: 290)
            .padding(.top, Spacing.s3)
            MomentsPostSheet(model: model, asCard: true, mapHeight: 0, onPosted: onPosted)
                .padding(.top, 10)
        }
        // The options 331 wide, as drawn: 6 pt from the map and from the card's edge.
        .padding(.leading, Spacing.s3)
        .padding(.trailing, 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: Radii.xl3, style: .continuous).fill(Theme.Color.appSurface))
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl3, style: .continuous))
    }

    private var me: MomentAuthorDTO? {
        guard case let .signedIn(user) = auth.state else { return nil }
        return MomentAuthorDTO(me: user)
    }
}
