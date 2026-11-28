//
//  MomentPlayLayer.swift
//  Pantopus
//
//  Playable items over a Moment's picture in the viewer ("Pulse, reinvented" phase 2; CONTRACT 7b and 7g; boards B5,
//  B6 and B9), only while the switch is on for the person watching. Each sits where its author placed it, sized as a
//  share of the picture's width like a stamp. A reader answers (`PUT /api/reinvented/play/:id/:item`) and sees what the
//  server lets them see; the author sees the results instead of the controls. The viewer holds still while the reader
//  has an item left to answer, or a fog left to wipe. Taps on an item stay in it: they never step the viewer.
//

import Observation
import SwiftUI

/// Items as answered in this run (the Moment's own copy is what it was when it opened), and fogs wiped.
@Observable
@MainActor
final class MomentPlayStore {
    static let shared = MomentPlayStore()

    /// Per account (another account signed in on this phone starts with none of the last one's answers).
    private var answeredBy: [String: [String: [String: MomentPlayItem]]] = [:]
    private var wipedBy: [String: Set<String>] = [:]

    private var answered: [String: [String: MomentPlayItem]] {
        get { answeredBy[MomentsComposerModel.account ?? ""] ?? [:] }
        set { answeredBy[MomentsComposerModel.account ?? ""] = newValue }
    }

    var wiped: Set<String> {
        get { wipedBy[MomentsComposerModel.account ?? ""] ?? [] }
        set { wipedBy[MomentsComposerModel.account ?? ""] = newValue }
    }

    /// The paint a reader is trying on each swatch ("<moment>/<item>" → the colour's index); none shows the original.
    var swatchTried: [String: Int] = [:]

    /// The item whose author's answers list is open (a question box's answers, a board's notes).
    var answersOf: (moment: String, item: MomentPlayItem)?
    /// The Moment whose item has its write sheet open (a question box's answer, a board's note): the viewer holds.
    var writingOn: String?

    /// The Moment's items, each as last answered here.
    func items(_ moment: MomentDTO) -> [MomentPlayItem] {
        moment.layers.play.map { answered[moment.id]?[$0.id] ?? $0 }
    }

    func keep(_ item: MomentPlayItem, on momentId: String) {
        answered[momentId, default: [:]][item.id] = item
    }

    /// Answers (or changes the answer); the server's item replaces this one. Nil when it went through, else the words.
    func answer(_ body: MomentPlayAnswerBody, item: MomentPlayItem, on momentId: String) async -> String? {
        do {
            let answer = try await StudioPlayAPI.send(
                StudioPlayEndpoints.answer(postId: momentId, item: item.id, body: body),
                as: MomentPlayItemEnvelope.self
            )
            keep(answer.item, on: momentId)
            return nil
        } catch let failure as StudioPlayFailure {
            return failure.message("Couldn't send that. Try again.")
        } catch {
            return "Couldn't send that. Try again."
        }
    }

    /// Takes the reader's answer back (CONTRACT 7b: a poll, a slider, a board or a question box; never a guess), then
    /// reads the item again for what this reader may see now. Nil when it went through, else the words.
    func takeBack(_ item: MomentPlayItem, on momentId: String) async -> String? {
        do {
            try await StudioPlayAPI.send(StudioPlayEndpoints.takeBack(postId: momentId, item: item.id))
            var fresh = item
            fresh.mine = nil
            if let read = try? await StudioPlayAPI.send(StudioPlayEndpoints.items(postId: momentId), as: MomentPlayItemsEnvelope.self),
               let again = read.play.first(where: { $0.id == item.id }) {
                fresh = again
            }
            keep(fresh, on: momentId)
            return nil
        } catch let failure as StudioPlayFailure {
            return failure.message("Couldn't take that back. Try again.")
        } catch {
            return "Couldn't take that back. Try again."
        }
    }

    /// Items a reader can still answer: open, not yet answered, and of a kind that takes an answer.
    func waiting(_ moment: MomentDTO) -> Bool {
        items(moment).contains { item in
            item.open && item.mine == nil && [.poll, .slider, .board, .question, .guess].contains(item.kind)
        }
    }
}

extension MomentsViewerModel {
    /// The viewer holds still while the reader has an item to answer or a fog to wipe (as the web's viewer does).
    var playItemsHold: Bool {
        guard PulseReinventedFlags.shared.isOn, let moment else { return false }
        let store = MomentPlayStore.shared
        if store.answersOf?.moment == moment.id || store.writingOn == moment.id { return true }
        let fogged = moment.layers.play.contains { $0.kind == .fog } && !store.wiped.contains(moment.id) && !isMine
        return fogged || store.waiting(moment)
    }
}

/// The items on the picture, each at its place, at its author's size.
struct MomentPlayOverlay: View {
    let moment: MomentDTO
    let picture: CGSize?
    private let store = MomentPlayStore.shared
    /// Each card's own height as laid out (before its scale), to keep it inside what shows.
    @State private var heights: [String: CGFloat] = [:]

    /// Cards grow with the picture, but not past this on a wide screen (an iPad, the open Duo): a phone's card
    /// drawn twice as big ran under the caption.
    private static let largest: CGFloat = 1.4
    /// The name row and chips over the top of the picture, and the caption and reply box over its bottom.
    private static let topBand: CGFloat = 110
    private static let bottomBand: CGFloat = 112

    var body: some View {
        GeometryReader { geo in
            let frame = picture.map { MomentMarks.fill($0, in: geo.size) } ?? CGRect(origin: .zero, size: geo.size)
            let unit = min(frame.width, geo.size.width) / 402
            let items = store.items(moment)
            ZStack {
                if let fog = items.first(where: { $0.kind == .fog }), !store.wiped.contains(moment.id) {
                    MomentFogLayer(moment: moment, item: fog)
                }
                ForEach(items.filter { $0.kind == .swatch }) { swatch in
                    MomentSwatchLayer(moment: moment, item: swatch, frame: frame)
                }
                // Moving words (CONTRACT 7k): drawn at their place, moving; never answered.
                ForEach(items.filter { $0.kind == .movingWords }) { item in
                    MomentMovingWordsView(item: item, unit: unit)
                        .position(x: frame.minX + item.x * frame.width, y: frame.minY + item.y * frame.height)
                }
                ForEach(items.filter { ![.fog, .swatch, .beforeAfter, .movingWords, .unknown].contains($0.kind) }) { item in
                    let scale = CGFloat(item.scale) * min(unit, Self.largest)
                    MomentPlayCard(moment: moment, item: item)
                        .frame(width: 268)
                        .fixedSize(horizontal: false, vertical: true)
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { heights[item.id] = $0 }
                        .scaleEffect(scale)
                        .rotationEffect(.degrees(item.rotation))
                        .position(place(item, scale: scale, frame: frame, in: geo.size))
                }
            }
        }
        .sheet(isPresented: Binding(
            get: { store.answersOf?.moment == moment.id },
            set: { if !$0 { store.answersOf = nil } }
        )) {
            if let item = store.answersOf?.item {
                MomentPlayAnswersList(momentId: moment.id, item: item) { store.answersOf = nil }
                    .presentationDetents([.medium, .large])
            }
        }
    }

    /// The card's centre: at its author's place on the picture, moved only as far as it takes to stay inside what
    /// shows, below the name row and above the caption and reply box (a card placed low on a short screen, such as
    /// the open Duo, or drawn big, such as on an iPad, ran under the caption). One that already fits is not moved.
    private func place(_ item: MomentPlayItem, scale: CGFloat, frame: CGRect, in size: CGSize) -> CGPoint {
        let halfWidth = 268 * scale / 2
        let halfHeight = (heights[item.id] ?? 0) * scale / 2
        let wanted = CGPoint(x: frame.minX + item.x * frame.width, y: frame.minY + item.y * frame.height)
        let bottomBand = (moment.caption ?? "").isEmpty ? 76 : Self.bottomBand
        let left = min(halfWidth + 8, size.width / 2)
        let top = Self.topBand + halfHeight
        let bottom = size.height - bottomBand - halfHeight
        return CGPoint(
            x: min(max(wanted.x, left), max(size.width - left, left)),
            y: top <= bottom ? min(max(wanted.y, top), bottom) : (Self.topBand + size.height - bottomBand) / 2
        )
    }
}

/// One item's card: a dark rounded panel holding the kind's own controls.
struct MomentPlayCard: View {
    /// Nil in the Studio, where the item is drawn as it will look, with nothing to press.
    let moment: MomentDTO?
    let item: MomentPlayItem
    var preview = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            content
            if let moment, !preview, MomentPlayTakeBack.offers(item) {
                MomentPlayTakeBack(moment: moment, item: item)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.black.opacity(0.72)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Color.white.opacity(0.16), lineWidth: 1))
        .allowsHitTesting(!preview)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.play.\(item.kind.rawValue)")
    }

    private var content: some View {
        Group {
            if let moment, !preview {
                switch item.kind {
                case .poll: MomentPollCard(moment: moment, item: item)
                case .slider: MomentSliderCard(moment: moment, item: item)
                case .board: MomentBoardCard(moment: moment, item: item)
                case .question: MomentQuestionCard(moment: moment, item: item)
                case .guess: MomentGuessRevealCard(moment: moment, item: item)
                case .countdown: MomentCountdownCard(item: item)
                case .quote: MomentQuoteCard(item: item)
                case .fog, .swatch, .beforeAfter, .movingWords, .unknown: EmptyView()
                }
            } else {
                MomentPlayPreview(item: item)
            }
        }
    }
}

/// "Take it back": the reader's answer on a poll, a slider, a board or a question box comes off while answers are
/// taken (CONTRACT 7b). A guess is one try and stays.
struct MomentPlayTakeBack: View {
    let moment: MomentDTO
    let item: MomentPlayItem
    @State private var sending = false
    @State private var problem: String?

    static func offers(_ item: MomentPlayItem) -> Bool {
        item.open && item.mine != nil && [.poll, .slider, .board, .question].contains(item.kind)
    }

    private var words: String {
        switch item.kind {
        case .poll: "Take my vote back"
        case .board: "Take my face off"
        default: "Take my answer back"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button {
                Task {
                    sending = true
                    problem = await MomentPlayStore.shared.takeBack(item, on: moment.id)
                    sending = false
                }
            } label: {
                Text(words)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.white.opacity(0.85))
                    .underline()
                    .frame(minHeight: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(sending)
            .accessibilityIdentifier("moments.play.takeBack")
            if let problem { MomentPlayNote(words: problem) }
        }
    }
}

/// Words on a dark card.
struct MomentPlayTitle: View {
    let words: String

    var body: some View {
        Text(words)
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(.white)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// A small line under a card's controls (a count, what the author sees, an error).
struct MomentPlayNote: View {
    let words: String

    var body: some View {
        Text(words)
            .font(.system(size: 12.5))
            .foregroundStyle(Color.white.opacity(0.75))
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The author's list of a question box's answers or a board's notes, newest first; each can be removed.
struct MomentPlayAnswersList: View {
    let momentId: String
    let item: MomentPlayItem
    let onClose: () -> Void
    @State private var rows: [MomentPlayAnswersPage.Row] = []
    @State private var next: String?
    @State private var loading = true

    var body: some View {
        // No NavigationStack: shown as a sheet from inside the viewer, one was shown again about once a second (as
        // the field guide was); a plain header with Done holds still.
        VStack(spacing: 0) {
            HStack(spacing: Spacing.s2) {
                Text(item.prompt ?? item.question ?? "Answers")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                Button("Done", action: onClose)
                    .font(.system(size: 17, weight: .semibold))
                    .accessibilityIdentifier("moments.play.answers.done")
            }
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 52)
            List {
                if !loading, rows.isEmpty {
                    Text("No answers yet.").foregroundStyle(Theme.Color.appTextSecondary)
                }
                ForEach(rows) { row in
                    HStack(alignment: .top, spacing: Spacing.s2) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(row.text ?? row.note ?? "")
                                .font(.system(size: 15))
                                .foregroundStyle(Theme.Color.appText)
                            Text(row.person?.name ?? "Someone")
                                .font(.system(size: 12.5))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Spacer(minLength: 0)
                        // Also as a swipe; here so it can be found.
                        Button("Remove", role: .destructive) { Task { await remove(row) } }
                            .font(.system(size: 13.5, weight: .semibold))
                            .buttonStyle(.borderless)
                            .accessibilityIdentifier("moments.play.answers.remove")
                    }
                    .swipeActions {
                        Button("Remove", role: .destructive) { Task { await remove(row) } }
                    }
                }
                if next != nil {
                    Button("Show more") { Task { await load(reset: false) } }
                }
            }
        }
        .background(Theme.Color.appBg.ignoresSafeArea())
        .task { await load(reset: true) }
        .accessibilityIdentifier("moments.play.answers")
    }

    private func load(reset: Bool) async {
        loading = true
        defer { loading = false }
        guard let page = try? await StudioPlayAPI.send(
            StudioPlayEndpoints.answers(postId: momentId, item: item.id, cursor: reset ? nil : next),
            as: MomentPlayAnswersPage.self
        ) else { return }
        rows = reset ? page.answers : rows + page.answers
        next = page.nextCursor
    }

    private func remove(_ row: MomentPlayAnswersPage.Row) async {
        guard await (try? StudioPlayAPI.send(StudioPlayEndpoints.removeAnswer(postId: momentId, item: item.id, answer: row.id))) != nil
        else { return }
        rows.removeAll { $0.id == row.id }
    }
}

/// An item as it will look, in the Studio: its words and choices, nothing to press.
struct MomentPlayPreview: View {
    let item: MomentPlayItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            switch item.kind {
            case .countdown: MomentCountdownCard(item: item)
            case .quote: MomentQuoteCard(item: item)
            default:
                MomentPlayTitle(words: item.question ?? item.prompt ?? item.title ?? "")
                ForEach(Array((item.options ?? []).enumerated()), id: \.offset) { _, option in
                    Text(option)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .frame(maxWidth: .infinity, minHeight: 34, alignment: .leading)
                        .background(Capsule().fill(Color.white.opacity(0.14)))
                }
                if let left = item.left ?? item.xAxis?.left, let right = item.right ?? item.xAxis?.right {
                    MomentPlayNote(words: "\(left) ↔ \(right)")
                }
                if let range = item.range {
                    MomentPlayNote(words: "A number from \(Int(range.min)) to \(Int(range.max))\(range.unit.map { " \($0)" } ?? "")")
                }
                if item.kind == .question { MomentPlayNote(words: "Answers come to you alone.") }
            }
        }
    }
}

/// A field on a card that looks like one and opens `MomentPlayWriteSheet`: the viewer ignores the keyboard, so a field on
/// a card in the lower half of the picture would be typed into under it.
struct MomentPlayWriteField: View {
    let words: String
    let placeholder: String
    let id: String
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            Text(words.isEmpty ? placeholder : words)
                .font(.system(size: 14.5))
                .foregroundStyle(words.isEmpty ? Color.white.opacity(0.55) : .white)
                .lineLimit(1)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, minHeight: 38, alignment: .leading)
                .background(Capsule().fill(Color.white.opacity(0.14)))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(placeholder)
        .accessibilityValue(words)
        .accessibilityIdentifier(id)
    }
}

/// Writing on an item (a question box's answer, a board's note) in a sheet of its own over the viewer, above the keyboard.
struct MomentPlayWriteSheet: View {
    let title: String
    let placeholder: String
    let limit: Int
    @Binding var text: String
    let sendWords: String
    let send: () async -> String?
    let onDone: () -> Void
    @State private var sending = false
    @State private var problem: String?
    @FocusState private var typing: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text(title)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            // One line, and the keyboard's own key sends: a first tap on Send while the keyboard is up only lowers it.
            TextField("", text: $text, prompt: Text(placeholder).foregroundColor(Color.white.opacity(0.55)))
                .font(.system(size: 15))
                .foregroundStyle(.white)
                .tint(.white)
                .submitLabel(sendWords == "Send" ? .send : .done)
                .onSubmit(submit)
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.12)))
                .focused($typing)
                .onChange(of: text) { _, typed in if typed.count > limit { text = String(typed.prefix(limit)) } }
                .accessibilityIdentifier("moments.play.write.field")
            HStack {
                if let problem { MomentPlayNote(words: problem) }
                Spacer(minLength: 0)
                Button(sendWords, action: submit)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .disabled(sending || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityIdentifier("moments.play.write.send")
            }
            Spacer(minLength: 0)
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(white: 0.11).ignoresSafeArea())
        .environment(\.colorScheme, .dark)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .onAppear { typing = true }
    }

    private func submit() {
        guard !sending, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        Task {
            sending = true
            problem = await send()
            sending = false
            if problem == nil { onDone() }
        }
    }
}
