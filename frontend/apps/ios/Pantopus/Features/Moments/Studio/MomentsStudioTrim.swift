//
//  MomentsStudioTrim.swift
//  Pantopus
//
//  Trim in the Studio ("Pulse, reinvented" phase 5, piece A2: "A video also has trim"): the part of a video that goes
//  out, picked on the Studio's first screen with where it starts and where it ends. The cut is made on the phone
//  without re-encoding (`MomentsTrimMaker`): its own frames and its sound, nothing else changed. It posts as today's
//  video Moment, only shorter, so nothing new is sent and every app shows it. "Use the whole video" puts the video back
//  as it was. Not while it's a loop: a loop picks its own part (`MomentsStudioLoop`).
//

import AVFoundation
import SwiftUI

/// The trim made of the Studio's video, and the video it was cut from (`MomentsStudioTools.trim`).
struct MomentsStudioTrimmed: Equatable {
    /// The video as picked or recorded, and how it showed: put back by "Use the whole video".
    let original: URL
    let originalVideo: MomentsStudioLoopVideo
    /// The trimmed file (the draft while the trim is on), and the part of the original it holds, in seconds.
    let file: URL
    let start: Double
    let end: Double
}

/// Cuts a part out of a video, as it is: no re-encoding, its sound kept, nothing of where it was taken.
enum MomentsTrimMaker {
    /// The shortest part that may go out.
    static let shortest = 1.0

    enum Failure: Error {
        case unwritable
    }

    static func make(_ source: URL, start: Double, end: Double) async throws -> URL {
        let output = MomentsDraftFiles.newFile(MomentsDraftFiles.libraryPrefix)
        guard let exporter = AVAssetExportSession(asset: AVURLAsset(url: source), presetName: AVAssetExportPresetPassthrough)
        else { throw Failure.unwritable }
        exporter.outputURL = output
        exporter.outputFileType = .mov
        exporter.metadata = []
        exporter.timeRange = CMTimeRange(
            start: CMTime(seconds: start, preferredTimescale: 600),
            end: CMTime(seconds: end, preferredTimescale: 600)
        )
        await exporter.export()
        guard exporter.status == .completed else {
            MomentsDraftFiles.drop(output)
            throw Failure.unwritable
        }
        return output
    }
}

extension MomentsComposerModel {
    /// Trim is on the rail for a video in the Studio (the switch on), unless it's a loop.
    var offersTrim: Bool {
        guard PulseReinventedFlags.shared.isOn, marking.studio != nil, case .video = draft, studioLoop == nil else { return false }
        return true
    }

    /// The trim on the Studio's video now: only while that video is still the trim's own file.
    var studioTrim: MomentsStudioTrimmed? {
        guard let trim = marking.studio?.trim, case let .video(url) = draft, url == trim.file else { return nil }
        return trim
    }

    /// The video a trim is cut from: the original while a trim is on, else the video as it is.
    func trimSource() async -> (url: URL, video: MomentsStudioLoopVideo)? {
        if let trim = studioTrim { return (trim.original, trim.originalVideo) }
        return await loopSource()
    }

    /// Cuts the part from `start` to `end` (seconds of the original) and puts it in the video's place, keeping the
    /// marks, its place on the canvas and the Studio's other tools.
    func makeTrim(start: Double, end: Double) async -> Bool {
        guard !isPosting, let source = await trimSource() else { return false }
        let from = max(0, min(start, source.video.seconds - MomentsTrimMaker.shortest))
        let to = min(max(end, from + MomentsTrimMaker.shortest), source.video.seconds)
        do {
            let made = try await MomentsTrimMaker.make(source.url, start: from, end: to)
            // The person moved on (another video, Retake, the Studio closed) while it was made: it isn't wanted.
            guard !isPosting, await trimSource()?.url == source.url else {
                MomentsDraftFiles.drop(made)
                return false
            }
            let before = studioTrim?.file
            marking.studio?.trim = MomentsStudioTrimmed(
                original: source.url, originalVideo: source.video, file: made, start: from, end: to
            )
            use(marked: made, video: (source.video.size, to - from), marking.marks, placement: marking.placement)
            if let before, before != made { MomentsDraftFiles.drop(before) }
            return true
        } catch {
            return false
        }
    }

    /// "Use the whole video": the video as it was.
    func takeTrimOff() {
        guard !isPosting, let trim = studioTrim else { return }
        marking.studio?.trim = nil
        let video = (trim.originalVideo.size, trim.originalVideo.seconds)
        use(marked: trim.original, video: video, marking.marks, placement: marking.placement)
        MomentsDraftFiles.drop(trim.file)
    }
}

/// The Studio's Trim sheet: where the part starts and ends, and cutting it.
struct MomentsStudioTrimSheet: View {
    let model: MomentsComposerModel
    let onDone: () -> Void
    @State private var start = 0.0
    @State private var end = 1.0
    @State private var making = false
    @State private var failed = false
    /// The original video's length, read when the sheet opens (nil until then).
    @State private var seconds: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Trim")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text("Only this part of the video goes out, with its sound.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if let seconds, seconds > MomentsTrimMaker.shortest {
                slider("Starts at", value: $start, in: 0...(seconds - MomentsTrimMaker.shortest), id: "moments.studio.trim.start")
                slider("Ends at", value: $end, in: MomentsTrimMaker.shortest...seconds, id: "moments.studio.trim.end")
                Text("\(String(format: "%.1f", max(end - start, 0))) s of \(String(format: "%.1f", seconds)) s")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if failed {
                    Text("That didn't work. Try again.")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.error)
                }
                HStack(spacing: Spacing.s2) {
                    if model.studioTrim != nil {
                        button("Use the whole video", primary: false, id: "moments.studio.trim.off") {
                            model.takeTrimOff()
                            onDone()
                        }
                    }
                    button(making ? "Trimming…" : "Trim", primary: true, id: "moments.studio.trim.make") { cut() }
                        .disabled(making || end - start < MomentsTrimMaker.shortest - 0.01)
                }
            } else if seconds != nil {
                Text("This video is too short to trim.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .task { await begin() }
        .onChange(of: start) { _, value in if end < value + MomentsTrimMaker.shortest { end = value + MomentsTrimMaker.shortest } }
        .onChange(of: end) { _, value in
            if start > value - MomentsTrimMaker.shortest { start = max(0, value - MomentsTrimMaker.shortest) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.studio.trim")
    }

    private func begin() async {
        guard let source = await model.trimSource() else { return }
        seconds = source.video.seconds
        if let trim = model.studioTrim {
            (start, end) = (trim.start, trim.end)
        } else {
            (start, end) = (0, source.video.seconds)
        }
    }

    private func cut() {
        making = true
        failed = false
        Task {
            let made = await model.makeTrim(start: start, end: end)
            making = false
            if made { onDone() } else { failed = true }
        }
    }

    private func slider(_ title: String, value: Binding<Double>, in range: ClosedRange<Double>, id: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("\(title) \(String(format: "%.1f", value.wrappedValue)) s")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Slider(value: value, in: range)
                .frame(minHeight: 44)
                .accessibilityLabel(title)
                .accessibilityValue("\(String(format: "%.1f", value.wrappedValue)) seconds")
                .accessibilityIdentifier(id)
        }
    }

    private func button(_ words: String, primary: Bool, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(words)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(primary ? Color.white : Theme.Color.appText)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(Capsule().fill(primary ? Theme.Color.primarySolid : Theme.Color.appSurfaceRaised))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }
}
