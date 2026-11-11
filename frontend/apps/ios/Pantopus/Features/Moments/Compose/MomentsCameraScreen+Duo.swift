//
//  MomentsCameraScreen+Duo.swift
//  Pantopus
//
//  The camera on the iPhone Duo (the founder's Duo boards, approved
//  2026-11-11). Closed (C6): what the camera sees fills the column beside the
//  side strip, rounded where it meets it, with Close and the flash in the
//  strip under the clock. Open sideways, flat or like a book (O7): the
//  picture in the Moment's tall shape on the left half; on the right Close
//  and the flash, the library, the shutter and the switch, Library · Camera ·
//  Text, and "From the last 24 hours" (the newest four, and See all). One
//  layout for both, so the picture stays the same view through a fold.
//

import Photos
import SwiftUI

extension MomentsCameraScreen {
    /// Closed (C6) and open sideways (O7), from the screen's top-left corner.
    var duoLayout: some View {
        let open = duo.pose.isWide
        let frame = pictureFrame
        // A GeometryReader takes exactly the room it's offered, then reaches the screen's edges.
        return GeometryReader { _ in
            ZStack(alignment: .topLeading) {
                Color.black
                ZStack {
                    Color(white: 0.067)
                    preview
                    VStack(spacing: 0) {
                        LinearGradient(colors: [Color.black.opacity(0.5), .clear], startPoint: .top, endPoint: .bottom).frame(height: 150)
                        Spacer(minLength: 0)
                        LinearGradient(colors: [.clear, Color.black.opacity(open ? 0.6 : 0.62)], startPoint: .top, endPoint: .bottom)
                            .frame(height: open ? 170 : 280)
                    }
                    .allowsHitTesting(false)
                    VStack(spacing: 0) {
                        MomentsPlaceChip(place: model.placeChip)
                            .padding(.top, 16)
                        Spacer(minLength: 0)
                        errorPill
                        // Closed the column is narrower than a phone: 12 pt in keeps the hint on one line (C6).
                        hint
                            .padding(.horizontal, open ? Spacing.s6 : Spacing.s3)
                            .padding(.bottom, open ? 22 : 25)
                        if !open {
                            // Board C6: the phone's controls in the column, as drawn (40 pt in, 24 pt above the tabs).
                            HStack(spacing: 0) {
                                libraryButton(size: 46)
                                Spacer(minLength: 0)
                                shutter(size: 80)
                                Spacer(minLength: 0)
                                switchButton(size: 48, fill: Color.black.opacity(0.42))
                            }
                            .padding(.horizontal, 40)
                            .padding(.bottom, 24)
                            MomentsModeTabs(model: model)
                                .opacity(camera.recording ? 0 : 1)
                                .allowsHitTesting(!camera.recording)
                        }
                    }
                    // Closed, the controls keep the Home indicator's margin.
                    .padding(.bottom, open ? 0 : duo.insets.bottom)
                }
                .frame(width: frame.width, height: frame.height)
                .clipShape(UnevenRoundedRectangle(
                    topLeadingRadius: open ? 28 : 0,
                    bottomLeadingRadius: open ? 28 : 0,
                    bottomTrailingRadius: open ? 28 : 24,
                    topTrailingRadius: open ? 28 : 24,
                    style: .continuous
                ))
                .offset(x: frame.minX, y: frame.minY)
                if open {
                    openControls
                } else {
                    MomentsStripButtons(screen: duo, height: duo.size.height, top: stripButtons, bottom: nil)
                }
            }
        }
        .ignoresSafeArea()
    }

    /// Closed: the column. Open: the Moment's tall shape, as big as the card beside the map, in the middle of the left
    /// half (board O7: x 50, 12 pt from the top and the bottom).
    private var pictureFrame: CGRect {
        guard duo.pose.isWide else { return CGRect(x: 0, y: 0, width: duo.column.width, height: duo.size.height) }
        let card = duo.card
        let left = ((duo.leftHalf.width - card.width) / 2).rounded()
        return CGRect(x: left, y: card.minY, width: card.width, height: card.height)
    }

    /// Closed: Close, then the flash, in the side strip.
    private var stripButtons: [MomentsStripButtons.Item] {
        [
            MomentsStripButtons.Item(id: "moments.camera.close", icon: .x, label: "Close") { onClose() },
            MomentsStripButtons.Item(
                id: "moments.camera.flash",
                icon: camera.flash ? .zap : .zapOff,
                label: camera.flash ? "Flash on" : "Flash off",
                enabled: camera.ready == true
            ) { camera.flash.toggle() }
        ]
    }

    // MARK: - Open sideways (O7)

    /// The right half, in the card's place beside the map: Close and the flash at the top, the shutter row, the tabs,
    /// and the last 24 hours.
    private var openControls: some View {
        let column = duo.card
        return ZStack(alignment: .topLeading) {
            Button(action: onClose) {
                Icon(.x, size: 26, strokeWidth: 2, color: .white)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("moments.camera.close")
            .offset(x: column.minX, y: column.minY + 2)
            Button { camera.flash.toggle() } label: {
                Icon(camera.flash ? .zap : .zapOff, size: 24, strokeWidth: 2, color: .white)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .opacity(camera.ready == true ? 1 : 0.4)
            .disabled(camera.ready != true)
            .accessibilityLabel(camera.flash ? "Flash on" : "Flash off")
            .accessibilityIdentifier("moments.camera.flash")
            .offset(x: column.maxX - 44, y: column.minY + 2)
            HStack(spacing: 0) {
                libraryButton(size: 50)
                Spacer(minLength: 0)
                shutter(size: 96)
                Spacer(minLength: 0)
                switchButton(size: 50, fill: Color.white.opacity(0.14))
            }
            .padding(.horizontal, 30)
            .frame(width: column.width, height: 96)
            .offset(x: column.minX, y: column.minY + 166)
            MomentsModeTabs(model: model)
                .frame(width: column.width)
                .opacity(camera.recording ? 0 : 1)
                .allowsHitTesting(!camera.recording)
                .offset(x: column.minX, y: column.minY + 294)
            MomentsRecentStrip(model: model)
                .frame(width: column.width)
                .offset(x: column.minX, y: column.minY + 408)
        }
    }
}

/// Board O7: "From the last 24 hours", the newest four photos and videos, and See all (the library). Only where the
/// library is already open to Pantopus; otherwise See all opens the library, which asks.
struct MomentsRecentStrip: View {
    let model: MomentsComposerModel
    @State private var opening: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 0) {
                Text("From the last 24 hours")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.white.opacity(0.75))
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: Spacing.s2)
                Button { model.mode = .library } label: {
                    Text("See all")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary300)
                        .frame(minHeight: 16)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("moments.camera.recent.all")
            }
            .padding(.horizontal, 2)
            .padding(.bottom, 10)
            content
        }
        .task { await model.camera.loadRecents() }
    }

    @ViewBuilder
    private var content: some View {
        if let recents = model.camera.recents {
            if !model.camera.libraryAllowed {
                note("Allow Pantopus to see your photos")
            } else if recents.isEmpty {
                note("Nothing from the last 24 hours")
            } else {
                HStack(spacing: 8) {
                    ForEach(0..<4, id: \.self) { index in
                        if index < recents.count {
                            cell(recents[index], index: index)
                        } else {
                            Color.clear.frame(height: 150)
                        }
                    }
                }
            }
        }
    }

    private func note(_ text: String) -> some View {
        Button { model.mode = .library } label: {
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(Color.white.opacity(0.75))
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .padding(.horizontal, 2)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func cell(_ item: MomentsRecentItem, index: Int) -> some View {
        let asset = item.asset
        let tooLong = asset.mediaType == .video
            && asset.duration > MomentsMediaExport.maxVideoSeconds + MomentsMediaExport.videoSecondsTolerance
        return Button { choose(asset) } label: {
            Color(white: 0.067)
                .frame(height: 150)
                .overlay {
                    if let thumbnail = item.thumbnail { Image(uiImage: thumbnail).resizable().scaledToFill() }
                }
                .overlay(alignment: .bottomTrailing) {
                    if asset.mediaType == .video {
                        Text(duration(of: asset))
                            .font(.system(size: 11.5, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(RoundedRectangle(cornerRadius: 6, style: .continuous).fill(Color.black.opacity(0.55)))
                            .padding(6)
                    }
                }
                .overlay {
                    if tooLong { Color.black.opacity(0.55) }
                    if opening == asset.localIdentifier { ProgressView().tint(.white) }
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(tooLong)
        .accessibilityLabel(asset.mediaType == .video ? "Video, \(duration(of: asset))" : "Photo")
        .accessibilityIdentifier("moments.camera.recent.\(index)")
    }

    private func duration(of asset: PHAsset) -> String {
        let seconds = Int(asset.duration.rounded())
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    private func choose(_ asset: PHAsset) {
        guard opening == nil else { return }
        opening = asset.localIdentifier
        Task {
            await model.use(asset: asset)
            opening = nil
        }
    }
}
