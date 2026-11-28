//
//  MomentsStudioLoop.swift
//  Pantopus
//
//  Loop in the Studio ("Pulse, reinvented" phase 0 step 5, DESIGN row 7; CONTRACT 7j): a short piece of a video that
//  plays over and over, silently. On the phone the file itself becomes the loop (`MomentsLoopMaker`): the span the person
//  picks, with the sound taken out and, with Bounce, played back again after it. It posts as today's video Moment with
//  `loop: { "bounce" }`, so the new viewers repeat it and today's play it once as a short, silent video. Only a video
//  that goes out as one Moment; taking the loop off puts the video back as it was.
//

import SwiftUI

/// The loop made from the Studio's video, and the video it was made from (`MomentsStudioTools.loop`).
struct MomentsStudioLoopMade: Equatable {
    /// The video as picked or recorded, and how it showed: put back when the loop comes off.
    let original: URL
    let originalVideo: MomentsStudioLoopVideo
    /// The loop's own file (the draft while the loop is on), and its length.
    let file: URL
    let seconds: Double
    let start: Double
    let length: Double
    let bounce: Bool
}

/// A video's picture size and length, as the marks keep them.
struct MomentsStudioLoopVideo: Equatable {
    let size: CGSize
    let seconds: Double
}

extension MomentsComposerModel {
    /// Loop is offered on a video while the switch is on (the sheet says so when it is too long to be one Moment).
    var offersLoop: Bool {
        guard PulseReinventedFlags.shared.isOn, case .video = draft else { return false }
        return true
    }

    /// The loop on the Studio's video now: only while that video is still the loop's own file.
    var studioLoop: MomentsStudioLoopMade? {
        guard let loop = marking.studio?.loop, case let .video(url) = draft, url == loop.file else { return nil }
        return loop
    }

    /// The video the loop is made from: the original while a loop is on, else the draft itself, with how it shows.
    func loopSource() async -> (url: URL, video: MomentsStudioLoopVideo)? {
        if let loop = studioLoop { return (loop.original, loop.originalVideo) }
        guard case let .video(url) = draft else { return nil }
        if let video = marking.video { return (url, MomentsStudioLoopVideo(size: video.size, seconds: video.seconds)) }
        guard let shown = await MomentsMediaExport.shown(url), draft == .video(url) else { return nil }
        return (url, MomentsStudioLoopVideo(size: shown.size, seconds: shown.seconds))
    }

    /// The video under the loop goes out as one Moment (a loop is never a video posted in parts).
    static func loopFits(_ seconds: Double) -> Bool {
        seconds >= MomentsLoopMaker.shortest && MomentsMediaExport.parts(of: seconds).count == 1
    }

    /// Makes the loop and puts it in the video's place, keeping the marks and the Studio's other tools.
    func makeLoop(start: Double, length: Double, bounce: Bool) async -> Bool {
        guard !isPosting, let source = await loopSource(), Self.loopFits(source.video.seconds) else { return false }
        do {
            let made = try await MomentsLoopMaker.make(source.url, start: start, length: length, bounce: bounce)
            // The person moved on (another video, Retake, the Studio closed) while it was made: it isn't wanted.
            guard !isPosting, await loopSource()?.url == source.url else {
                MomentsDraftFiles.drop(made.url)
                return false
            }
            let before = studioLoop?.file
            if marking.studio == nil { marking.studio = MomentsStudioTools() }
            marking.studio?.loop = MomentsStudioLoopMade(
                original: source.url,
                originalVideo: source.video,
                file: made.url,
                seconds: made.seconds,
                start: start,
                length: length,
                bounce: bounce
            )
            use(marked: made.url, video: (source.video.size, made.seconds), marking.marks, placement: marking.placement)
            if let before, before != made.url { MomentsDraftFiles.drop(before) }
            return true
        } catch {
            return false
        }
    }

    /// "Take the loop off": the video as it was, with its sound.
    func takeLoopOff() {
        guard !isPosting, let loop = studioLoop else { return }
        marking.studio?.loop = nil
        let video = (loop.originalVideo.size, loop.originalVideo.seconds)
        use(marked: loop.original, video: video, marking.marks, placement: marking.placement)
        MomentsDraftFiles.drop(loop.file)
    }

    /// What the Moment sends as its loop (`+Posting`): nil unless the switch is on and the video is the loop's file.
    func takeLoop() -> MomentLoopBody? {
        guard PulseReinventedFlags.shared.isOn, let loop = studioLoop else { return nil }
        return MomentLoopBody(bounce: loop.bounce)
    }
}

/// The Studio's Loop sheet: where the part starts, how long it lasts, Bounce, and making it.
struct MomentsStudioLoopSheet: View {
    let model: MomentsComposerModel
    let onDone: () -> Void
    @State private var start = 0.0
    @State private var length = 3.0
    @State private var bounce = false
    @State private var making = false
    @State private var failed = false
    /// The video's length, read when the sheet opens (nil until then).
    @State private var seconds: Double?

    private var longest: Double {
        min(bounce ? MomentsLoopMaker.longestBounce : MomentsLoopMaker.longest, max((seconds ?? 0) - start, MomentsLoopMaker.shortest))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text("Loop")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text("This part plays over and over, without sound. Anyone whose app doesn't loop yet sees it play once.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if let seconds, MomentsComposerModel.loopFits(seconds) {
                    let shortest = MomentsLoopMaker.shortest
                    slider("Starts at", value: $start, in: 0...max(seconds - shortest, 0.01), id: "moments.studio.loop.start")
                    slider("Lasts", value: $length, in: shortest...max(longest, shortest + 0.01), id: "moments.studio.loop.length")
                    Toggle(isOn: $bounce) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Bounce")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Theme.Color.appText)
                            Text("Forward, then back. Up to three seconds each way.")
                                .font(.system(size: 12.5))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .tint(Theme.Color.primarySolid)
                    .frame(minHeight: 52)
                    .accessibilityIdentifier("moments.studio.loop.bounce")
                    actions
                } else if seconds == nil {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 80)
                } else {
                    Text("A loop is one short video. Choose a video up to a minute to loop it.")
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.Color.appText)
                }
                if failed {
                    Text("Couldn't make the loop from this video. Try another part.")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .accessibilityIdentifier("moments.studio.loop.failed")
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s5)
            .padding(.bottom, Spacing.s4)
        }
        .task { await begin() }
        .onChange(of: bounce) { _, _ in length = min(length, longest) }
        .onChange(of: start) { _, _ in length = min(length, longest) }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.studio.loop")
    }

    private var actions: some View {
        HStack(spacing: Spacing.s2) {
            button(making ? "Making the loop…" : model.studioLoop == nil ? "Make the loop" : "Make it again", on: true) {
                Task {
                    making = true
                    failed = false
                    let made = await model.makeLoop(start: start, length: min(length, longest), bounce: bounce)
                    making = false
                    if made { onDone() } else { failed = true }
                }
            }
            .disabled(making)
            .accessibilityIdentifier("moments.studio.loop.make")
            if model.studioLoop != nil {
                button("Take the loop off", on: false) {
                    model.takeLoopOff()
                    onDone()
                }
                .disabled(making)
                .accessibilityIdentifier("moments.studio.loop.off")
            }
            Spacer(minLength: 0)
        }
    }

    /// Opening it again shows the loop that's on; the first time, the first three seconds (or all of a shorter video).
    private func begin() async {
        let shown = await model.loopSource()?.video.seconds ?? 0
        if let loop = model.studioLoop {
            (start, length, bounce) = (loop.start, loop.length, loop.bounce)
        } else {
            start = 0
            length = min(3, max(shown, MomentsLoopMaker.shortest))
        }
        seconds = shown
    }

    private func slider(_ title: String, value: Binding<Double>, in range: ClosedRange<Double>, id: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                Text(String(format: "%.1f s", value.wrappedValue))
                    .font(.system(size: 14))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Slider(value: value, in: range, step: 0.1)
                .tint(Theme.Color.primarySolid)
                .accessibilityLabel(title)
                .accessibilityValue(String(format: "%.1f seconds", value.wrappedValue))
                .accessibilityIdentifier(id)
        }
        .disabled(making)
    }

    private func button(_ words: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(words)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(on ? Color.white : Theme.Color.appText)
                .padding(.horizontal, 14)
                .frame(minHeight: 44)
                .background(Capsule().fill(on ? Theme.Color.primarySolid : Theme.Color.appSurfaceRaised))
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: on ? 0 : 1))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

extension View {
    /// The Studio's Loop sheet over the stage, dark like its other sheets.
    func studioLoopSheet(model: MomentsComposerModel, isPresented: Binding<Bool>) -> some View {
        sheet(isPresented: isPresented) {
            MomentsStudioLoopSheet(model: model) { isPresented.wrappedValue = false }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground { Theme.Color.appSurface.environment(\.colorScheme, .dark) }
                .environment(\.colorScheme, .dark)
        }
    }
}
