//
//  MomentsStudioStage.swift
//  Pantopus
//
//  The Studio after a shot (board B2, "Pulse, reinvented" phase 0 step 2):
//  the picture fills the screen and nothing covers it. The X at the top left
//  goes back to the camera (today's Retake), the tools sit on a rail at the
//  right, the caption is written on the picture, and one bar at the bottom
//  holds who sees it, a pill with how long it shows and where, and Post. The
//  pill opens a drawer with every row of today's Post sheet
//  (`MomentsStudioDrawer`), and Stamps and Play opens the tray of stamps
//  Pantopus checked (`MomentsStudioTray`), placed on the picture as objects
//  (`MomentsStudioStamps`). It posts through the composer's model, exactly as
//  today's Post sheet does, with the stamps' places.
//

import AVFoundation
import CoreLocation
import SwiftUI

struct MomentsStudioStage: View {
    let model: MomentsComposerModel
    let onPosted: () -> Void
    @State private var showsDrawer = false
    @FocusState private var writing: Bool
    /// This account was told once why a Moment at home shows only its area (`MomentsStudioBar`).
    @AppStorage private var homeAreaExplained: Bool
    @State private var explainedNow = false
    /// The made-up name screen, when "Made-up name" is picked before there is one.
    @State private var showsNameScreen = false
    /// `GET /api/pen-names/check` at the pin, while the made-up name is picked: a refusal or a warning.
    @State private var madeUpCheck: PenNameCheckResponse?
    /// The stamps' values for this spot and the one picked on the picture (step 3).
    @State private var stamps = MomentsStudioStamps()
    @State private var showsTray = false
    /// Illuminate's sheet (phase 2: dots on things in the picture).
    @State private var showsIlluminate = false
    /// Blur before posting (phase 2): its sheet, and drawing boxes by hand on the picture.
    @State private var showsBlur = false
    @State private var blurByHand = false
    /// Sound (phase 2): Voice Spark or place sound.
    @State private var showsSound = false
    /// Loop (phase 0 step 5): a short piece of the video, over and over.
    @State private var showsLoop = false

    init(model: MomentsComposerModel, onPosted: @escaping () -> Void) {
        self.model = model
        self.onPosted = onPosted
        var account = ""
        if case let .signedIn(user) = AuthManager.shared.state { account = user.id }
        _homeAreaExplained = AppStorage(wrappedValue: false, "pantopus.studio.homeAreaExplained.\(account)")
    }

    /// The line shows the first time only: from then on (this Studio included) the pill's "Area" says it.
    private var homeAreaFirstTime: Bool {
        MomentsStudioBar.showsHomeArea(model) && (!homeAreaExplained || explainedNow)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top) {
                closeButton
                Spacer(minLength: Spacing.s2)
                MomentsStudioRail(
                    model: model,
                    openTray: openTray,
                    openIlluminate: openIlluminate,
                    openBlur: openBlur,
                    openLoop: openLoop,
                    openSound: openSound
                )
                // Drawing blur boxes by hand: the rail steps aside for the bar with Done.
                .opacity(blurByHand ? 0 : 1)
                .allowsHitTesting(!blurByHand)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            Spacer(minLength: Spacing.s4)
            if model.draft != .text {
                // "@" in the caption offers the author's connections (CONTRACT 7h, `MomentsStudioMentions`).
                if let query = model.typingMention {
                    MomentsStudioMentionPicker(model: model, query: query)
                        .padding(.horizontal, Spacing.s4)
                        .padding(.bottom, Spacing.s2)
                }
                caption
                    .padding(.horizontal, Spacing.s4)
                    .padding(.bottom, Spacing.s3)
            }
            // "+ Ask / Kind" (phase 1, CONTRACT 6d): the picture or the words become one of today's Pulse posts.
            MomentsStudioKindRow(model: model)
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s3)
            notes
            // Something to blur was found on the photo (phase 2): one tap opens the Blur sheet.
            MomentsStudioBlurOffer(model: model, open: openBlur)
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s3)
            // Illuminate's suggestion (phase 2, CONTRACT 7i): one chip, worked out on the phone.
            MomentsStudioSuggestChip(model: model, openDrawer: openDrawer, openTray: openTray)
            if model.studioGuess, model.offersGuess {
                MomentsStudioGuessNote()
                    .padding(.horizontal, Spacing.s4)
                    .padding(.bottom, Spacing.s3)
            }
            if model.postsUnderMadeUpName, let penName = PenNameStore.shared.penName {
                MomentsStudioPostingAs(penName: penName)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.bottom, Spacing.s3)
            }
            MomentsStudioBar(
                model: model,
                explainsHomeArea: homeAreaFirstTime,
                needsMadeUpName: { showsNameScreen = true },
                blocksPost: model.postsUnderMadeUpName && madeUpCheck?.allowed == false,
                onPosted: onPosted,
                openDrawer: openDrawer
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Behind the screen, never part of its layout: a photo that fills the screen is larger than the screen.
        .background {
            ZStack {
                // The picture fills the screen centred, exactly as the viewer shows it to readers: held in a frame the
                // screen's size, so a photo wider than the screen never widens the layers over it (they place stamps,
                // items and dots by the same centred fill).
                Color.clear.overlay { MomentsStudioPicture(model: model) }
                    .overlay { legibility }
                    .clipped()
                ZStack {
                    TogetherStudioGhost(model: model) // Phase 3 (CONTRACT 8): a Retake's first picture to line up with.
                    // Cutouts (step 4): a long press lifts one; under the stamps.
                    MomentsStudioCutoutLayer(model: model)
                    // The stamps sit on the picture, under the X, the tools, the caption and the bar.
                    MomentsStudioStampLayer(model: model, stamps: stamps, picture: stampPicture)
                    // Playable items (phase 2), over the stamps.
                    MomentsStudioPlayLayer(model: model, picture: stampPicture)
                    // Illuminate's dots (phase 2), over the stamps.
                    MomentsStudioDotLayer(model: model, picture: stampPicture, open: openIlluminate)
                    // Blur before posting (phase 2): the spots found, and boxes drawn by hand.
                    if showsBlur || blurByHand {
                        MomentsStudioBlurLayer(model: model, picture: stampPicture, byHand: blurByHand) {
                            blurByHand = false
                            showsBlur = true
                        }
                    }
                }
                // See the picture first (phase 5 A): over a whole photo, in the frame it's drawn in.
                .modifier(MomentsStudioWholeFrame(model: model))
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showsDrawer) {
            MomentsStudioDrawer(model: model) { showsDrawer = false }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground { Theme.Color.appSurface.environment(\.colorScheme, .dark) }
                .environment(\.colorScheme, .dark)
        }
        .sheet(isPresented: $showsIlluminate) {
            MomentsStudioIlluminate(model: model) { showsIlluminate = false }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground { Theme.Color.appSurface.environment(\.colorScheme, .dark) }
                .environment(\.colorScheme, .dark)
        }
        .sheet(isPresented: $showsSound) {
            MomentsStudioSoundSheet(model: model) { showsSound = false }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground { Theme.Color.appSurface.environment(\.colorScheme, .dark) }
                .environment(\.colorScheme, .dark)
        }
        .studioLoopSheet(model: model, isPresented: $showsLoop)
        .sheet(isPresented: $showsBlur) {
            MomentsStudioBlurSheet(model: model) {
                showsBlur = false
                blurByHand = true
            } onDone: {
                showsBlur = false
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .presentationBackground { Theme.Color.appSurface.environment(\.colorScheme, .dark) }
            .environment(\.colorScheme, .dark)
        }
        // A video's size, read as soon as it's in the Studio: its dots, stamps and items sit on the frame readers see.
        .studioReadsVideoSize(model)
        // The photo is looked at for what to blur as soon as it's in the Studio, on the phone itself.
        .task(id: model.blurKey) { await model.findBlurSpots() }
        .sheet(isPresented: $showsTray) {
            MomentsStudioTray(model: model, stamps: stamps) { showsTray = false }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground { Theme.Color.appSurface.environment(\.colorScheme, .dark) }
                .environment(\.colorScheme, .dark)
        }
        // A new spot (a picked place moves no pin; another photo's own place does): the tray reads it again.
        .task(id: StampSpotKey(pin: model.basePin)) {
            if model.basePin != nil { await stamps.read(model: model) }
        }
        .sheet(isPresented: $showsNameScreen) {
            PenNameSetupView { _ in model.pickStudioAudience(.madeUp) }
        }
        // Whether the made-up name may be offered (once per app run), and what the pin's place says about it.
        .task { await PenNameStore.shared.load() }
        .task(id: MadeUpCheckKey(on: model.postsUnderMadeUpName, pin: model.pin)) { await checkMadeUpPlace() }
        // Shown once: kept for this screen, and remembered for the next.
        .onChange(of: MomentsStudioBar.showsHomeArea(model), initial: true) { _, shows in
            guard shows, !homeAreaExplained else { return }
            explainedNow = true
            homeAreaExplained = true
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.studio")
    }

    private func openSound() {
        writing = false
        Keyboard.close()
        showsSound = true
    }

    private func openLoop() {
        writing = false
        Keyboard.close()
        showsLoop = true
    }

    private func openBlur() {
        writing = false
        Keyboard.close()
        showsBlur = true
    }

    private func openIlluminate() {
        writing = false
        Keyboard.close()
        showsIlluminate = true
    }

    private func openTray() {
        writing = false
        Keyboard.close()
        showsTray = true
    }

    private var stampPicture: CGSize? {
        model.studioStampPicture
    }

    private func openDrawer() {
        writing = false
        Keyboard.close()
        showsDrawer = true
    }

    /// Back to the camera (or to the text card), as today's Retake: it asks first when marks would be lost.
    private var closeButton: some View {
        Button { model.askRetake() } label: {
            Icon(.x, size: 22, strokeWidth: 2.4, color: .white)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Color.black.opacity(0.42)))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        // Off from the request that makes the Moment until that Post ends; before that it cancels the Post.
        .disabled(model.isSending)
        .opacity(model.isSending ? 0.5 : 1)
        .accessibilityLabel(model.draft == .text ? "Edit the card" : "Retake")
        .accessibilityIdentifier("moments.studio.close")
    }

    /// The caption, written on the picture. Return finishes it.
    private var caption: some View {
        @Bindable var model = model
        // As a post, the words are the post's (up to 500 characters) and the prompt says what to write.
        return TextField(
            "",
            text: model.studioPostKind == nil ? $model.caption : model.studioPostWordsBinding,
            prompt: Text(model.studioPostKind.map(\.wordsPrompt) ?? "Add a caption").foregroundColor(Color.white.opacity(0.75)),
            axis: .vertical
        )
        .font(.system(size: 22, weight: .bold))
        .foregroundStyle(.white)
        .tint(.white)
        .lineLimit(1...4)
        .submitLabel(.done)
        .focused($writing)
        .shadow(color: .black.opacity(0.45), radius: 6, x: 0, y: 1)
        .onChange(of: model.caption) { _, typed in
            // A caption is one paragraph: Return closes the keyboard instead of starting a new line.
            guard typed.contains("\n") else { return }
            model.caption = typed.replacingOccurrences(of: "\n", with: "")
            writing = false
        }
        .onChange(of: model.studioPost.words) { _, typed in
            guard typed.contains("\n") else { return }
            model.studioPost.words = typed.replacingOccurrences(of: "\n", with: "")
            writing = false
        }
        // A kind no longer offered (a made-up name picked for a photo, say): it is a Moment again, with its words.
        .onChange(of: model.studioPostKind == nil) { _, gone in
            if gone { model.clearStudioKind() }
        }
        .accessibilityLabel(model.studioPostKind == nil ? "Caption" : "What it's about")
        .accessibilityIdentifier("moments.studio.caption")
    }

    /// What can stop Post, or what the person should know before it, right above the bar.
    @ViewBuilder private var notes: some View {
        let lines = noteLines
        if !lines.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                ForEach(lines, id: \.self) { line in
                    Text(line)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.black.opacity(0.55)))
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s3)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("moments.studio.note")
        }
    }

    private var noteLines: [String] {
        var lines: [String] = []
        if let error = model.error { lines.append(error) }
        if model.pin == nil, model.locating == .unavailable, !model.noLocationOn {
            lines.append("Turn on location for Pantopus in Settings to post a Moment.")
        }
        if model.showsHomeNotice, !model.postsUnderMadeUpName { lines.append("This is your home. People will see the pin on it.") }
        if model.parts > 1 { lines.append("This video posts as \(model.parts) Moments, one after another.") }
        if model.postsUnderMadeUpName, let check = madeUpCheck {
            if !check.allowed, let refusal = check.refusal {
                lines.append(refusal.message)
            } else if let warning = check.warning {
                lines.append(warning)
            }
        }
        return lines
    }

    /// The pin's place for the made-up name: too few verified homes refuses it, few warns.
    private func checkMadeUpPlace() async {
        guard model.postsUnderMadeUpName, let pin = model.pin else {
            madeUpCheck = nil
            return
        }
        madeUpCheck = try? await APIClient.shared.request(
            PenNamesEndpoints.check(latitude: pin.latitude, longitude: pin.longitude),
            as: PenNameCheckResponse.self
        )
    }

    /// A little shade at the top and the bottom, so the X, the tools and the caption read on any picture.
    private var legibility: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: [Color.black.opacity(0.38), .clear], startPoint: .top, endPoint: .bottom)
                .frame(height: 160)
            Spacer(minLength: 0)
            LinearGradient(colors: [.clear, Color.black.opacity(0.5)], startPoint: .top, endPoint: .bottom)
                .frame(height: 300)
        }
        .allowsHitTesting(false)
    }
}

/// The spot the tray's stamps are read for.
private struct StampSpotKey: Equatable {
    let latitude: Double?
    let longitude: Double?

    init(pin: CLLocationCoordinate2D?) {
        latitude = pin?.latitude
        longitude = pin?.longitude
    }
}

/// What the made-up name's place check is read again for.
private struct MadeUpCheckKey: Equatable {
    let on: Bool
    let latitude: Double?
    let longitude: Double?

    init(on: Bool, pin: CLLocationCoordinate2D?) {
        self.on = on
        latitude = pin?.latitude
        longitude = pin?.longitude
    }
}

/// The picture as it will post, filling the screen: the photo or video with its marks (or placed, after Resize), or
/// the text card's colors and words.
struct MomentsStudioPicture: View {
    let model: MomentsComposerModel

    var body: some View {
        switch model.draft {
        case let .photo(image) where model.studioPair != nil:
            // Before and after: one half over the other with the curtain, as the new viewer shows it.
            MomentBeforeAfterView(
                picture: image,
                before: model.studioPair?.beforeLabel ?? "",
                after: model.studioPair?.afterLabel ?? ""
            )
            .accessibilityIdentifier("moments.studio.beforeAfter.picture")
        case .photo where model.studioWholeOffered:
            MomentsStudioWholeCanvas(model: model) // See the picture first (phase 5 A): whole, on its own colours.
        case let .photo(image):
            MomentsMarkedPhoto(
                image: image,
                marks: model.marking.marks,
                placement: model.marking.placement,
                backdrop: model.marking.backdrop
            )
            .accessibilityLabel("The photo you're posting")
        case .video where model.studioWholeOffered:
            MomentsStudioWholeCanvas(model: model) // See the picture first (phase 5 A): a video whole too.
        case let .video(url):
            video(url: url)
                .accessibilityLabel("The video you're posting")
        case .text:
            let colors = MomentsPalette.card(model.background)
            LinearGradient(colors: [colors.top, colors.bottom], startPoint: UnitPoint(x: 0.33, y: 0), endPoint: UnitPoint(x: 0.67, y: 1))
                .overlay {
                    Text(model.text)
                        .font(.system(size: 26, weight: .semibold))
                        .lineSpacing(7)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 36)
                }
        case nil:
            Color.black
        }
    }

    @ViewBuilder
    private func video(url: URL) -> some View {
        if let placement = model.marking.placement, let picture = model.marking.video?.size {
            MomentsPlacedPicture(
                aspect: picture.width / max(picture.height, 1),
                placement: placement,
                backdrop: model.marking.backdrop,
                marks: model.marking.marks
            ) { MomentsStudioLoop(url: url).id(url) }
        } else {
            // The next of several picked together is another file: another player.
            MomentsStudioLoop(url: url)
                .id(url)
                .overlay { MomentMarksOverVideo(marks: model.marking.marks, picture: model.marking.video?.size) }
        }
    }
}

/// The video, muted, looping, for as long as it shows.
struct MomentsStudioLoop: View {
    let url: URL
    @State private var player: AVPlayer?

    var body: some View {
        MomentsVideoSurface(player: player ?? AVPlayer())
            .onAppear {
                if player == nil {
                    let looping = AVPlayer(url: url)
                    looping.isMuted = true
                    player = looping
                }
                player?.play()
            }
            .onDisappear { player?.pause() }
            .onReceive(NotificationCenter.default.publisher(for: AVPlayerItem.didPlayToEndTimeNotification)) { note in
                guard let item = note.object as? AVPlayerItem, item == player?.currentItem else { return }
                player?.seek(to: .zero)
                player?.play()
            }
    }
}
