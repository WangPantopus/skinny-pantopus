//
//  MomentsStudioBar.swift
//  Pantopus
//
//  The Studio's tool rail and its one bar at the bottom (board B2).
//
//  The rail, at the right: each tool is its word beside a round button. Phase
//  0 step 2 carries today's tools, Text, Draw and Resize, which open today's
//  marks editor (`MomentsMarksEditor`) in that tool; step 3 adds Stamps and
//  Play (`MomentsStudioTray`). The board's other tools arrive with the steps
//  that build them.
//
//  The bar: who sees it (Nearby or Friends, today's "Everyone nearby" and "My
//  connections"), a pill reading how long it shows and where ("Fades in 24
//  hours / Lacamas Lake") that opens the drawer, and Post.
//

import SwiftUI

struct MomentsStudioRail: View {
    let model: MomentsComposerModel
    /// "Stamps and Play" (step 3): the tray, for a Moment with a place (every stamp reads the spot).
    var openTray: (() -> Void)?
    /// Illuminate (phase 2): dots on things in the picture (`MomentsStudioIlluminate`).
    var openIlluminate: (() -> Void)?
    /// Blur before posting (phase 2, `MomentsStudioBlurSheet`).
    var openBlur: (() -> Void)?
    /// Loop (phase 0 step 5, `MomentsStudioLoopSheet`): a short piece of the video, over and over.
    var openLoop: (() -> Void)?
    /// Sound (phase 2): Voice Spark or place sound (`MomentsStudioSoundSheet`).
    var openSound: (() -> Void)?

    var body: some View {
        VStack(alignment: .trailing, spacing: Spacing.s3) {
            if model.offersMarks, model.studioPair == nil {
                tool("Text", id: "moments.studio.rail.text") {
                    // "Aa" is lettering, not an icon (board B2).
                    Text("Aa").font(.system(size: 17, weight: .bold)).kerning(-0.5).foregroundStyle(.white)
                } action: { model.openStudioMarks(.text) }
            }
            if let openTray, !model.noLocationOn {
                tool("Stamps and Play", id: "moments.studio.rail.stamps") {
                    Icon(.stamp, size: 20, strokeWidth: 2.2, color: .white)
                } action: { openTray() }
            }
            if let openIlluminate, model.offersDots {
                tool("Illuminate", id: "moments.studio.rail.illuminate") {
                    Icon(.sparkles, size: 20, strokeWidth: 2.2, color: .white)
                } action: { openIlluminate() }
            }
            if model.offersMarks, model.studioPair == nil {
                tool("Draw", id: "moments.studio.rail.draw") {
                    Icon(.pencil, size: 20, strokeWidth: 2.2, color: .white)
                } action: { model.openStudioMarks(.draw) }
            }
            if let openSound, model.offersSound {
                tool("Sound", id: "moments.studio.rail.sound") {
                    Icon(.mic, size: 19, strokeWidth: 2.2, color: .white)
                } action: { openSound() }
            }
            if let openLoop, model.offersLoop {
                tool(model.studioLoop == nil ? "Loop" : "Loop on", id: "moments.studio.rail.loop") {
                    Icon(.repeat2, size: 19, strokeWidth: 2.2, color: .white)
                } action: { openLoop() }
            }
            if model.studioMotionClip != nil {
                // A Live Photo (phase 5 C): the moving-photo mark; on, its motion goes up with it.
                tool(model.studioKeepsMotion ? "Motion on" : "Motion off", id: "moments.studio.rail.motion") {
                    Icon(.circleDot, size: 19, strokeWidth: 2.2, color: .white)
                        .opacity(model.studioKeepsMotion ? 1 : 0.5)
                } action: { model.toggleStudioMotion() }
            }
            if let openBlur, model.offersBlur {
                tool("Blur", id: "moments.studio.rail.blur") {
                    Icon(.eyeOff, size: 19, strokeWidth: 2.2, color: .white)
                } action: { openBlur() }
            }
            if model.studioWholeOffered {
                // See the picture first (phase 5 A): the picture is adjusted on this screen; Fill, then Fit, and Reset.
                let filled = model.studioWholeFilled
                tool(filled ? "Fit" : "Fill", id: "moments.studio.rail.fill") {
                    Icon(filled ? .image : .maximize, size: 19, strokeWidth: 2.2, color: .white)
                } action: { filled ? model.studioWholeReset() : model.studioWholeFill() }
                if model.studioWholeMoved {
                    tool("Reset", id: "moments.studio.rail.reset") {
                        Icon(.rotateCcw, size: 19, strokeWidth: 2.2, color: .white)
                    } action: { model.studioWholeReset() }
                }
            } else if model.offersResize, model.studioPair == nil {
                tool("Resize", id: "moments.studio.rail.resize") {
                    Icon(.maximize, size: 19, strokeWidth: 2.2, color: .white)
                } action: { model.openMarks(.resize) }
            }
        }
        // Off while a Post is going (it would swap the file being sent).
        .disabled(model.isPosting)
        .opacity(model.isPosting ? 0.5 : 1)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Tools")
    }

    private func tool(
        _ name: String,
        id: String,
        @ViewBuilder glyph: () -> some View,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Text(name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.55), radius: 4, x: 0, y: 1)
                // One step smaller to the eye (PHASE-6 C), 44 pt to the finger.
                glyph()
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.black.opacity(0.42)))
                    .frame(width: 44, height: 44)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(name)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier(id)
    }
}

struct MomentsStudioBar: View {
    let model: MomentsComposerModel
    /// The first Moment made at home that shows only its area says why, once (`MomentsStudioStage`).
    var explainsHomeArea = false
    /// "Made-up name" picked before the person has one: the name screen opens (`MomentsStudioStage`).
    var needsMadeUpName: () -> Void = {}
    /// The pin's place refuses the made-up name (too few verified homes): Post waits, as in Pulse's composer.
    var blocksPost = false
    let onPosted: () -> Void
    let openDrawer: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            // The details are a sheet (PHASE-6 F3): its grabber, and the one summary line it opens from (PHASE-5 A4).
            Capsule()
                .fill(Color.white.opacity(0.35))
                .frame(width: 36, height: 5)
                .frame(maxWidth: .infinity)
                .accessibilityHidden(true)
            // Several picked together (PHASE-5 A5): the one on the screen ringed, the ones waiting after it.
            if model.studioShowsSeveral {
                MomentsStudioSeveralRow(model: model, onNoneLeft: onPosted)
            }
            HStack(spacing: Spacing.s2) {
                pill
                postButton
            }
            if explainsHomeArea {
                Text(SkyWords.homeTitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.white.opacity(0.75))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, Spacing.s1)
                    .accessibilityIdentifier("moments.studio.homeArea")
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s2)
        .background {
            UnevenRoundedRectangle(topLeadingRadius: 20, topTrailingRadius: 20, style: .continuous)
                .fill(Theme.Color.appSurface)
                .ignoresSafeArea(edges: .bottom)
        }
        // Dragged up from anywhere on the bar, the details open; a tap on the line does too. Down closes the sheet.
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 12).onEnded { value in
                guard !model.isPosting, value.translation.height < -24 || value.predictedEndTranslation.height < -90 else { return }
                openDrawer()
            }
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.studio.bar")
    }

    // MARK: How long, and where

    private var pill: some View {
        Button(action: openDrawer) {
            HStack(spacing: Spacing.s2) {
                Icon(.clock, size: 18, strokeWidth: 2.2, color: .white)
                Text(summary)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer(minLength: 0)
                Icon(.chevronUp, size: 14, strokeWidth: 2.4, color: Color.white.opacity(0.8))
            }
            .padding(.horizontal, Spacing.s3)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Capsule().fill(Color.white.opacity(0.08)))
            .overlay(Capsule().stroke(Color.white.opacity(0.22), lineWidth: 1))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(model.isPosting)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(summary)
        .accessibilityHint("Shows who sees it, where it pins, how long it shows, and when it shares")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("moments.studio.pill")
    }

    /// The one summary line (PHASE-5 A4): "Fallen Leaf Lake Park · 24 hours · Everyone nearby".
    var summary: String {
        [pillPlace, pillTitle, audienceWords].joined(separator: " · ")
    }

    private var audienceWords: String {
        switch model.studioAudience {
        case .nearby: "Everyone nearby"
        case .friends: "Friends"
        case .madeUp: PenNameStore.shared.penName.map { "As \($0.name)" } ?? "Made-up name"
        }
    }

    private var hoursWords: String {
        model.hours == 1 ? "1 hour" : "\(model.hours) hours"
    }

    /// "Fades in 24 hours", or with "Share later" picked, "Shares at 6:40 pm".
    private var pillTitle: String {
        // A post made from it (CONTRACT 6d): how long the kind stays.
        if let kind = model.studioPostKind {
            return kind.pillTitle(eventStart: model.studioPost.eventStart, eventEnd: model.studioPost.eventEnd)
        }
        if let sharesAt = model.sharesAt { return SkyWords.sharesAt(sharesAt) }
        return "Fades in \(hoursWords)"
    }

    /// Where it pins, as the Post sheet's place row says it, and "Area · Camas, WA" for one at home that shows only its
    /// area; with "Share later", how long it shows first.
    private var pillPlace: String {
        // Under a made-up name it floats over its area too, unless its author pinned it at a place ("At <place>").
        let place = Self.showsHomeArea(model) || model.madeUpFloats ? "Area · \(homeTown)" : model.placeLine
        // A post with no place goes to the author's connections.
        if model.studioPostKind != nil { return model.studioPostPlaced ? place : "Your connections" }
        return model.sharesAt == nil ? place : "\(hoursWords) · \(place)"
    }

    private var homeTown: String {
        model.sky?.area?.label ?? model.place?.areaLabel ?? model.place?.placeLabel ?? "this area"
    }

    /// Made at home, it shows only its area (under the Sky always; before it, with "Show the area instead").
    static func showsHomeArea(_ model: MomentsComposerModel) -> Bool {
        model.place?.atHome == true && model.floats && !model.noLocationOn
    }

    // MARK: Post

    private var postButton: some View {
        Button {
            Keyboard.close()
            // Cutouts become part of the picture before it goes up.
            model.drawInStudioCutouts()
            // A post (CONTRACT 6d): a detail it still needs opens the drawer at it, with the reason.
            if let blocker = model.studioKindBlocker {
                model.error = blocker.message
                if blocker.inDrawer { openDrawer() }
                return
            }
            Task {
                if model.studioPostKind != nil {
                    if await model.postStudioKind() { onPosted() }
                } else if await model.post() {
                    onPosted()
                } else if !model.studioStamps.isEmpty {
                    // Stamps are the Studio's own: refused, the switch may be off now (CONTRACT 1). Read it again; off,
                    // today's composer takes the draft (`MomentsComposerChoice`).
                    await PulseReinventedFlags.shared.recheck()
                }
            }
        } label: {
            ZStack {
                HStack(spacing: 6) {
                    Text(postWord)
                        .font(.system(size: 15, weight: .bold))
                    Icon(.arrowRight, size: 16, strokeWidth: 2.4, color: .white)
                }
                .foregroundStyle(.white)
                .opacity(model.isPosting ? 0 : 1)
                if model.isPosting { ProgressView().tint(.white) }
            }
            .padding(.horizontal, 18)
            .frame(minHeight: 44)
            .background(Capsule().fill(Theme.Color.primarySolid))
            .opacity(model.canPost && !blocksPost ? 1 : 0.5)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(!model.canPost || blocksPost)
        .accessibilityLabel(model.postLabel)
        .accessibilityIdentifier("moments.studio.post")
    }

    /// "Post", or "Post 2 of 3" while several picked together go one by one.
    private var postWord: String {
        model.pickedPosition.map { "Post \($0)" } ?? "Post"
    }
}

/// Who sees it, in the details sheet (PHASE-5 A4: the bar keeps one summary line): Nearby, Friends, and the made-up
/// name where it may be offered. Chips 28 pt high, 44 pt to the finger (PHASE-6 C).
struct MomentsStudioAudienceRow: View {
    let model: MomentsComposerModel
    /// "Made-up name" picked before the person has one: the name screen opens.
    let needsMadeUpName: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            audienceChip(.nearby, "Nearby", id: "moments.studio.audience.nearby")
            audienceChip(.friends, "Friends", id: "moments.studio.audience.friends")
            if model.offersMadeUpName || model.postsUnderMadeUpName {
                audienceChip(.madeUp, "Made-up name", id: "moments.studio.audience.madeUp")
            }
            Spacer(minLength: 0)
        }
    }

    private func audienceChip(_ value: MomentsStudioAudience, _ title: String, id: String) -> some View {
        // A Moment with no location goes only to connections: "Nearby" needs a place.
        let selected = model.studioAudience == value
        let usable = !model.noLocationOn || value == .friends
        return Button {
            if value == .madeUp, PenNameStore.shared.penName == nil {
                needsMadeUpName()
            } else {
                model.pickStudioAudience(value)
            }
        } label: {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(selected ? Theme.Color.appText : Color.white.opacity(usable ? 1 : 0.4))
                .padding(.horizontal, Spacing.s3)
                .frame(height: 28)
                .background(Capsule().fill(selected ? Color.white : Color.white.opacity(0.08)))
                .overlay(Capsule().stroke(Color.white.opacity(selected ? 0 : 0.22), lineWidth: 1))
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // The selected chip is white: its word is the light scheme's ink.
        .environment(\.colorScheme, selected ? .light : .dark)
        .disabled(!usable || model.isPosting)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier(id)
    }
}
