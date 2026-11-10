//
//  MomentsCameraScreen.swift
//  Pantopus
//
//  Board P1 drawn: the camera full screen under a soft shade at the top and
//  bottom, close / "pins at" / flash at the top, "Tap for a photo. Hold for
//  a video up to 30 seconds.", the library's newest photo, the shutter and
//  the camera switch, and Library · Camera · Text.
//

import Photos
import SwiftUI

struct MomentsCameraScreen: View {
    let model: MomentsComposerModel
    let onClose: () -> Void
    @State private var camera = MomentsCameraController()
    /// nil while starting; false where there's no camera or it isn't allowed.
    @State private var cameraReady: Bool?
    @State private var flash = false
    @State private var recording = false
    @State private var elapsed: Double = 0
    @State private var pressing = false
    @State private var holdTask: Task<Void, Never>?
    @State private var clock: Task<Void, Never>?
    @State private var newest: UIImage?
    @State private var capturing = false

    var body: some View {
        ZStack {
            Color.black
            if cameraReady == true {
                MomentsCameraPreview(session: camera.session)
            } else if cameraReady == false {
                unavailable
            }
            VStack(spacing: 0) {
                LinearGradient(colors: [Color.black.opacity(0.5), .clear], startPoint: .top, endPoint: .bottom).frame(height: 170)
                Spacer(minLength: 0)
                LinearGradient(colors: [.clear, Color.black.opacity(0.6)], startPoint: .top, endPoint: .bottom).frame(height: 300)
            }
            .allowsHitTesting(false)
            VStack(spacing: 0) {
                MomentsComposerTopBar(place: model.placeChip, onClose: onClose) { flashButton }
                Spacer(minLength: 0)
                if let error = model.error {
                    Text(error)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, Spacing.s4)
                        .padding(.vertical, Spacing.s2)
                        .background(Capsule().fill(Theme.Color.errorSolid.opacity(0.9)))
                        .padding(.bottom, Spacing.s3)
                }
                Text(recording ? timeLabel : "Tap for a photo. Hold for a video up to 30 seconds.")
                    .font(.system(size: recording ? 16 : 14, weight: recording ? .bold : .medium))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.6), radius: 1.5, x: 0, y: 1)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.s6)
                    .padding(.bottom, 41)
                controls
                    .padding(.bottom, 21)
                MomentsModeTabs(model: model)
                    .opacity(recording ? 0 : 1)
            }
        }
        .ignoresSafeArea(edges: [.horizontal])
        .task {
            camera.onVideo = { url in
                if recording { UIImpactFeedbackGenerator(style: .medium).impactOccurred() }
                recording = false
                clock?.cancel()
                guard let url else { return }
                Task { await model.use(video: url) }
            }
            cameraReady = await camera.start()
            newest = await MomentsLibraryLoader.newestThumbnail()
        }
        .onDisappear {
            camera.stop()
            clock?.cancel()
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.camera")
    }

    private var timeLabel: String {
        let seconds = Int(elapsed)
        return String(format: "0:%02d", min(seconds, 30))
    }

    private var flashButton: some View {
        Button { flash.toggle() } label: {
            Icon(flash ? .zap : .zapOff, size: 24, color: .white)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(cameraReady == true ? 1 : 0.4)
        .disabled(cameraReady != true)
        .accessibilityLabel(flash ? "Flash on" : "Flash off")
        .accessibilityIdentifier("moments.camera.flash")
    }

    private var controls: some View {
        HStack {
            Button { model.mode = .library } label: {
                Group {
                    if let newest {
                        Image(uiImage: newest).resizable().scaledToFill()
                    } else {
                        Icon(.image, size: 20, color: .white)
                    }
                }
                .frame(width: 42, height: 42)
                .background(Color(white: 0.07))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.white, lineWidth: 2).padding(-2))
                .frame(width: 46, height: 46)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Choose from your library")
            .accessibilityIdentifier("moments.camera.library")
            .frame(width: 86)
            Spacer(minLength: 0)
            shutter
            Spacer(minLength: 0)
            Button { camera.switchCamera() } label: {
                Icon(.switchCamera, size: 22, color: .white)
                    .frame(width: 48, height: 48)
                    .background(Circle().fill(Color.black.opacity(0.42)))
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .opacity(cameraReady == true ? 1 : 0.4)
            .disabled(cameraReady != true || recording)
            .accessibilityLabel("Switch camera")
            .accessibilityIdentifier("moments.camera.switch")
            .frame(width: 86)
        }
        .padding(.horizontal, Spacing.s1)
    }

    /// Tap for a photo; hold for a video, which stops on letting go or at 30 seconds.
    private var shutter: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(recording ? 0.35 : 1), lineWidth: 5)
            if recording {
                Circle()
                    .trim(from: 0, to: min(elapsed / MomentsMediaExport.maxVideoSeconds, 1))
                    .stroke(Theme.Color.errorSolid, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            Circle()
                .fill(recording ? Theme.Color.errorSolid : Color.white)
                .frame(width: recording ? 34 : (pressing ? 56 : 62), height: recording ? 34 : (pressing ? 56 : 62))
                .animation(.easeOut(duration: 0.15), value: recording)
        }
        .frame(width: 80, height: 80)
        .opacity(cameraReady == true ? 1 : 0.4)
        .contentShape(Circle())
        .gesture(shutterGesture)
        .accessibilityElement()
        .accessibilityLabel("Take a photo, or hold for video")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { photo() }
        .accessibilityIdentifier("moments.camera.shutter")
    }

    private var shutterGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { _ in
                guard !pressing, cameraReady == true, !capturing else { return }
                pressing = true
                holdTask = Task {
                    try? await Task.sleep(for: .milliseconds(300))
                    guard !Task.isCancelled, pressing else { return }
                    startVideo()
                }
            }
            .onEnded { _ in
                guard pressing else { return }
                pressing = false
                holdTask?.cancel()
                if recording {
                    camera.stopVideo()
                } else {
                    photo()
                }
            }
    }

    private func photo() {
        guard !capturing else { return }
        capturing = true
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        Task {
            let image = await camera.takePhoto(flash: flash)
            capturing = false
            if let image { model.use(photo: image) }
        }
    }

    private func startVideo() {
        recording = true
        elapsed = 0
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        camera.startVideo(flash: flash)
        let started = Date()
        clock = Task {
            while !Task.isCancelled, recording {
                try? await Task.sleep(for: .milliseconds(100))
                elapsed = Date().timeIntervalSince(started)
            }
        }
    }

    /// The simulator, or the camera not allowed: say so; the library and text still work.
    private var unavailable: some View {
        VStack(spacing: Spacing.s3) {
            Icon(.camera, size: 34, color: Color.white.opacity(0.8))
            Text(MomentsCameraController.hasCamera ? "Allow the camera in Settings to take a Moment." : "There's no camera here.")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
            Text("You can post from your library or write a text card.")
                .font(.system(size: 14))
                .foregroundStyle(Color.white.opacity(0.75))
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, Spacing.s8)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("moments.camera.unavailable")
    }
}
