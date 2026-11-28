//
//  MomentsMarksEditor+Studio.swift
//  Pantopus
//
//  "Pulse, reinvented", phase 0 step 4: Text and Draw as the Studio opens
//  them (today's editor, `MomentsMarksEditor`, with `studio` on). Text adds a
//  row of twelve letterings; Draw adds a highlighter, an arrow and an
//  eraser beside the pen; both add the photo's own colors and an eyedropper
//  after the six inks. Everything else is today's editor. Today's composer
//  opens the editor with `studio` off and gets exactly today's Text and Draw.
//

import SwiftUI

extension MomentsMarksEditor {
    // MARK: - Text

    /// The hint, the letterings, the three looks, and the inks with the photo's colors. While typing, the same rows
    /// right above the keyboard without the hint.
    func studioTextFooter(width: CGFloat, typing: Bool) -> some View {
        let tools = marking.studio ?? MomentsStudioTools()
        return VStack(spacing: typing ? Spacing.s2 : Spacing.s3) {
            if !typing || tools.dropping || tools.lifting || tools.noSubject {
                studioHint(textHint(tools))
            }
            letterings(selected: currentFont(tools))
            HStack(spacing: Spacing.s2) {
                ForEach(MomentMarks.Style.allCases, id: \.self) { style in
                    studioLook(style)
                }
                if case let .photo(image) = media, let id = marking.typing ?? marking.picked, let label = marking.label(id) {
                    behindButton(label, photo: marking.base ?? image)
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Look")
            studioColors(
                ink: marking.textInk,
                tint: currentTextTint(tools),
                pickInk: { marking.setStudioTextInk($0) },
                pickTint: { marking.setStudioTextTint($0) }
            )
            .accessibilityLabel("Text color")
        }
        .frame(width: width)
        // Picking a lettering, a look or an ink while typing keeps the keyboard.
        .keepsKeyboardOnTap()
    }

    private func textHint(_ tools: MomentsStudioTools) -> String {
        if tools.dropping { return "Touch the photo to take its color." }
        if tools.lifting { return "Finding the subject…" }
        if tools.noSubject { return "There's no clear subject in this photo to go behind." }
        return marking.editing.labels.isEmpty ? "Tap the picture to add words." : "Drag to move. Pinch to resize. Twist to turn."
    }

    /// Behind the subject, for the label being changed: the photo's subject (a person, a pet, a thing in front) is
    /// lifted and drawn over the words.
    private func behindButton(_ label: MomentMarks.Label, photo: UIImage) -> some View {
        let on = label.behind
        return Button { marking.setBehind(label.id, !on, photo: photo) } label: {
            VStack(spacing: 2) {
                Icon(.layers, size: 16, strokeWidth: 2.2, color: .white)
                Text("Behind")
                    .scaledFont(11, weight: on ? .bold : .semibold)
                    .foregroundStyle(.white)
            }
            .frame(width: 64)
            .frame(minHeight: 44)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.black.opacity(0.42)))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.white.opacity(on ? 1 : 0.4), lineWidth: on ? 2 : 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Behind the subject")
        .accessibilityHint("Puts these words behind the person or thing in front.")
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("moments.marks.behind")
    }

    /// The letters of the label being changed, or of the next one.
    private func currentFont(_ tools: MomentsStudioTools) -> MomentMarks.Typeface {
        (marking.typing ?? marking.picked).flatMap(marking.label)?.font ?? tools.font
    }

    private func currentTextTint(_ tools: MomentsStudioTools) -> MomentMarks.Tint? {
        if let label = (marking.typing ?? marking.picked).flatMap(marking.label) { return label.tint }
        return tools.textTint
    }

    /// Twelve letterings in a row that scrolls: each one's name written in it.
    private func letterings(selected: MomentMarks.Typeface) -> some View {
        ScrollViewReader { reader in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(MomentMarks.Typeface.allCases, id: \.self) { font in
                        let picked = font == selected
                        Button { marking.setStudioFont(font) } label: {
                            Text(font.name)
                                .font(font.font(17))
                                .lineLimit(1)
                                .foregroundStyle(picked ? Color(uiColor: MomentsPalette.ink(MomentMarks.Ink.black.rawValue)) : .white)
                                .padding(.horizontal, 14)
                                .frame(minHeight: 40)
                                .background(Capsule().fill(picked ? Color.white : Color.black.opacity(0.42)))
                                .overlay(Capsule().strokeBorder(Color.white.opacity(picked ? 0 : 0.4), lineWidth: 1))
                                .frame(minHeight: 44)
                                .contentShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .id(font)
                        .accessibilityLabel(font.name)
                        .accessibilityAddTraits(picked ? [.isButton, .isSelected] : .isButton)
                        .accessibilityIdentifier("moments.marks.font.\(font.rawValue)")
                    }
                }
                .padding(.horizontal, 2)
            }
            .onAppear { reader.scrollTo(selected, anchor: .center) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Lettering")
    }

    /// One look, compact: "Aa" as the look draws it over its name.
    private func studioLook(_ style: MomentMarks.Style) -> some View {
        let selected = marking.style == style
        let dark = MomentsPalette.ink(MomentMarks.Ink.black.rawValue)
        let sample: (letters: UIColor, plate: UIColor?) = switch style {
        case .plain: (.white, nil)
        case .label: (.white, UIColor.black.withAlphaComponent(0.8))
        case .sign: (dark, MomentsPalette.ink(MomentMarks.Ink.yellow.rawValue))
        }
        return Button { marking.setStyle(style) } label: {
            HStack(spacing: 6) {
                Text("Aa")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color(uiColor: sample.letters))
                    .padding(.horizontal, sample.plate == nil ? 0 : 6)
                    .background(RoundedRectangle(cornerRadius: 5).fill(Color(uiColor: sample.plate ?? .clear)))
                    .shadow(color: .black.opacity(sample.plate == nil ? 0.8 : 0), radius: 2, x: 0, y: 1)
                Text(style.rawValue.capitalized)
                    .scaledFont(12, weight: selected ? .bold : .semibold)
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.black.opacity(0.42)))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.white.opacity(selected ? 1 : 0.4), lineWidth: selected ? 2 : 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(style.rawValue.capitalized)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("moments.marks.style.\(style.rawValue)")
    }

    // MARK: - Draw

    /// The hint, the four pens, and the inks with the photo's colors.
    func studioDrawFooter(width: CGFloat) -> some View {
        let tools = marking.studio ?? MomentsStudioTools()
        return VStack(spacing: Spacing.s3) {
            studioHint(tools.dropping ? "Touch the photo to take its color." : tools.pen == .eraser
                ? "Rub out lines with your finger." : "Draw with your finger.")
            HStack(spacing: Spacing.s2) {
                ForEach(MomentMarks.Pen.allCases, id: \.self) { pen in
                    penButton(pen, selected: tools.pen == pen && !tools.dropping)
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Pen")
            studioColors(
                ink: marking.ink,
                tint: tools.drawTint,
                inUse: tools.pen != .eraser,
                pickInk: { marking.setStudioDrawInk($0) },
                pickTint: { marking.setStudioDrawTint($0) }
            )
            .accessibilityLabel("Ink color")
        }
        .frame(width: width)
    }

    private func penButton(_ pen: MomentMarks.Pen, selected: Bool) -> some View {
        Button { marking.setStudioPen(pen) } label: {
            VStack(spacing: 3) {
                Icon(pen.icon, size: 18, strokeWidth: 2.2, color: .white)
                Text(pen.name)
                    .scaledFont(11, weight: selected ? .bold : .semibold)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.black.opacity(0.42)))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.white.opacity(selected ? 1 : 0.4), lineWidth: selected ? 2 : 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(pen.name)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("moments.marks.pen.\(pen.rawValue)")
    }

    // MARK: - Inks

    /// The six inks, then the photo's own colors and the eyedropper, in a row that scrolls. `inUse` is off while the
    /// eraser is out: no ink shows as picked, and picking one takes the pen again.
    private func studioColors(
        ink: MomentMarks.Ink,
        tint: MomentMarks.Tint?,
        inUse: Bool = true,
        pickInk: @escaping (MomentMarks.Ink) -> Void,
        pickTint: @escaping (MomentMarks.Tint) -> Void
    ) -> some View {
        let tools = marking.studio ?? MomentsStudioTools()
        let shows = inUse && !tools.dropping
        let photo = tools.picture?.source == pictureSource ? tools.picture?.colors ?? [] : []
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(MomentMarks.Ink.allCases, id: \.self) { each in
                    swatch(each, selected: shows && tint == nil && ink == each) { pickInk(each) }
                }
                if !photo.isEmpty {
                    Capsule()
                        .fill(Color.white.opacity(0.5))
                        .frame(width: 1.5, height: 24)
                        .padding(.horizontal, 2)
                        .accessibilityHidden(true)
                }
                ForEach(Array(photo.enumerated()), id: \.offset) { index, color in
                    tintSwatch(color, index: index, selected: shows && tint == color) { pickTint(color) }
                }
                // A color taken with the eyedropper that isn't one of the photo's own shows as picked after them.
                if let tint, !photo.contains(tint) {
                    tintSwatch(tint, index: nil, selected: shows) { pickTint(tint) }
                }
                dropperButton(on: tools.dropping)
            }
            .padding(.horizontal, 2)
        }
        .accessibilityElement(children: .contain)
        .task(id: pictureSource) { await readPicture() }
    }

    /// An ink from the photo: a disc as the six are drawn.
    private func tintSwatch(_ tint: MomentMarks.Tint, index: Int?, selected: Bool, action: @escaping () -> Void) -> some View {
        let dark = Color(uiColor: MomentsPalette.ink(MomentMarks.Ink.black.rawValue))
        return Button(action: action) {
            Circle()
                .fill(Color(uiColor: tint.uiColor))
                .overlay {
                    if selected {
                        Circle().strokeBorder(dark, lineWidth: 3)
                    } else {
                        Circle().strokeBorder(tint.isLight ? dark.opacity(0.5) : Color.white.opacity(0.8), lineWidth: 1.5)
                    }
                }
                .padding(selected ? 2 : 0)
                .overlay { if selected { Circle().strokeBorder(Color.white, lineWidth: 2) } }
                .frame(width: selected ? 40 : 30, height: selected ? 40 : 30)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(tint.spokenName), from the photo")
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier(index.map { "moments.marks.photoColor.\($0)" } ?? "moments.marks.photoColor.taken")
    }

    /// The eyedropper: out, a finger on the picture takes the color under it; tapped again, it goes back.
    private func dropperButton(on: Bool) -> some View {
        Button { marking.setStudioDropping(!on) } label: {
            let dark = Color(uiColor: MomentsPalette.ink(MomentMarks.Ink.black.rawValue))
            Icon(.pipette, size: 18, strokeWidth: 2.3, color: on ? dark : .white)
                .frame(width: 36, height: 36)
                .background(Circle().fill(on ? Color.white : Color.black.opacity(0.42)))
                .overlay(Circle().strokeBorder(Color.white.opacity(on ? 0 : 0.6), lineWidth: 1.5))
                .frame(width: 44, height: 44)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Eyedropper")
        .accessibilityHint("Then touch the photo to take its color.")
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("moments.marks.eyedropper")
    }

    private func studioHint(_ words: String) -> some View {
        Text(words)
            .scaledFont(13, weight: .medium)
            .foregroundStyle(.white)
            .multilineTextAlignment(.center)
            .shadow(color: .black.opacity(0.6), radius: 2, x: 0, y: 1)
            .accessibilityHidden(true)
    }

    /// The photo the Studio lifts a subject from (the 2048 px copy once made); nil for a video and in today's editor.
    var studioPhoto: UIImage? {
        guard studio, case let .photo(image) = media else { return nil }
        return marking.base ?? image
    }

    // MARK: - The picture's colors

    /// What the marks are on now: the photo or the video, on its canvas when it's placed.
    var pictureSource: MomentsStudioSample.Source {
        switch media {
        case let .photo(image): MomentsStudioSample.Source(image: ObjectIdentifier(image), video: nil, placement: marking.editingPlacement)
        case let .video(url, _): MomentsStudioSample.Source(image: nil, video: url, placement: marking.editingPlacement)
        }
    }

    /// Reads the picture small once for each picture and place on the canvas, for its colors and the eyedropper.
    private func readPicture() async {
        let source = pictureSource
        guard marking.studio != nil, marking.studio?.picture?.source != source else { return }
        let made = await MomentsStudioSample.make(
            media: media,
            base: marking.base,
            placement: marking.editingPlacement,
            backdrop: marking.backdrop
        )
        guard !Task.isCancelled, let made, made.source == pictureSource else { return }
        marking.studio?.picture = made
    }
}

// MARK: - What the Studio's rows change

extension MomentsMarking {
    /// A lettering: for the label being changed, and the next one.
    func setStudioFont(_ font: MomentMarks.Typeface) {
        studio?.font = font
        if let id = typing ?? picked { update(id) { $0.font = font } }
    }

    /// One of the six inks for words: today's ink row, and no photo color.
    func setStudioTextInk(_ ink: MomentMarks.Ink) {
        studio?.dropping = false
        setTextInk(ink)
        setStudioTextTint(nil)
    }

    /// A photo color for words (nil: back to the six inks').
    func setStudioTextTint(_ tint: MomentMarks.Tint?) {
        studio?.dropping = false
        studio?.textTint = tint
        if let id = typing ?? picked { update(id) { $0.tint = tint } }
    }

    func setStudioPen(_ pen: MomentMarks.Pen) {
        studio?.pen = pen
        studio?.dropping = false
    }

    /// One of the six inks for lines; the eraser hands back to the pen.
    func setStudioDrawInk(_ ink: MomentMarks.Ink) {
        self.ink = ink
        studio?.drawTint = nil
        takesPenBack()
    }

    func setStudioDrawTint(_ tint: MomentMarks.Tint) {
        studio?.drawTint = tint
        takesPenBack()
    }

    private func takesPenBack() {
        studio?.dropping = false
        if studio?.pen == .eraser { studio?.pen = .marker }
    }

    func setStudioDropping(_ dropping: Bool) {
        studio?.dropping = dropping
    }

    /// The eyedropper let go on `tint`: the ink for the words being changed (and the next ones) in Text, for the next
    /// lines in Draw.
    func dropped(_ tint: MomentMarks.Tint) {
        switch tool {
        case .text: setStudioTextTint(tint)
        case .draw: setStudioDrawTint(tint)
        case .resize: studio?.dropping = false
        }
    }
}

extension MomentsComposerModel {
    /// The Studio's Text and Draw: today's editor with the Studio's tools, kept from one opening to the next.
    func openStudioMarks(_ tool: MomentsMarking.Tool) {
        if marking.studio == nil { marking.studio = MomentsStudioTools() }
        marking.studio?.dropping = false
        // Text goes anywhere on the canvas (PHASE-6 F2): the picture goes onto its canvas first.
        if tool == .text { studioOpensText() }
        openMarks(tool)
    }
}
