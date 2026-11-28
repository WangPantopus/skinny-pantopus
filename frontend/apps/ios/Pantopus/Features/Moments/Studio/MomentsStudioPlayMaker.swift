//
//  MomentsStudioPlayMaker.swift
//  Pantopus
//
//  The tray's Play maker (CONTRACT 7b, 7g): pick a kind, write its words, and put it on the picture. The words are
//  checked as the caption is under a made-up name; a quote can be lifted from the photo itself (read on the phone).
//

import SwiftUI

struct MomentsStudioPlayMaker: View {
    enum Making: String, CaseIterable, Identifiable {
        case poll, slider, dial, board, question, guess, countdown, quote, fog, swatch, movingWords

        var id: String {
            rawValue
        }

        var title: String {
            switch self {
            case .poll: "Poll"
            case .slider: "Slider"
            case .dial: "Spectrum dial"
            case .board: "Where do you stand"
            case .question: "Question box"
            case .guess: "Guess and reveal"
            case .countdown: "Countdown"
            case .quote: "Quote"
            case .fog: "Fog-wipe"
            case .swatch: "Swatch"
            case .movingWords: "Moving words"
            }
        }
    }

    let model: MomentsComposerModel
    let onDone: () -> Void
    @State private var making: Making?
    @State private var words = ["", "", "", "", "", ""]
    @State private var options = ["", ""]
    @State private var right = 0
    @State private var byNumber = false
    @State private var ends = Date().addingTimeInterval(86400)
    @State private var swatches: Set<Int> = [0, 1]
    @State private var movingText = ""
    @State private var movingLettering = "classic"
    @State private var movingMotion = "drift"
    @State private var movingColor = MomentMovingWordsColor.white
    @State private var lifted: [String] = []

    private var kinds: [Making] {
        Making.allCases.filter { kind in
            switch kind {
            case .fog: model.offersLooks && !(model.marking.studio?.play.contains { $0.kind == .fog } ?? false)
            case .swatch: model.offersLooks && !(model.marking.studio?.play.contains { $0.kind == .swatch } ?? false)
            case .movingWords:
                model.offersLooks && (model.marking.studio?.play.filter { $0.kind == .movingWords }.count ?? 0) < MomentsMovingWords.most
            default: true
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(model.offersGuess ? "More to play" : "Play")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            if !model.offersMorePlay {
                hint("Up to \(MomentsComposerModel.playLimit) on one post.")
            } else {
                MomentsStudioTrayFlow(spacing: Spacing.s2) {
                    ForEach(kinds) { kind in
                        Button { start(kind) } label: { chip(kind.title, on: making == kind) }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("moments.studio.play.make.\(kind.rawValue)")
                    }
                }
                if let making { form(making) }
            }
        }
        .onAppear(perform: takeSuggestion)
    }

    /// Illuminate's suggestion opened this maker (CONTRACT 7i): its kind, filled only with what the caption says.
    private func takeSuggestion() {
        guard let fill = MomentsStudioSuggestState.shared.prefill else { return }
        MomentsStudioSuggestState.shared.prefill = nil
        making = nil
        start(fill.kind)
        words[0] = fill.prompt
        if !fill.options.isEmpty { options = fill.options.map { String($0.prefix(40)) } }
        byNumber = fill.kind == .guess
    }

    private func start(_ kind: Making) {
        making = making == kind ? nil : kind
        words = ["", "", "", "", "", ""]
        options = ["", ""]
        (right, byNumber, lifted) = (0, false, [])
    }

    @ViewBuilder
    private func form(_ kind: Making) -> some View {
        switch kind {
        case .poll:
            field("Ask something", 0, limit: 100)
            optionFields(withRight: false)
        case .slider, .dial:
            field("Ask something", 0, limit: 100)
            HStack {
                field(kind == .dial ? "One end" : "Left word", 1, limit: 24)
                field(kind == .dial ? "Other end" : "Right word", 2, limit: 24)
            }
            if kind == .slider { field("An emoji to slide (optional)", 3, limit: 4) }
        case .board:
            field("Where do you stand on…", 0, limit: 100)
            HStack { field("Left", 1, limit: 24)
                field("Right", 2, limit: 24)
            }
            HStack { field("Bottom", 3, limit: 24)
                field("Top", 4, limit: 24)
            }
        case .question:
            field("Ask people something", 0, limit: 100)
            hint("Answers come to you alone.")
        case .guess:
            field("What to guess", 0, limit: 100)
            Picker("", selection: $byNumber) {
                Text("Choices").tag(false)
                Text("A number").tag(true)
            }
            .pickerStyle(.segmented)
            if byNumber {
                HStack { field("From", 1, limit: 9)
                    field("To", 2, limit: 9)
                    field("Unit", 3, limit: 12)
                }
                field("The right number", 4, limit: 9)
            } else {
                optionFields(withRight: true)
            }
        case .countdown:
            field("What it counts down to", 0, limit: 60)
            DatePicker("Ends", selection: $ends, in: Date().addingTimeInterval(120)...Date().addingTimeInterval(30 * 86400))
                .foregroundStyle(Theme.Color.appText)
        case .quote:
            quoteForm
        case .fog:
            hint("The picture opens frosted; people wipe it clear on their own screen.")
        case .swatch:
            swatchForm
        case .movingWords:
            MomentsStudioMovingWordsForm(words: $movingText, lettering: $movingLettering, motion: $movingMotion, color: $movingColor)
        }
        Button { put(kind) } label: {
            Text("Put it on the picture")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(Capsule().fill(Theme.Color.primarySolid))
        }
        .buttonStyle(.plain)
        .disabled(item(kind) == nil)
        .opacity(item(kind) == nil ? 0.5 : 1)
        .accessibilityIdentifier("moments.studio.play.put")
    }

    private var quoteForm: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            field("The words", 0, limit: 280)
            field("Where they're from (optional)", 1, limit: 80)
            if case let .photo(image) = model.draft {
                Button { Task { lifted = await MomentsQuoteLifter.lines(in: model.marking.base ?? image) } } label: {
                    chip("Lift words from this photo", on: false)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("moments.studio.play.lift")
                ForEach(Array(lifted.prefix(8).enumerated()), id: \.offset) { _, line in
                    Button { words[0] = String((words[0].isEmpty ? line : words[0] + " " + line).prefix(280)) } label: {
                        Text(line).font(.system(size: 14)).foregroundStyle(Theme.Color.appText).multilineTextAlignment(.leading)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var swatchForm: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            hint("Colours people can try over the middle of your photo. The photo itself never changes.")
            HStack(spacing: Spacing.s2) {
                ForEach(Array(MomentsSwatchPaints.all.enumerated()), id: \.offset) { index, paint in
                    Button {
                        if swatches.contains(index) { swatches.remove(index) } else { swatches.insert(index) }
                    } label: {
                        Circle()
                            .fill(paint.color)
                            .frame(width: 32, height: 32)
                            .overlay(Circle().stroke(Theme.Color.appText, lineWidth: swatches.contains(index) ? 3 : 0))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(paint.name)
                    .accessibilityAddTraits(swatches.contains(index) ? [.isButton, .isSelected] : .isButton)
                }
            }
        }
    }

    private func optionFields(withRight: Bool) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ForEach(options.indices, id: \.self) { index in
                HStack(spacing: Spacing.s2) {
                    if withRight {
                        Button { right = index } label: {
                            Icon(right == index ? .check : .circleDot, size: 18, strokeWidth: 2.2, color: Theme.Color.primaryTint)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Option \(index + 1) is the answer")
                    }
                    TextField(
                        "",
                        text: Binding(get: { options[index] }, set: { options[index] = String($0.prefix(40)) }),
                        prompt: Text("Option \(index + 1)").foregroundColor(Theme.Color.appTextSecondary)
                    )
                    .modifier(MomentsStudioFieldLook())
                }
            }
            if options.count < 4 {
                Button { options.append("") } label: { chip("Add an option", on: false) }.buttonStyle(.plain)
            }
        }
    }

    private func field(_ prompt: String, _ index: Int, limit: Int) -> some View {
        TextField(
            "",
            text: Binding(get: { words[index] }, set: { words[index] = String($0.prefix(limit)) }),
            prompt: Text(prompt).foregroundColor(Theme.Color.appTextSecondary)
        )
        .modifier(MomentsStudioFieldLook())
        .accessibilityLabel(prompt)
    }

    private func put(_ kind: Making) {
        guard let made = item(kind) else { return }
        model.addStudioPlay(made)
        making = nil
        onDone()
    }

    private func trimmed(_ index: Int) -> String {
        words[index].trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// The item the form makes, or nil while something it needs is missing.
    private func item(_ kind: Making) -> MomentPlayItem? {
        switch kind {
        case .poll, .guess: choiceItem(kind)
        case .slider, .dial, .board: lineItem(kind)
        case .question, .countdown, .quote: wordsItem(kind)
        case .fog: MomentPlayItem(id: model.playId(.fog), kind: .fog)
        case .swatch: swatchItem()
        case .movingWords: movingWordsItem()
        }
    }

    /// Moving words (CONTRACT 7k): one line of the author's own words, a lettering, a motion and a colour.
    private func movingWordsItem() -> MomentPlayItem? {
        let words = movingText.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !words.isEmpty else { return nil }
        var item = MomentPlayItem(id: model.playId(.movingWords), kind: .movingWords)
        item.text = MomentsMovingWords.cut(words)
        item.lettering = movingLettering
        item.motion = movingMotion
        item.color = movingColor
        return item
    }

    private func hint(_ words: String) -> some View {
        Text(words).font(.system(size: 13)).foregroundStyle(Theme.Color.appTextSecondary).fixedSize(horizontal: false, vertical: true)
    }

    private func chip(_ words: String, on: Bool) -> some View {
        Text(words)
            .font(.system(size: 14.5, weight: .semibold))
            .foregroundStyle(on ? Color.white : Theme.Color.appText)
            .padding(.horizontal, 12)
            .frame(height: 36)
            .background(Capsule().fill(on ? Theme.Color.primarySolid : Theme.Color.appSurfaceRaised))
            .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: on ? 0 : 1))
            .contentShape(Capsule())
    }
}

extension MomentsStudioPlayMaker {
    private var filledOptions: [String] {
        options.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }

    private func choiceItem(_ kind: Making) -> MomentPlayItem? {
        let first = trimmed(0)
        guard !first.isEmpty else { return nil }
        if kind == .poll {
            guard filledOptions.count >= 2 else { return nil }
            var item = MomentPlayItem(id: model.playId(.poll), kind: .poll)
            item.question = first
            item.options = filledOptions
            return item
        }
        var item = MomentPlayItem(id: model.playId(.guess), kind: .guess)
        item.prompt = first
        if byNumber {
            guard let low = Double(trimmed(1)), let high = Double(trimmed(2)), let answer = Double(trimmed(4)), low < high,
                  (low...high).contains(answer) else { return nil }
            item.range = MomentPlayItem.Range(min: low, max: high, unit: trimmed(3).isEmpty ? nil : trimmed(3))
            item.answer = answer
            return item
        }
        let rightWords = options.indices.contains(right) ? options[right].trimmingCharacters(in: .whitespacesAndNewlines) : ""
        guard filledOptions.count >= 2, let index = filledOptions.firstIndex(of: rightWords) else { return nil }
        item.options = filledOptions
        item.answer = Double(index)
        return item
    }

    private func lineItem(_ kind: Making) -> MomentPlayItem? {
        let first = trimmed(0)
        guard !first.isEmpty, !trimmed(1).isEmpty, !trimmed(2).isEmpty else { return nil }
        if kind == .board {
            guard !trimmed(3).isEmpty, !trimmed(4).isEmpty else { return nil }
            var item = MomentPlayItem(id: model.playId(.board), kind: .board)
            item.question = first
            item.xAxis = MomentPlayItem.Axis(left: trimmed(1), right: trimmed(2))
            item.yAxis = MomentPlayItem.Axis(bottom: trimmed(3), top: trimmed(4))
            return item
        }
        var item = MomentPlayItem(id: model.playId(.slider), kind: .slider)
        item.question = first
        item.left = trimmed(1)
        item.right = trimmed(2)
        item.look = kind == .dial ? "dial" : "slider"
        if kind == .slider, !trimmed(3).isEmpty { item.emoji = trimmed(3) }
        return item
    }

    private func wordsItem(_ kind: Making) -> MomentPlayItem? {
        let first = trimmed(0)
        guard !first.isEmpty else { return nil }
        switch kind {
        case .question:
            var item = MomentPlayItem(id: model.playId(.question), kind: .question)
            item.prompt = first
            return item
        case .countdown:
            guard ends > Date() else { return nil }
            var item = MomentPlayItem(id: model.playId(.countdown), kind: .countdown)
            item.title = first
            item.endsAt = MomentTime.string(ends)
            return item
        default:
            var item = MomentPlayItem(id: model.playId(.quote), kind: .quote)
            item.text = first
            item.source = trimmed(1).isEmpty ? nil : trimmed(1)
            return item
        }
    }

    private func swatchItem() -> MomentPlayItem? {
        let picked = swatches.sorted().compactMap { MomentsSwatchPaints.all[safeAt: $0]?.hex }
        guard !picked.isEmpty else { return nil }
        var item = MomentPlayItem(id: model.playId(.swatch), kind: .swatch)
        item.colors = picked
        item.box = MomentPlayItem.Box(x: 0.3, y: 0.35, w: 0.4, h: 0.3)
        return item
    }
}

/// A text field as the tray draws them.
struct MomentsStudioFieldLook: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 15))
            .foregroundStyle(Theme.Color.appText)
            .padding(.horizontal, 12)
            .frame(height: 40)
            .typesInFieldOnTap()
            .background(RoundedRectangle(cornerRadius: Radii.md).fill(Theme.Color.appSurfaceRaised))
    }
}

/// The paints a swatch offers, as sRGB parts (sent as "#RRGGBB").
enum MomentsSwatchPaints {
    struct Paint {
        let name: String
        let red: Int
        let green: Int
        let blue: Int

        var color: Color {
            Color(red: Double(red) / 255, green: Double(green) / 255, blue: Double(blue) / 255)
        }

        var hex: String {
            String(format: "#%02X%02X%02X", red, green, blue)
        }
    }

    static let all = [
        Paint(name: "Sage", red: 156, green: 175, blue: 136),
        Paint(name: "Brick", red: 165, green: 72, blue: 54),
        Paint(name: "Navy", red: 34, green: 52, blue: 89),
        Paint(name: "Cream", red: 240, green: 228, blue: 200),
        Paint(name: "Charcoal", red: 54, green: 57, blue: 61),
        Paint(name: "Mustard", red: 214, green: 168, blue: 46)
    ]
}

private extension Array {
    subscript(safeAt index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
