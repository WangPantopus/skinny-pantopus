//
//  BallotGovernmentsView.swift
//  Pantopus
//
//  The governments view (Board: The peel, with the proposed board "P0:
//  governments view"). The progress bar, the address with Skip, the
//  stack at the peel's geometry, then the story: each government lifts,
//  takes the green highlight and shows its caption for 1.2 s, ending on
//  the finished frame — "Your address" over the serif count, the names,
//  and Done over the boundary source. The middle scrolls on a short
//  screen; Done stays 24 above the bottom, as on the board.
//
//  P0 captions carry the overline and the name only: the board's third
//  line says what each government decides this year, which needs contest
//  data (P1). The story plays once and holds the finished frame; Skip
//  jumps there, and Reduce Motion starts there.
//

import SwiftUI

struct BallotGovernmentsView: View {
    let governments: BallotGovernments
    let address: String
    let onClose: () -> Void
    /// False shows the finished frame (the still board).
    var animate = true

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var started = Date.now
    @State private var finished = false

    /// The design system's serif ("ceremonial letter") face, 30/34 bold.
    private static let titleFont = Font.system(size: 30, weight: .bold, design: .serif)

    private var story: BallotStory {
        BallotStory(steps: min(governments.items.count, BallotStackGeometry.layers(for: governments.count)))
    }

    private var playing: Bool {
        animate && !reduceMotion && !finished && story.steps > 0
    }

    private var countText: String {
        governments.countIsMinimum ? "at least \(governments.count)" : "\(governments.count)"
    }

    /// "Government 2 of at least 5" — a P0 count is a minimum.
    static func overline(_ k: Int, of total: Int, minimum: Bool) -> String {
        "Government \(k) of \(minimum ? "at least " : "")\(total)"
    }

    var body: some View {
        TimelineView(.animation(paused: !playing)) { context in
            frame(at: playing ? context.date.timeIntervalSince(started) : .infinity)
        }
        .background(Theme.Color.appSurface)
        .onAppear { started = .now }
        .task(id: playing) {
            guard playing else { return }
            try? await Task.sleep(for: .seconds(story.duration))
            // Skip or dismissal cancels the wait.
            if !Task.isCancelled { finished = true }
        }
    }

    private func frame(at t: Double) -> some View {
        VStack(spacing: Spacing.s0) {
            header(bar: story.bar(at: t))
            ScrollView {
                VStack(spacing: Spacing.s0) {
                    BallotStackView(count: governments.count, story: playing ? story : nil, time: t)
                    captions(at: t)
                }
            }
            .scrollBounceBehavior(.basedOnSize)
            VStack(spacing: Spacing.s2) {
                BallotPrimaryButton(label: "Done", height: 50, fontSize: 16, action: onClose)
                    .accessibilityIdentifier("ballot.governments.done")
                Text(governments.sourceLine)
                    .font(Theme.Font.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s6)
            .padding(.bottom, Spacing.s6)
        }
    }

    private func header(bar: Double) -> some View {
        VStack(spacing: Spacing.s3) {
            Capsule()
                .fill(Theme.Color.appBorder)
                .overlay(alignment: .leading) {
                    Capsule()
                        .fill(Theme.Color.appText)
                        .scaleEffect(x: bar, anchor: .leading)
                }
                .clipShape(Capsule())
                .frame(height: 4)
            HStack {
                Text(address)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
                Spacer(minLength: Spacing.s2)
                Button(action: playing ? { finished = true } : onClose) {
                    Text(playing ? "Skip" : "Close")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary700)
                        .padding(.vertical, 10)
                        .padding(.leading, Spacing.s3)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("ballot.governments.close")
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
    }

    private func captions(at t: Double) -> some View {
        ZStack(alignment: .topLeading) {
            finishedCaption
                .opacity(story.presence(story.steps, at: t))
                .offset(y: story.captionOffset(story.steps, at: t))
            if playing {
                ForEach(0..<story.steps, id: \.self) { k in
                    stepCaption(k)
                        .opacity(story.presence(k, at: t))
                        .offset(y: story.captionOffset(k, at: t))
                        .accessibilityHidden(true)
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
    }

    private func stepCaption(_ k: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(Self.overline(k + 1, of: governments.count, minimum: governments.countIsMinimum))
                .textCase(.uppercase)
                .font(.system(size: 11, weight: .semibold))
                .kerning(0.77)
                .foregroundStyle(Theme.Color.home)
            Text(governments.items[k].name)
                .font(.system(size: 24, weight: .bold))
                .kerning(-0.36)
                .foregroundStyle(Theme.Color.appText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var finishedCaption: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Your address")
                .textCase(.uppercase)
                .font(.system(size: 11, weight: .semibold))
                .kerning(0.77)
                .foregroundStyle(Theme.Color.home)
            Text("You are standing in \(countText) governments.")
                .font(Self.titleFont)
                .kerning(-0.45)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text("\(governments.summary) \(governments.caveat)")
                .font(.system(size: 15))
                .lineSpacing(4)
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
