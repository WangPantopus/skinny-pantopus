//
//  MomentsPostStage+Duo.swift
//  Pantopus
//
//  Post on the iPhone Duo (the founder's Duo boards, approved 2026-11-11).
//  Closed (C8): the phone's sheet in the column beside the side strip, over
//  the picture, with a smaller map so it all fits. Open sideways, flat or
//  like a book (O9, B2): the picture whole on the left half, in the Moment's
//  tall shape, with Retake; the options as a card on the right, ending above
//  the keyboard while a caption is typed. Upright (U3), and on a table until
//  its own layout: the picture whole over a blurred copy of itself, and the
//  phone's sheet, 431 wide, in the middle.
//

import SwiftUI

extension MomentsPostStage {
    // MARK: - Closed (C8)

    var closedStage: some View {
        ZStack(alignment: .topLeading) {
            GeometryReader { _ in
                Color.black
                    .overlay { backdrop }
                    .frame(width: duo.column.width, height: duo.size.height)
                    .clipShape(UnevenRoundedRectangle(bottomTrailingRadius: 24, topTrailingRadius: 24, style: .continuous))
            }
            .ignoresSafeArea()
            retakeButton
                .padding(.leading, Spacing.s3)
                .padding(.top, Spacing.s3)
            VStack(spacing: 0) {
                Spacer(minLength: 96)
                sheet(mapHeight: 110)
                    .layoutPriority(1)
            }
            .ignoresSafeArea(.container, edges: .bottom)
        }
    }

    // MARK: - Open sideways (O9, B2)

    var wideStage: some View {
        let card = duo.card
        let left = ((duo.leftHalf.width - card.width) / 2).rounded()
        return ZStack(alignment: .topLeading) {
            GeometryReader { _ in
                picture
                    .frame(width: card.width, height: card.height)
                    .overlay(alignment: .top) {
                        LinearGradient(colors: [Color.black.opacity(0.42), .clear], startPoint: .top, endPoint: .bottom)
                            .frame(height: 120)
                            .allowsHitTesting(false)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .overlay(alignment: .topLeading) {
                        retakeButton.padding(Spacing.s3)
                    }
                    .offset(x: left, y: card.minY)
            }
            .ignoresSafeArea()
            // The options beside it, ending 12 pt above the keyboard while a caption is typed.
            GeometryReader { geo in
                sheet(asCard: true)
                    .frame(width: card.width, height: max(min(card.height, geo.size.height - 2 * card.minY), 240), alignment: .top)
                    .background(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Theme.Color.appSurface))
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .offset(x: card.minX, y: card.minY)
            }
            .ignoresSafeArea(.container)
        }
    }

    // MARK: - Upright (U3)

    var uprightStage: some View {
        ZStack(alignment: .top) {
            GeometryReader { geo in
                let width = min(geo.size.width, (geo.size.height * 9 / 16).rounded())
                ZStack {
                    blurredCopy
                    picture
                        .frame(width: width, height: geo.size.height)
                        .clipped()
                    Color.black.opacity(0.3)
                }
                .frame(width: geo.size.width, height: geo.size.height)
            }
            .ignoresSafeArea()
            // Level with the clock corner's top, on the left where nothing covers the screen (board U3).
            GeometryReader { _ in
                retakeButton
                    .padding(.leading, 20)
                    .padding(.top, 28)
            }
            .ignoresSafeArea()
            VStack(spacing: 0) {
                Spacer(minLength: 120)
                sheet()
                    .frame(width: min(431, duo.size.width))
                    .layoutPriority(1)
            }
            .ignoresSafeArea(.container, edges: .bottom)
        }
    }

    // MARK: - The picture

    /// What's being posted, as the Moment will show it: filling the Moment's tall shape.
    @ViewBuilder
    private var picture: some View {
        switch model.draft {
        case let .photo(image):
            Color(white: 0.067)
                .overlay {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                }
                .clipped()
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("The photo you're posting")
        case let .video(url):
            Color.black
                .overlay { videoSurface(url: url) }
                .clipped()
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("The video you're posting")
        case .text:
            MomentsTextCard(text: model.text, background: model.background)
        case nil:
            Color.black
        }
    }

    /// Around the picture on a wide screen: a blurred, darker copy of it; a text card's colors; a video's black.
    @ViewBuilder
    private var blurredCopy: some View {
        switch model.draft {
        case let .photo(image):
            Color.black
                .overlay {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .scaleEffect(1.18)
                        .blur(radius: 38)
                }
                .overlay { Color.black.opacity(0.5) }
                .clipped()
                .accessibilityHidden(true)
        case .text:
            MomentsTextCard(text: "", background: model.background)
                .accessibilityHidden(true)
        case .video, nil:
            Color.black
        }
    }
}
