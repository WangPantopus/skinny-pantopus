//
//  MomentsStudioFrontBack.swift
//  Pantopus
//
//  "Pulse, reinvented", front and back together (DESIGN row 7): the back camera and the front camera in one shot,
//  the small picture inside the big one. It is a mode the person picks in the Studio's camera ("Front and back"),
//  never the default, and only while the switch is on and the phone can run two cameras at once
//  (`AVCaptureMultiCamSession.isMultiCamSupported`). Today's camera and its capture session are left exactly as they
//  are: they stop while this mode is open and start again when it closes, and the shot reaches the Studio as an
//  ordinary photo (`tookPhoto`), so nothing new is sent and a reader with the switch off sees the same picture.
//
//  A simulator has no camera: on simulator builds only, two stand-in pictures go through this same code (the small
//  picture inside the big one, swapping them, the Studio taking the result), so what runs on the phone is seen
//  running. The real two-camera capture needs a real iPhone.
//

import AVFoundation
import SwiftUI
import UIKit

enum MomentsFrontBack {
    /// This phone runs two cameras at once; a simulator build runs the stand-in.
    static var available: Bool {
        #if targetEnvironment(simulator)
        true
        #else
        AVCaptureMultiCamSession.isMultiCamSupported
        #endif
    }

    /// The small picture on the screen: 118 by 157 points, 16 from the left and 140 under the top of the safe area, so
    /// the viewer's name row and chips, over the top of every Moment, never cover it.
    static func smallFrame(safeTop: CGFloat) -> CGRect {
        CGRect(x: 16, y: safeTop + 140, width: 118, height: 157)
    }

    /// The picture exactly as the screen showed it: `big` cut to the screen's shape (centred, as the preview fills
    /// the screen), and `small` filling `inset` (in the screen's points) with rounded corners and a white edge. So the
    /// viewer, which fills the screen the same way, shows all of it, the small picture included.
    static func compose(big: UIImage, small: UIImage, screen: CGSize, inset: CGRect) -> UIImage {
        let crop = fill(big.size, in: screen)
        // The output keeps the big picture's own detail: as many pixels as the part of it that showed.
        let points = CGSize(width: screen.width * crop.scale, height: screen.height * crop.scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = big.scale
        format.opaque = true
        return UIGraphicsImageRenderer(size: points, format: format).image { _ in
            big.draw(in: CGRect(
                x: -crop.offset.x,
                y: -crop.offset.y,
                width: big.size.width,
                height: big.size.height
            ))
            let box = CGRect(
                x: inset.minX * crop.scale,
                y: inset.minY * crop.scale,
                width: inset.width * crop.scale,
                height: inset.height * crop.scale
            )
            let edge = 3 * crop.scale
            let radius = 14 * crop.scale
            UIColor.white.setFill()
            UIBezierPath(roundedRect: box.insetBy(dx: -edge / 2, dy: -edge / 2), cornerRadius: radius + edge / 2).fill()
            UIBezierPath(roundedRect: box.insetBy(dx: edge / 2, dy: edge / 2), cornerRadius: radius - edge / 2).addClip()
            let inner = fill(small.size, in: box.size)
            small.draw(in: CGRect(
                x: box.minX - inner.offset.x / inner.scale,
                y: box.minY - inner.offset.y / inner.scale,
                width: small.size.width / inner.scale,
                height: small.size.height / inner.scale
            ))
        }
    }

    /// How `picture` fills `frame` centred (aspect fill): `scale` is the picture's points per frame point, `offset`
    /// where the frame's corner falls in the picture.
    static func fill(_ picture: CGSize, in frame: CGSize) -> (scale: CGFloat, offset: CGPoint) {
        let scale = min(picture.width / max(frame.width, 1), picture.height / max(frame.height, 1))
        let shown = CGSize(width: frame.width * scale, height: frame.height * scale)
        return (scale, CGPoint(x: (picture.width - shown.width) / 2, y: (picture.height - shown.height) / 2))
    }
}

/// Both cameras at once (`AVCaptureMultiCamSession`), each with its own picture and preview. Made only when the
/// person opens the mode; today's `MomentsCameraController` is not touched.
final class MomentsFrontBackCamera: NSObject, @unchecked Sendable {
    let session = AVCaptureMultiCamSession()
    let backPreview: AVCaptureVideoPreviewLayer
    let frontPreview: AVCaptureVideoPreviewLayer
    private let queue = DispatchQueue(label: "app.pantopus.ios.moments.frontback")
    private var outputs: [AVCaptureDevice.Position: AVCapturePhotoOutput] = [:]
    private var configured: Bool?
    private var shots: [Shot] = []

    override init() {
        backPreview = AVCaptureVideoPreviewLayer(sessionWithNoConnection: session)
        frontPreview = AVCaptureVideoPreviewLayer(sessionWithNoConnection: session)
        backPreview.videoGravity = .resizeAspectFill
        frontPreview.videoGravity = .resizeAspectFill
        super.init()
    }

    /// Sets up both cameras and starts them; false where the phone can't (or the camera isn't allowed).
    func start() async -> Bool {
        guard AVCaptureMultiCamSession.isMultiCamSupported, await AVCaptureDevice.requestAccess(for: .video) else { return false }
        return await withCheckedContinuation { continuation in
            queue.async { [self] in
                if configured == nil { configured = configure() }
                if configured == true, !session.isRunning { session.startRunning() }
                continuation.resume(returning: configured == true)
            }
        }
    }

    func stop() {
        queue.async { [self] in
            if session.isRunning { session.stopRunning() }
        }
    }

    /// Both pictures, taken together; nil if either failed.
    func take() async -> (back: UIImage, front: UIImage)? {
        async let back = take(.back)
        async let front = take(.front)
        guard let back = await back, let front = await front else { return nil }
        return (back, front)
    }

    private func take(_ position: AVCaptureDevice.Position) async -> UIImage? {
        await withCheckedContinuation { continuation in
            queue.async { [self] in
                guard let output = outputs[position] else { return continuation.resume(returning: nil) }
                let shot = Shot()
                shot.done = { [weak self, weak shot] image in
                    continuation.resume(returning: image)
                    guard let self, let shot else { return }
                    queue.async { self.shots.removeAll { $0 === shot } }
                }
                shots.append(shot)
                output.capturePhoto(with: AVCapturePhotoSettings(), delegate: shot)
            }
        }
    }

    private func configure() -> Bool {
        session.beginConfiguration()
        defer { session.commitConfiguration() }
        for (position, preview) in [(AVCaptureDevice.Position.back, backPreview), (.front, frontPreview)] {
            guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
                  let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) else { return false }
            session.addInputWithNoConnections(input)
            guard let port = input.ports(for: .video, sourceDeviceType: device.deviceType, sourceDevicePosition: position).first
            else { return false }
            let output = AVCapturePhotoOutput()
            guard session.canAddOutput(output) else { return false }
            session.addOutputWithNoConnections(output)
            let taking = AVCaptureConnection(inputPorts: [port], output: output)
            guard session.canAddConnection(taking) else { return false }
            session.addConnection(taking)
            upright(taking, front: position == .front)
            let showing = AVCaptureConnection(inputPort: port, videoPreviewLayer: preview)
            guard session.canAddConnection(showing) else { return false }
            session.addConnection(showing)
            upright(showing, front: position == .front)
            outputs[position] = output
        }
        // Two cameras at full size can be more than the phone can run: then the mode says so and stays shut.
        return session.hardwareCost <= 1
    }

    /// Portrait, as the screen is held; the front camera as a mirror, as today's camera shows it.
    private func upright(_ connection: AVCaptureConnection, front: Bool) {
        if connection.isVideoRotationAngleSupported(90) { connection.videoRotationAngle = 90 }
        if front, connection.isVideoMirroringSupported {
            connection.automaticallyAdjustsVideoMirroring = false
            connection.isVideoMirrored = true
        }
    }

    private final class Shot: NSObject, AVCapturePhotoCaptureDelegate {
        var done: ((UIImage?) -> Void)?

        func photoOutput(_: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error _: (any Error)?) {
            done?(photo.fileDataRepresentation().flatMap(UIImage.init(data:)))
            done = nil
        }
    }
}

/// The Studio camera's "Front and back" button, and the mode it opens. Nothing shows, and nothing of the mode runs,
/// with the switch off or on a phone that can't run two cameras at once.
struct MomentsStudioFrontBackEntry: View {
    let model: MomentsComposerModel
    @State private var flags = PulseReinventedFlags.shared
    @State private var open = false

    var body: some View {
        if flags.isOn, MomentsFrontBack.available, model.wantsCamera, !model.camera.recording {
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Button { pick() } label: {
                        HStack(spacing: 10) {
                            Text("Front and back")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(.white)
                                .shadow(color: .black.opacity(0.55), radius: 4, x: 0, y: 1)
                            MomentsFrontBackGlyph()
                                .frame(width: 44, height: 44)
                                .background(Circle().fill(Color.black.opacity(0.42)))
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Front and back together")
                    .accessibilityHint("Takes the back and front cameras in one shot")
                    .accessibilityIdentifier("moments.studio.frontBack.open")
                }
                .padding(.trailing, Spacing.s4)
                Spacer()
                Spacer()
            }
            .fullScreenCover(isPresented: $open) {
                MomentsFrontBackScreen { image in
                    open = false
                    if let image { model.tookPhoto(image) } else { Task { await model.camera.start() } }
                }
            }
        }
    }

    /// Today's camera lets go of the back camera first; it starts again if the person comes back without a shot.
    private func pick() {
        model.camera.stop()
        open = true
    }
}

/// Two overlapping frames: the small picture inside the big one.
private struct MomentsFrontBackGlyph: View {
    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 4).stroke(.white, lineWidth: 2.2).frame(width: 20, height: 22)
            RoundedRectangle(cornerRadius: 2.5).fill(.white).frame(width: 8, height: 10).offset(x: 3.5, y: 3.5)
        }
        .frame(width: 20, height: 22)
    }
}

/// Front and back together, full screen: the big picture, the small one at the top left (a tap on it swaps them),
/// the shutter, and close. `done` gets the one picture, exactly as the screen showed it, or nil when the person closes it.
struct MomentsFrontBackScreen: View {
    let done: (UIImage?) -> Void
    /// Made only on a phone that can run two cameras at once (never on a simulator).
    @State private var camera: MomentsFrontBackCamera?
    /// nil while starting; false where it can't run here.
    @State private var ready: Bool?
    /// The front camera is the big picture.
    @State private var frontBig = false
    @State private var taking = false
    /// The screen's safe area (a reader that ignores it sees none, so it is read behind the screen).
    @State private var safe = EdgeInsets()

    var body: some View {
        GeometryReader { geo in
            let inset = MomentsFrontBack.smallFrame(safeTop: safe.top)
            ZStack(alignment: .top) {
                Color.black
                // The big picture fills the screen centred, as the viewer will show the shot, and is never wider.
                Color.clear
                    .overlay { big }
                    .clipped()
                if ready == true || MomentsFrontBackStandIn.isOn {
                    small.position(x: inset.midX, y: inset.midY)
                }
                controls(screen: geo.size, inset: inset)
                    .padding(.top, safe.top)
                    .padding(.bottom, safe.bottom)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .ignoresSafeArea()
        .background {
            GeometryReader { area in
                Color.clear
                    .onAppear { safe = area.safeAreaInsets }
                    .onChange(of: area.safeAreaInsets) { _, insets in safe = insets }
            }
        }
        .environment(\.colorScheme, .dark)
        .task {
            guard !MomentsFrontBackStandIn.isOn else { return }
            guard AVCaptureMultiCamSession.isMultiCamSupported else {
                ready = false
                return
            }
            let made = camera ?? MomentsFrontBackCamera()
            camera = made
            ready = await made.start()
        }
        .onDisappear { camera?.stop() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.studio.frontBack")
    }

    private func controls(screen: CGSize, inset: CGRect) -> some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button { done(nil) } label: {
                    Icon(.x, size: 22, strokeWidth: 2.4, color: .white)
                        .frame(width: 44, height: 44)
                        .background(Circle().fill(Color.black.opacity(0.42)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close front and back")
                .accessibilityIdentifier("moments.studio.frontBack.close")
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            Spacer(minLength: 0)
            if ready == false, !MomentsFrontBackStandIn.isOn {
                Text("This phone can't use both cameras at once.")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.s6)
                    .accessibilityIdentifier("moments.studio.frontBack.unavailable")
                Spacer(minLength: 0)
            }
            Text(MomentsFrontBackStandIn.isOn ? "Stand-in pictures: this build has no camera." : "Front and back together")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.6), radius: 1.5, x: 0, y: 1)
                .padding(.bottom, Spacing.s4)
            HStack {
                Color.clear.frame(width: 86, height: 1)
                Spacer(minLength: 0)
                shutter(screen: screen, inset: inset)
                Spacer(minLength: 0)
                Button { swap() } label: {
                    Icon(.switchCamera, size: 24, color: .white)
                        .frame(width: 48, height: 48)
                        .background(Circle().fill(Color.black.opacity(0.42)))
                }
                .buttonStyle(.plain)
                .frame(width: 86)
                .accessibilityLabel(frontBig ? "Show the back camera big" : "Show the front camera big")
                .accessibilityIdentifier("moments.studio.frontBack.swap")
            }
            .padding(.horizontal, Spacing.s1)
            .padding(.bottom, 24)
        }
    }

    private var big: some View {
        picture(front: frontBig)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(frontBig ? "Front camera" : "Back camera")
    }

    private var small: some View {
        Button { swap() } label: {
            Color.clear
                .overlay { picture(front: !frontBig) }
                .frame(width: 118, height: 157)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(.white, lineWidth: 3))
                .shadow(color: .black.opacity(0.35), radius: 6, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(frontBig ? "Back camera, small. Tap to swap" : "Front camera, small. Tap to swap")
        .accessibilityIdentifier("moments.studio.frontBack.small")
    }

    @ViewBuilder
    private func picture(front: Bool) -> some View {
        if MomentsFrontBackStandIn.isOn {
            Image(uiImage: MomentsFrontBackStandIn.picture(front: front))
                .resizable()
                .scaledToFill()
        } else if ready == true, let camera {
            MomentsFrontBackPreview(layer: front ? camera.frontPreview : camera.backPreview)
        } else {
            Color.black
        }
    }

    private func shutter(screen: CGSize, inset: CGRect) -> some View {
        Button { shoot(screen: screen, inset: inset) } label: {
            ZStack {
                Circle().stroke(.white, lineWidth: 4).frame(width: 80, height: 80)
                Circle().fill(.white).frame(width: 66, height: 66)
            }
            .opacity(taking ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .disabled(taking || !(ready == true || MomentsFrontBackStandIn.isOn))
        .accessibilityLabel("Take front and back")
        .accessibilityIdentifier("moments.studio.frontBack.shutter")
    }

    private func swap() {
        withAnimation(.easeInOut(duration: 0.2)) { frontBig.toggle() }
    }

    private func shoot(screen: CGSize, inset: CGRect) {
        guard !taking, screen.width > 0, screen.height > 0 else { return }
        taking = true
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        Task {
            let pair: (back: UIImage, front: UIImage)? = MomentsFrontBackStandIn.isOn
                ? (MomentsFrontBackStandIn.picture(front: false), MomentsFrontBackStandIn.picture(front: true))
                : await camera?.take()
            taking = false
            guard let pair else { return }
            let big = frontBig ? pair.front : pair.back
            let small = frontBig ? pair.back : pair.front
            done(MomentsFrontBack.compose(big: big, small: small, screen: screen, inset: inset))
        }
    }
}

/// One camera's live picture, edge to edge.
private struct MomentsFrontBackPreview: UIViewRepresentable {
    let layer: AVCaptureVideoPreviewLayer

    func makeUIView(context _: Context) -> Host {
        let view = Host()
        view.backgroundColor = .black
        view.preview = layer
        return view
    }

    func updateUIView(_ view: Host, context _: Context) {
        if view.preview !== layer { view.preview = layer }
    }

    final class Host: UIView {
        var preview: AVCaptureVideoPreviewLayer? {
            didSet {
                // After a swap the other host may already hold the old layer: take it off only if it's still here.
                if let oldValue, oldValue.superlayer === layer { oldValue.removeFromSuperlayer() }
                if let preview { layer.addSublayer(preview) }
                setNeedsLayout()
            }
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            preview?.frame = bounds
            CATransaction.commit()
        }
    }
}
