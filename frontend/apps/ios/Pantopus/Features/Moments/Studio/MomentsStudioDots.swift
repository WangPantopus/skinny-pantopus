//
//  MomentsStudioDots.swift
//  Pantopus
//
//  Illuminate in the Studio ("Pulse, reinvented" phase 2, living objects; CONTRACT 7c): the author puts dots on things
//  in the photo or video, each holding a note, a rating or a link (a thing to name and a voice whisper come with field
//  cards and sound). Up to eight. A reader taps one in the viewer. Dots are placed on the picture as stamps are (0 to 1
//  across and down), dragged where they belong, and go out with the Moment (`dots`). A link takes only an https address
//  and isn't offered under a made-up name. With the switch off none of this is drawn or sent.
//

import SwiftUI

extension MomentsComposerModel {
    /// Up to eight dots on one picture.
    static let dotLimit = 8

    /// Dots go on a photo or a video.
    /// "A thing to name" (its field card, CONTRACT 7d): on a photo of its own (not a before and after), while the
    /// author keeps Pantopus AI on.
    var offersThings: Bool {
        guard case .photo = draft, studioPair == nil else { return false }
        return MomentsStudioAI.shared.on == true
    }

    /// A thing's outline starts at a quarter of the picture's width.
    static let thingSize = 0.24

    /// A thing's outline around its dot, inside the picture (`size` is its width and height, 0 to 1).
    static func thingBox(_ dot: MomentDotDTO) -> MomentPlayItem.Box {
        let size = min(max(dot.box?.w ?? thingSize, 0.1), 0.8)
        let x = min(max(dot.x - size / 2, 0), 1 - size)
        let y = min(max(dot.y - size / 2, 0), 1 - size)
        return MomentPlayItem.Box(x: (x * 1000).rounded() / 1000, y: (y * 1000).rounded() / 1000, w: size, h: size)
    }

    var offersDots: Bool {
        switch draft {
        case .photo, .video: true
        case .text, nil: false
        }
    }

    var studioDotDrafts: [MomentDotDTO] {
        offersDots ? marking.studio?.dots ?? [] : []
    }

    /// The dots that go out: each one finished, and none of a kind this post can't carry.
    var studioDots: [MomentDotDTO]? {
        let ready = studioDotDrafts.compactMap { dot -> MomentDotDTO? in
            guard dotDone(dot), dot.kind != .link || !postsUnderMadeUpName else { return nil }
            var out = MomentDotDTO(id: dot.id, kind: dot.kind, x: (dot.x * 1000).rounded() / 1000, y: (dot.y * 1000).rounded() / 1000)
            switch dot.kind {
            case .note: out.text = dot.text?.trimmingCharacters(in: .whitespacesAndNewlines)
            case .rating: (out.label, out.stars) = (dot.label?.trimmingCharacters(in: .whitespacesAndNewlines), dot.stars)
            case .link:
                out.url = Self.httpsLink(dot.url)?.absoluteString
                let title = dot.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                out.title = title.isEmpty ? nil : title
            case .thing:
                guard offersThings else { return nil }
                out.box = Self.thingBox(dot)
                let label = dot.label?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                out.label = label.isEmpty ? nil : label
            case .whisper: guard offersSound else { return nil }
            case .unknown: return nil
            }
            return out
        }
        return ready.isEmpty ? nil : ready
    }

    /// Whether a dot has what it needs to go out: a whisper, its three seconds recorded (`MomentsStudioSound`).
    func dotDone(_ dot: MomentDotDTO) -> Bool {
        dot.kind == .whisper ? marking.studio?.whispers[dot.id] != nil : Self.dotReady(dot)
    }

    /// Whether a dot has what it needs to go out (a whisper: see `dotDone`).
    static func dotReady(_ dot: MomentDotDTO) -> Bool {
        switch dot.kind {
        case .note: !(dot.text?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
        case .rating: !(dot.label?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) && (1...5).contains(dot.stars ?? 0)
        case .link: httpsLink(dot.url) != nil
        case .thing: true
        case .whisper, .unknown: false
        }
    }

    /// The address as an https link ("example.com" reads as https://example.com); nil for anything else.
    static func httpsLink(_ typed: String?) -> URL? {
        let trimmed = typed?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !trimmed.isEmpty, trimmed.count <= 500 else { return nil }
        let full = trimmed.contains("://") ? trimmed : "https://\(trimmed)"
        guard let url = URL(string: full), url.scheme?.lowercased() == "https", let host = url.host(),
              host.contains(".") else { return nil }
        return url
    }

    /// A new dot of `kind` near the middle (each a little lower than the last), picked for editing.
    func addStudioDot(_ kind: MomentDotDTO.Kind) {
        guard offersDots, studioDotDrafts.count < Self.dotLimit else { return }
        if marking.studio == nil { marking.studio = MomentsStudioTools() }
        var number = 1
        while studioDotDrafts.contains(where: { $0.id == "dot-\(number)" }) {
            number += 1
        }
        let count = Double(studioDotDrafts.count)
        var dot = MomentDotDTO(id: "dot-\(number)", kind: kind, x: 0.5, y: min(0.32 + count * 0.06, 0.8))
        if kind == .rating { dot.stars = 4 }
        if kind == .thing { dot.box = MomentPlayItem.Box(x: 0, y: 0, w: Self.thingSize, h: Self.thingSize) }
        marking.studio?.dots.append(dot)
        marking.studio?.pickedDot = dot.id
    }

    func removeStudioDot(_ id: String) {
        marking.studio?.dots.removeAll { $0.id == id }
        marking.studio?.whispers[id] = nil
        if marking.studio?.pickedDot == id { marking.studio?.pickedDot = studioDotDrafts.last?.id }
    }

    func updateStudioDot(_ id: String, _ change: (inout MomentDotDTO) -> Void) {
        guard let index = marking.studio?.dots.firstIndex(where: { $0.id == id }) else { return }
        guard var dot = marking.studio?.dots[index] else { return }
        change(&dot)
        marking.studio?.dots[index] = dot
    }

    /// A field of the picked dot, as the Illuminate sheet edits it.
    func dotField(_ id: String, _ field: WritableKeyPath<MomentDotDTO, String?>, limit: Int) -> Binding<String> {
        Binding(
            get: { self.studioDotDrafts.first { $0.id == id }?[keyPath: field] ?? "" },
            set: { typed in self.updateStudioDot(id) { $0[keyPath: field] = String(typed.prefix(limit)) } }
        )
    }
}

extension MomentDotDTO.Kind {
    var name: String {
        switch self {
        case .note: "Note"
        case .rating: "Rating"
        case .link: "Link"
        case .thing: "A thing to name"
        case .whisper: "Whisper"
        case .unknown: "Dot"
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .note: .info
        case .rating: .starFill
        case .link: .link
        case .thing: .sparkles
        case .whisper: .circleDot
        case .unknown: .circleDot
        }
    }
}

/// The dots on the Studio's picture: each one is dragged where it belongs; a tap opens it in Illuminate.
struct MomentsStudioDotLayer: View {
    let model: MomentsComposerModel
    /// The picture's own size, as the stamps are placed on it (nil: the screen is the frame).
    let picture: CGSize?
    let open: () -> Void

    var body: some View {
        GeometryReader { geo in
            let frame = picture.map { MomentMarks.fill($0, in: geo.size) } ?? CGRect(origin: .zero, size: geo.size)
            // The picked thing's outline: what the field card will look at.
            if let thing = model.studioDotDrafts.first(where: { $0.kind == .thing && $0.id == model.marking.studio?.pickedDot }) {
                let box = MomentsComposerModel.thingBox(thing)
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(Color.white, style: StrokeStyle(lineWidth: 2, dash: [7, 5]))
                    .frame(width: box.w * frame.width, height: box.h * frame.height)
                    .position(x: frame.minX + (box.x + box.w / 2) * frame.width, y: frame.minY + (box.y + box.h / 2) * frame.height)
                    .shadow(color: .black.opacity(0.4), radius: 3)
                    .allowsHitTesting(false)
            }
            ForEach(model.studioDotDrafts, id: \.id) { dot in
                MomentsStudioPlacedDot(model: model, dot: dot, frame: frame, open: open)
            }
        }
    }
}

private struct MomentsStudioPlacedDot: View {
    let model: MomentsComposerModel
    let dot: MomentDotDTO
    let frame: CGRect
    let open: () -> Void
    @GestureState private var moving: CGSize = .zero

    var body: some View {
        let picked = model.marking.studio?.pickedDot == dot.id
        MomentDotMark(kind: dot.kind, picked: picked, unfinished: !model.dotDone(dot))
            .frame(width: 44, height: 44)
            .contentShape(Circle())
            .position(x: frame.minX + dot.x * frame.width + moving.width, y: frame.minY + dot.y * frame.height + moving.height)
            .gesture(
                DragGesture(minimumDistance: 4)
                    .updating($moving) { value, moving, _ in moving = value.translation }
                    .onEnded { value in
                        model.updateStudioDot(dot.id) { placed in
                            placed.x = min(max(placed.x + value.translation.width / max(frame.width, 1), 0.03), 0.97)
                            placed.y = min(max(placed.y + value.translation.height / max(frame.height, 1), 0.03), 0.97)
                        }
                    }
            )
            .simultaneousGesture(TapGesture().onEnded {
                model.marking.studio?.pickedDot = dot.id
                open()
            })
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Dot: \(dot.kind.name)")
            .accessibilityHint("Opens it in Illuminate. Drag to move it.")
            .accessibilityAddTraits(.isButton)
            .accessibilityIdentifier("moments.studio.dot.\(dot.id)")
    }
}

/// A dot as it sits on a picture: a white ring with its kind's mark, glowing so it reads on any photo.
struct MomentDotMark: View {
    let kind: MomentDotDTO.Kind
    var picked = false
    var unfinished = false

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.white.opacity(0.28))
                .frame(width: 34, height: 34)
            Circle()
                .fill(unfinished ? Color.black.opacity(0.45) : Theme.Color.primarySolid)
                .frame(width: 24, height: 24)
                .overlay(Circle().stroke(Color.white, lineWidth: picked ? 3 : 2))
            Icon(kind.icon, size: 12, strokeWidth: 2.6, color: .white)
        }
        .shadow(color: .black.opacity(0.4), radius: 4, x: 0, y: 1)
    }
}

extension View {
    /// Reads the Studio's video's size and length as soon as it is the draft (Text and Draw read them only when they
    /// open). Without them a video's dots, stamps and items were placed over the screen, while the viewer lays them over
    /// the video's frame filling the screen (a 9:16 video runs about 45 points past each side of an iPhone): a dot put
    /// near an edge landed off the reader's screen.
    func studioReadsVideoSize(_ model: MomentsComposerModel) -> some View {
        task(id: model.draft?.video) {
            guard case let .video(url) = model.draft, model.marking.video == nil else { return }
            guard let shown = await MomentsMediaExport.shown(url), model.draft == .video(url), model.marking.video == nil else { return }
            model.marking.opened(video: shown.size, seconds: shown.seconds)
        }
    }
}

extension MomentsComposerModel {
    /// What the Studio put on one picture goes with it: Retake, or the next of several picked (each step of a deck has
    /// its own). Before this, a dot, an item or a voice made on one picture came back on the next and was posted again.
    /// The tools' own settings (pen, letters, inks), Explore and the kind picked stay for the Studio's whole visit.
    func dropPictureTools() {
        guard var tools = marking.studio else { return }
        (tools.dots, tools.pickedDot) = ([], nil)
        (tools.play, tools.pickedPlay) = ([], nil)
        (tools.cutouts, tools.pickedCutout) = ([], nil)
        (tools.voice, tools.voiceWords, tools.place, tools.whispers) = (nil, "", nil, [:])
        (tools.blur, tools.pair) = (nil, nil)
        (tools.look, tools.lookOriginal, tools.lookResult) = (.original, nil, nil)
        tools.mentioned = []
        // A Live Photo's clip that wasn't sent goes with its picture.
        if let clip = tools.motion { try? FileManager.default.removeItem(at: clip.file) }
        (tools.motion, tools.motionFor, tools.keepsMotion) = (nil, nil, true)
        marking.studio = tools
    }
}
