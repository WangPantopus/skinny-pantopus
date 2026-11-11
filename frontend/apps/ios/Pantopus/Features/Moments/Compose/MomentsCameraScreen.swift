//
//  MomentsCameraScreen.swift
//  Pantopus
//
//  Board P1 drawn: the camera full screen under a soft shade at the top and
//  bottom, close / "pins at" / flash at the top, "Tap for a photo. Hold for
//  a video up to 30 seconds.", the library's newest photo, the shutter and
//  the camera switch, and Library · Camera · Text. On the iPhone Duo it takes
//  the Duo's layouts (`MomentsCameraScreen+Duo.swift`). The camera and what
//  it's doing live in the composer's model (`MomentsCameraModel`), so a fold
//  that builds this screen again keeps a recording going.
//

import Photos
import SwiftUI

struct MomentsCameraScreen: View {
    let model: MomentsComposerModel
    let onClose: () -> Void
    @Environment(\.momentsDuoScreen) var duo
    @State var pressing = false
    @State var holdTask: Task<Void, Never>?

    var camera: MomentsCameraModel {
        model.camera
    }

    var body: some View {
        Group {
            switch duo.pose {
            case .closed, .wide:
                duoLayout
            case .phone, .upright, .table:
                phoneLayout
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.camera")
    }

    private var phoneLayout: some View {
        ZStack {
            Color.black
            preview
            VStack(spacing: 0) {
                LinearGradient(colors: [Color.black.opacity(0.5), .clear], startPoint: .top, endPoint: .bottom).frame(height: 170)
                Spacer(minLength: 0)
                LinearGradient(colors: [.clear, Color.black.opacity(0.6)], startPoint: .top, endPoint: .bottom).frame(height: 300)
            }
            .allowsHitTesting(false)
            VStack(spacing: 0) {
                MomentsComposerTopBar(place: model.placeChip, onClose: onClose) { flashButton }
                Spacer(minLength: 0)
                errorPill
                hint
                    .padding(.horizontal, Spacing.s6)
                    .padding(.bottom, 41)
                controls
                    .padding(.bottom, 21)
                MomentsModeTabs(model: model)
                    .opacity(camera.recording ? 0 : 1)
            }
        }
        .ignoresSafeArea(edges: [.horizontal])
    }

    /// What the camera sees, or why it can't show.
    @ViewBuilder var preview: some View {
        if camera.ready == true {
            MomentsCameraPreview(session: camera.controller.session)
        } else if camera.ready == false {
            unavailable
        }
    }

    /// What stopped a photo or video, over the bottom of the picture.
    @ViewBuilder var errorPill: some View {
        if let error = model.error {
            Text(error)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
                .background(Capsule().fill(Theme.Color.errorSolid.opacity(0.9)))
                .padding(.bottom, Spacing.s3)
        }
    }

    /// The hint, or how long the video has been recording.
    var hint: some View {
        Text(camera.recording ? camera.timeLabel : "Tap for a photo. Hold for a video up to 30 seconds.")
            .font(.system(size: camera.recording ? 16 : 14, weight: camera.recording ? .bold : .medium))
            .monospacedDigit()
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.6), radius: 1.5, x: 0, y: 1)
            .multilineTextAlignment(.center)
    }

    private var flashButton: some View {
        Button { camera.flash.toggle() } label: {
            Icon(camera.flash ? .zap : .zapOff, size: 24, color: .white)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(camera.ready == true ? 1 : 0.4)
        .disabled(camera.ready != true)
        .accessibilityLabel(camera.flash ? "Flash on" : "Flash off")
        .accessibilityIdentifier("moments.camera.flash")
    }

    private var controls: some View {
        HStack {
            libraryButton(size: 46)
                .frame(width: 86)
            Spacer(minLength: 0)
            shutter(size: 80)
            Spacer(minLength: 0)
            switchButton(size: 48, fill: Color.black.opacity(0.42))
                .frame(width: 86)
        }
        .padding(.horizontal, Spacing.s1)
    }

    /// The library's newest photo: opens the library.
    func libraryButton(size: CGFloat) -> some View {
        let inner = size - 4
        return Button { model.mode = .library } label: {
            Group {
                if let newest = camera.newest {
                    Image(uiImage: newest).resizable().scaledToFill()
                } else {
                    Icon(.image, size: 20, color: .white)
                }
            }
            .frame(width: inner, height: inner)
            .background(Color(white: 0.07))
            .clipShape(RoundedRectangle(cornerRadius: size == 46 ? 10 : 11, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: size == 46 ? 12 : 13, style: .continuous).stroke(Color.white, lineWidth: 2).padding(-2))
            .frame(width: size, height: size)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Choose from your library")
        .accessibilityIdentifier("moments.camera.library")
    }

    /// Front or back.
    func switchButton(size: CGFloat, fill: Color) -> some View {
        Button { camera.controller.switchCamera() } label: {
            Icon(.switchCamera, size: 22, color: .white)
                .frame(width: size, height: size)
                .background(Circle().fill(fill))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .opacity(camera.ready == true ? 1 : 0.4)
        .disabled(camera.ready != true || camera.recording)
        .accessibilityLabel("Switch camera")
        .accessibilityIdentifier("moments.camera.switch")
    }

    /// Tap for a photo; hold for a video, which stops on letting go or at 30 seconds. 80 pt on the phone, 96 beside the
    /// open Duo's picture (board O7).
    func shutter(size: CGFloat) -> some View {
        let large = size > 80
        let whole: CGFloat = large ? 76 : 62
        let pressed: CGFloat = large ? 70 : 56
        let stop: CGFloat = large ? 40 : 34
        return ZStack {
            Circle()
                .stroke(Color.white.opacity(camera.recording ? 0.35 : 1), lineWidth: 5)
            if camera.recording {
                Circle()
                    .trim(from: 0, to: min(camera.elapsed / MomentsMediaExport.maxVideoSeconds, 1))
                    .stroke(Theme.Color.errorSolid, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            Circle()
                .fill(camera.recording ? Theme.Color.errorSolid : Color.white)
                .frame(
                    width: camera.recording ? stop : (pressing ? pressed : whole),
                    height: camera.recording ? stop : (pressing ? pressed : whole)
                )
                .animation(.easeOut(duration: 0.15), value: camera.recording)
        }
        .frame(width: size, height: size)
        .opacity(camera.ready == true ? 1 : 0.4)
        .contentShape(Circle())
        .gesture(shutterGesture)
        .accessibilityElement()
        .accessibilityLabel("Take a photo, or hold for video")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { camera.takePhoto() }
        .accessibilityIdentifier("moments.camera.shutter")
    }

    private var shutterGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { _ in
                guard !pressing, camera.ready == true, !camera.capturing else { return }
                pressing = true
                holdTask = Task {
                    try? await Task.sleep(for: .milliseconds(300))
                    guard !Task.isCancelled, pressing else { return }
                    camera.startVideo()
                }
            }
            .onEnded { _ in
                guard pressing else { return }
                pressing = false
                holdTask?.cancel()
                if camera.recording {
                    camera.stopVideo()
                } else {
                    camera.takePhoto()
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
