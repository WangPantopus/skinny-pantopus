//
//  HolidayCardPhotoStudio.swift
//  Pantopus
//
//  "Make a photo card" (cards-next 4.2): one focused screen on the dark cloth. The card's front with the photo in its
//  frame, pinch and drag to crop it within the chosen shape (taken from the photo's orientation, one tap to change),
//  "Change photo", STYLE with the three frames, FRONT CAPTION, and "Use this photo card", which cuts the photo here and
//  sends it through the card's own photo upload before the flow goes on.
//

import PhotosUI
import SwiftUI
import UIKit

struct HolidayCardPhotoStudio: View {
    @Bindable var viewModel: HolidayCardFlowViewModel
    let spec: HolidayCardPhotoCardSpec
    let year: Int

    @State private var image: UIImage?
    @State private var picked: PhotosPickerItem?
    @State private var picking = false
    @State private var reading = false
    /// The shape chosen by tap; until then the photo's own orientation picks it.
    @State private var shapeId: String?
    @State private var frame: CardPhotoFrame
    @State private var caption: String
    @State private var zoom: CGFloat = 1
    @State private var offset: CGSize = .zero
    @GestureState private var pinch: CGFloat = 1
    @GestureState private var drag: CGSize = .zero
    @State private var cutting = false
    @State private var failed: String?
    @State private var width: CGFloat = 0
    @FocusState private var typing: Bool

    private static let maxZoom: CGFloat = 4

    init(viewModel: HolidayCardFlowViewModel, spec: HolidayCardPhotoCardSpec, year: Int) {
        self.viewModel = viewModel
        self.spec = spec
        self.year = year
        _image = State(initialValue: viewModel.photoCardSource)
        _frame = State(initialValue: CardPhotoFrame(viewModel.photoFront?.frame ?? spec.defaultFrame))
        _caption = State(initialValue: viewModel.photoFront?.caption ?? "")
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.s5) {
                top
                card(width: max(0, min(width - Spacing.s8 * 2, 340)))
                    .padding(.top, Spacing.s2)
                if image != nil { photoControls }
                styles
                captionField
                if let failed {
                    Text(verbatim: failed)
                        .font(.system(size: 13))
                        .foregroundStyle(HolidayCardDesk.muted(.dark))
                        .accessibilityIdentifier("photoStudioFailed")
                }
                HolidayCardWaxButton(title: "Use this photo card", isLoading: cutting, isEnabled: image != nil && !cutting) { use() }
                    .accessibilityIdentifier("photoStudioUse")
            }
            .frame(maxWidth: 560)
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s8)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .background { HolidayCardTableCloth(table: HolidayCardDesign.photoCard(id: spec.design).table) }
        .environment(\.colorScheme, .dark)
        .photosPicker(isPresented: $picking, selection: $picked, matching: .images, preferredItemEncoding: .current)
        .onChange(of: picked) { _, item in
            guard let item else { return }
            picked = nil
            read(item)
        }
        .task { await CardTableSmallArt.shared.load() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("photoStudio")
    }

    // MARK: Parts

    private var top: some View {
        ZStack {
            Text("Make a photo card")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(HolidayCardDesk.text(.dark))
                .accessibilityAddTraits(.isHeader)
            HStack {
                Button { viewModel.makesPhotoCard = false } label: {
                    Icon(.x, size: 20, color: HolidayCardDesk.text(.dark))
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
                .accessibilityIdentifier("photoStudioClose")
                Spacer()
            }
        }
        .padding(.top, Spacing.s2)
    }

    private var shapes: [HolidayCardPhotoCardSpec.Shape] {
        spec.shapes
    }

    /// The chosen shape, else the one the photo's orientation suggests.
    private var shape: HolidayCardPhotoCardSpec.Shape? {
        if let shapeId, let chosen = shapes.first(where: { $0.id == shapeId }) { return chosen }
        guard let image, image.size.height > 0 else { return shapes.first }
        let ratio = image.size.width / image.size.height
        let id = ratio > 1.1 ? "landscape" : ratio < 0.9 ? "portrait" : "square"
        return shapes.first { $0.id == id } ?? shapes.first
    }

    private var aspect: CGFloat {
        CGFloat(shape?.aspect ?? 0.8)
    }

    private var line: String {
        caption.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    private func card(width: CGFloat) -> some View {
        let u = width / 100
        let box = CardPhotoFrontLayout.photoBox(frame: frame, aspect: aspect)
        let place = CGRect(x: box.minX * u, y: box.minY * u, width: box.width * u, height: box.height * u)
        return CardPhotoFrontFace(
            frame: frame,
            photo: nil,
            aspect: aspect,
            caption: line,
            year: year,
            mailedOn: nil,
            paperGrain: CardTableSmallArt.shared.paperGrain,
            grainOpacity: 0.25,
            leavesPhotoPlace: image != nil
        )
        .frame(width: width, height: width / CardTableShape.aspect)
        .overlay(alignment: .topLeading) {
            Group {
                if let image {
                    crop(image, place: place.size)
                } else {
                    HolidayCardPaperButton(title: reading ? "Reading the photo…" : "Choose a photo", isLoading: reading) { picking = true }
                        .accessibilityIdentifier("photoStudioChoose")
                        .frame(width: place.width, height: place.height)
                }
            }
            .offset(x: place.minX, y: place.minY)
        }
        .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
        .shadow(color: MailPaper.cardShadow.opacity(0.4), radius: 16, x: 0, y: 14)
    }

    private func crop(_ image: UIImage, place: CGSize) -> some View {
        let scale = clampZoom(zoom * pinch)
        let moved = clampOffset(CGSize(width: offset.width + drag.width, height: offset.height + drag.height), image, place, scale)
        return Image(uiImage: image)
            .resizable()
            .scaledToFill()
            .frame(width: place.width, height: place.height)
            .scaleEffect(scale)
            .offset(moved)
            .frame(width: place.width, height: place.height)
            .clipShape(PhotoPlaceShape(arch: frame == .arch))
            .contentShape(Rectangle())
            .gesture(
                SimultaneousGesture(
                    MagnifyGesture()
                        .updating($pinch) { value, state, _ in state = value.magnification }
                        .onEnded { value in
                            zoom = clampZoom(zoom * value.magnification)
                            offset = clampOffset(offset, image, place, zoom)
                        },
                    DragGesture(minimumDistance: 1)
                        .updating($drag) { value, state, _ in state = value.translation }
                        .onEnded { value in
                            let moved = value.translation
                            offset = clampOffset(
                                CGSize(width: offset.width + moved.width, height: offset.height + moved.height),
                                image,
                                place,
                                zoom
                            )
                        }
                )
            )
            .accessibilityLabel("Your photo. Pinch and drag to choose what shows.")
            .accessibilityIdentifier("photoStudioCrop")
    }

    private var photoControls: some View {
        VStack(spacing: Spacing.s3) {
            HStack(spacing: Spacing.s2) {
                ForEach(shapes) { each in
                    HolidayCardPaperButton(title: Self.shapeTitle(each.id), isPressed: each.id == shape?.id) {
                        shapeId = each.id
                        zoom = 1
                        offset = .zero
                    }
                    .accessibilityIdentifier("photoStudioShape-\(each.id)")
                }
            }
            HolidayCardQuietButton(title: "Change photo") { picking = true }
                .accessibilityIdentifier("photoStudioChange")
        }
    }

    private var styles: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            label("STYLE")
            HStack(spacing: Spacing.s2) {
                ForEach(frames) { each in
                    HolidayCardPaperButton(title: each.title, isPressed: each == frame, fullWidth: true) { frame = each }
                        .accessibilityIdentifier("photoStudioFrame-\(each.rawValue)")
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var frames: [CardPhotoFrame] {
        let offered = spec.frames.compactMap(CardPhotoFrame.init(rawValue:))
        return offered.isEmpty ? CardPhotoFrame.allCases : offered
    }

    private var captionField: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack {
                label("FRONT CAPTION")
                Spacer()
                Text("\(caption.count) of \(spec.captionLimit)")
                    .font(.system(size: 12))
                    .foregroundStyle(HolidayCardDesk.muted(.dark))
                    .accessibilityIdentifier("photoStudioCaptionCount")
            }
            TextField("", text: $caption, prompt: Text("Optional, one line under the photo").foregroundStyle(MailPaper.cardTextSoft))
                .font(.system(size: 16))
                .foregroundStyle(MailPaper.cardText)
                .focused($typing)
                .submitLabel(.done)
                .padding(.horizontal, Spacing.s3)
                .frame(minHeight: 48)
                .typesInFieldOnTap($typing)
                .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardFieldEdge, lineWidth: 1))
                .onChange(of: caption) { _, text in
                    let one = text.replacingOccurrences(of: "\n", with: " ")
                    let kept = String(one.prefix(spec.captionLimit))
                    if kept != text { caption = kept }
                }
                .accessibilityLabel("Front caption")
                .accessibilityIdentifier("photoStudioCaption")
        }
    }

    private func label(_ text: String) -> some View {
        Text(verbatim: text)
            .font(.system(size: 12, weight: .semibold))
            .tracking(1.2)
            .foregroundStyle(HolidayCardDesk.muted(.dark))
    }

    // MARK: Doing

    private static func shapeTitle(_ id: String) -> String {
        switch id {
        case "portrait": "Portrait"
        case "square": "Square"
        case "landscape": "Landscape"
        default: id.capitalized
        }
    }

    private func clampZoom(_ value: CGFloat) -> CGFloat {
        min(Self.maxZoom, max(1, value))
    }

    private func clampOffset(_ value: CGSize, _ image: UIImage, _ place: CGSize, _ scale: CGFloat) -> CGSize {
        let limit = CardPhotoCrop.limit(image, place: place, zoom: scale)
        return CGSize(
            width: min(limit.width, max(-limit.width, value.width)),
            height: min(limit.height, max(-limit.height, value.height))
        )
    }

    private func read(_ item: PhotosPickerItem) {
        reading = true
        failed = nil
        Task {
            defer { reading = false }
            guard let data = try? await item.loadTransferable(type: Data.self),
                  let photo = await Task.detached(priority: .userInitiated, operation: { CardPhotoCrop.prepared(data) }).value
            else {
                failed = "Couldn’t read that photo. Try another one."
                return
            }
            image = photo
            shapeId = nil
            zoom = 1
            offset = .zero
        }
    }

    private func use() {
        guard let image, width > 0 else { return }
        let cardWidth = max(0, min(width - Spacing.s8 * 2, 340))
        let u = cardWidth / 100
        let box = CardPhotoFrontLayout.photoBox(frame: frame, aspect: aspect)
        let place = CGSize(width: box.width * u, height: box.height * u)
        let zoom = zoom
        let offset = offset
        let frame = frame
        let caption = line
        cutting = true
        failed = nil
        Task {
            defer { cutting = false }
            let data = await Task.detached(priority: .userInitiated) {
                CardPhotoCrop.cut(image, place: place, zoom: zoom, offset: offset)
            }.value
            guard let data else {
                failed = "Couldn’t use this photo. Try another one."
                return
            }
            viewModel.photoCardSource = image
            viewModel.usePhotoCard(photo: data, frame: frame, caption: caption)
        }
    }
}

/// The photo's place: a rectangle, or Winter Arch's rounded top.
private struct PhotoPlaceShape: Shape {
    let arch: Bool

    func path(in rect: CGRect) -> Path {
        arch ? CardPhotoFrontLayout.archPath(rect) : Path(rect)
    }
}

/// "Make a photo card" under the Pick a card heading: one quiet cream-paper pill with a small frame.
struct HolidayCardPhotoCardPill: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(.image, size: 16, strokeWidth: 1.8, color: MailPaper.cardTextSoft)
                Text("Make a photo card")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MailPaper.cardText)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 40)
            .background(MailPaper.cardNote, in: Capsule())
            .overlay(Capsule().strokeBorder(MailPaper.cardRowEdge, lineWidth: 1))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("sendCardMakePhotoCard")
    }
}

/// The studio over the send flow while "Make a photo card" is open.
struct HolidayCardPhotoStudioCover: ViewModifier {
    @Bindable var viewModel: HolidayCardFlowViewModel

    func body(content: Content) -> some View {
        content.fullScreenCover(isPresented: Binding(
            get: { viewModel.makesPhotoCard && viewModel.photoCardSpec != nil },
            set: { if !$0 { viewModel.makesPhotoCard = false } }
        )) {
            if let spec = viewModel.photoCardSpec {
                HolidayCardPhotoStudio(viewModel: viewModel, spec: spec, year: viewModel.cards?.year ?? 2026)
            }
        }
    }
}
