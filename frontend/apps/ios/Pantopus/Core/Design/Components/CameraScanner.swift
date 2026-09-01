//
//  CameraScanner.swift
//  Pantopus
//
//  Live capture surface for scan-first flows — the `Viewfinder` slot in the
//  A17.14 Unboxing design. A dark viewfinder with framing brackets, a glowing
//  accent scan-line, an "Item detected" pill, and a stroke-ring shutter over a
//  control deck. The caller supplies the `accent` (the screen's category tone)
//  and an `onCapture(UIImage)` handler.
//
//  Determinism + permissions: the live `AVCaptureSession` preview is compiled
//  out under the simulator (and skipped when camera access is denied), falling
//  back to a STATIC placeholder with a disabled shutter and a hint — so
//  snapshots never spin and never depend on a camera. The scan-line animates
//  only in production and honors Reduce Motion.
//
//  `CapturedFilmstrip` renders the horizontal strip of labeled thumbnails the
//  design shows under the viewfinder. Mirrors `CameraScanner` on Android.
//

import AVFoundation
import SwiftUI
import UIKit

// swiftlint:disable file_length

// MARK: - CameraScanner

/// A live camera viewfinder with a shutter. Falls back to a static placeholder
/// when the camera is unavailable (simulator) or access is denied.
@MainActor
public struct CameraScanner: View {
    private let accent: Color
    private let detectedLabel: String?
    private let onGallery: (() -> Void)?
    private let onFlip: (() -> Void)?
    private let reduceMotionOverride: Bool?
    private let onCapture: (UIImage) -> Void

    @State private var authorization = AVCaptureDevice.authorizationStatus(for: .video)
    @State private var captureToken = 0
    @State private var scanPhase: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// - Parameters:
    ///   - accent: The scan-line + "detected" pill tint (the screen's category tone).
    ///   - detectedLabel: Text for the live "detected" pill; pass `nil` to hide it.
    ///   - onGallery: Tap handler for the left rail (pick from library); `nil` disables it.
    ///   - onFlip: Tap handler for the right rail (flip camera); `nil` disables it.
    ///   - reduceMotionOverride: Force the scan-line static regardless of the
    ///     environment trait. Used by snapshot tests; leave `nil` in production.
    ///   - onCapture: Called with the still image when the shutter fires.
    public init(
        accent: Color,
        detectedLabel: String? = "Item detected",
        onGallery: (() -> Void)? = nil,
        onFlip: (() -> Void)? = nil,
        reduceMotionOverride: Bool? = nil,
        onCapture: @escaping (UIImage) -> Void
    ) {
        self.accent = accent
        self.detectedLabel = detectedLabel
        self.onGallery = onGallery
        self.onFlip = onFlip
        self.reduceMotionOverride = reduceMotionOverride
        self.onCapture = onCapture
    }

    private var isSimulator: Bool {
        #if targetEnvironment(simulator)
        true
        #else
        false
        #endif
    }

    /// Whether a real live feed can be shown.
    private var isLive: Bool {
        authorization == .authorized && !isSimulator
    }

    /// Reduce-motion, honoring the test override before the environment trait.
    private var effectiveReduceMotion: Bool {
        reduceMotionOverride ?? reduceMotion
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            feedArea
            controlDeck
        }
        .background(Color.black)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Color.black, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.18), radius: 18, x: 0, y: 6)
        .task { await requestAccessIfNeeded() }
    }

    // MARK: Feed

    private var feedArea: some View {
        ZStack {
            if isLive {
                #if !targetEnvironment(simulator)
                CameraScannerPreview(captureToken: captureToken, onCapture: onCapture)
                #endif
            } else {
                placeholder
            }
            FramingBrackets()
                .padding(22)
            if isLive {
                scanLine
                topPills
            }
        }
        .frame(height: 208)
        .frame(maxWidth: .infinity)
        .background(Color(white: 0.07))
        .clipped()
    }

    private var placeholder: some View {
        ZStack {
            StripeField()
            VStack(spacing: Spacing.s2) {
                Icon(.camera, size: 28, strokeWidth: 2, color: .white.opacity(0.5))
                Text(placeholderHint)
                    .font(.system(size: 11, weight: .medium))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.6))
                    .padding(.horizontal, Spacing.s5)
            }
        }
        .accessibilityElement()
        .accessibilityLabel(placeholderHint)
    }

    private var placeholderHint: String {
        switch authorization {
        case .denied, .restricted: "Camera access is off — enable it in Settings to scan."
        default: "Camera preview unavailable here."
        }
    }

    private var scanLine: some View {
        GeometryReader { proxy in
            let travel = proxy.size.height - 44
            LinearGradient(
                colors: [.clear, accent, .clear],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 2)
            .shadow(color: accent, radius: 6)
            .padding(.horizontal, 22)
            .offset(y: 22 + travel * scanPhase)
        }
        .allowsHitTesting(false)
        .onAppear {
            guard !effectiveReduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true)) {
                scanPhase = 1
            }
        }
    }

    private var topPills: some View {
        VStack {
            HStack {
                if let detectedLabel {
                    pill(icon: .scanLine, text: detectedLabel, background: accent.opacity(0.9), foreground: .white)
                }
                Spacer()
                pill(icon: .zap, text: "Auto", background: .black.opacity(0.45), foreground: .white)
            }
            Spacer()
        }
        .padding(Spacing.s2)
    }

    private func pill(icon: PantopusIcon, text: String, background: Color, foreground: Color) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(icon, size: 11, strokeWidth: 2, color: foreground)
            Text(text)
                .font(.system(size: 10, weight: .bold))
        }
        .foregroundStyle(foreground)
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Capsule().fill(background))
    }

    // MARK: Deck

    private var controlDeck: some View {
        HStack {
            railButton(icon: .image, label: "Library", action: onGallery)
            Spacer()
            shutter
            Spacer()
            railButton(icon: .refreshCw, label: "Flip", action: onFlip)
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                colors: [Color(white: 0.08), .black],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }

    private var shutter: some View {
        Button {
            captureToken += 1
        } label: {
            Circle()
                .stroke(.white.opacity(isLive ? 0.85 : 0.3), lineWidth: 3)
                .frame(width: 58, height: 58)
                .overlay(
                    Circle()
                        .fill(.white.opacity(isLive ? 1 : 0.3))
                        .frame(width: 44, height: 44)
                )
        }
        .buttonStyle(.plain)
        .disabled(!isLive)
        .accessibilityLabel(isLive ? "Capture photo" : "Capture photo, camera unavailable")
        .accessibilityIdentifier("cameraScanner_shutter")
    }

    private func railButton(icon: PantopusIcon, label: String, action: (() -> Void)?) -> some View {
        Button {
            action?()
        } label: {
            Icon(icon, size: 18, strokeWidth: 2, color: .white.opacity(action == nil ? 0.3 : 1))
                .frame(width: 40, height: 40)
                .background(.white.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(.white.opacity(0.14), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
        .accessibilityLabel(label)
    }

    private func requestAccessIfNeeded() async {
        guard authorization == .notDetermined else { return }
        let granted = await AVCaptureDevice.requestAccess(for: .video)
        authorization = granted ? .authorized : .denied
    }
}

// MARK: - Decorative bits

/// Four white corner brackets that frame the capture target.
private struct FramingBrackets: View {
    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            let h = proxy.size.height
            ZStack {
                bracket.position(x: 11, y: 11)
                bracket.rotationEffect(.degrees(90)).position(x: w - 11, y: 11)
                bracket.rotationEffect(.degrees(-90)).position(x: 11, y: h - 11)
                bracket.rotationEffect(.degrees(180)).position(x: w - 11, y: h - 11)
            }
        }
        .accessibilityHidden(true)
    }

    private var bracket: some View {
        ZStack(alignment: .topLeading) {
            Capsule().fill(.white.opacity(0.9)).frame(width: 18, height: 2.5)
            Capsule().fill(.white.opacity(0.9)).frame(width: 2.5, height: 18)
        }
        .frame(width: 22, height: 22, alignment: .topLeading)
    }
}

/// Diagonal hairline stripes — the design's "never a hand-drawn object"
/// placeholder fill for the dark feed area.
private struct StripeField: View {
    var body: some View {
        GeometryReader { proxy in
            Path { path in
                let step: CGFloat = 9
                let total = proxy.size.width + proxy.size.height
                var x: CGFloat = -proxy.size.height
                while x < total {
                    path.move(to: CGPoint(x: x, y: 0))
                    path.addLine(to: CGPoint(x: x + proxy.size.height, y: proxy.size.height))
                    x += step
                }
            }
            .stroke(.white.opacity(0.05), lineWidth: 1)
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Live preview (device only)

#if !targetEnvironment(simulator)
private struct CameraScannerPreview: UIViewControllerRepresentable {
    let captureToken: Int
    let onCapture: (UIImage) -> Void

    func makeUIViewController(context _: Context) -> CameraScannerController {
        CameraScannerController()
    }

    func updateUIViewController(_ controller: CameraScannerController, context _: Context) {
        controller.onCapture = onCapture
        controller.captureIfNeeded(token: captureToken)
    }
}

private final class CameraScannerController: UIViewController, AVCapturePhotoCaptureDelegate {
    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(
        label: "app.pantopus.cameraScanner.session",
        qos: .userInitiated
    )
    private let photoOutput = AVCapturePhotoOutput()
    private lazy var previewLayer = AVCaptureVideoPreviewLayer(session: session)
    var onCapture: ((UIImage) -> Void)?
    private var lastToken = 0
    private var isConfigured = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        startSessionIfNeeded()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopSession()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer.frame = view.bounds
    }

    deinit {
        stopSession()
    }

    /// Capture a still when the SwiftUI shutter increments `token`. Token 0
    /// is the initial value, so it never fires a capture on first layout.
    func captureIfNeeded(token: Int) {
        guard token != lastToken, token != 0 else { return }
        lastToken = token
        sessionQueue.async { [weak self] in
            guard let self, session.isRunning else { return }
            photoOutput.capturePhoto(with: AVCapturePhotoSettings(), delegate: self)
        }
    }

    private func startSessionIfNeeded() {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            if isConfigured {
                if !session.isRunning {
                    session.startRunning()
                }
                return
            }
            session.beginConfiguration()
            session.sessionPreset = .photo
            defer { self.session.commitConfiguration() }
            guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
                  let input = try? AVCaptureDeviceInput(device: device),
                  session.canAddInput(input),
                  session.canAddOutput(self.photoOutput)
            else { return }
            session.addInput(input)
            session.addOutput(photoOutput)
            isConfigured = true
            session.startRunning()
        }
    }

    private func stopSession() {
        sessionQueue.async { [session] in
            if session.isRunning {
                session.stopRunning()
            }
        }
    }

    func photoOutput(
        _: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error _: Error?
    ) {
        guard let data = photo.fileDataRepresentation(), let image = UIImage(data: data) else { return }
        DispatchQueue.main.async { [weak self] in self?.onCapture?(image) }
    }
}
#endif

// MARK: - CapturedFilmstrip

/// One thumbnail in a `CapturedFilmstrip`.
public struct CameraScannerShot: Identifiable {
    public let id: String
    /// Mono corner tag, e.g. `UNIT` / `BOX` / `RECEIPT` / `LABEL`.
    public let tag: String
    /// Caption under the thumbnail, e.g. "The machine".
    public let label: String
    /// The hero shot — gets the accent border + star badge.
    public let isMain: Bool
    /// Captured image; `nil` renders the dark striped placeholder.
    public let image: UIImage?

    public init(id: String = UUID().uuidString, tag: String, label: String, isMain: Bool = false, image: UIImage? = nil) {
        self.id = id
        self.tag = tag
        self.label = label
        self.isMain = isMain
        self.image = image
    }
}

/// Horizontal rail of captured thumbnails with a trailing "Add" tile.
@MainActor
public struct CapturedFilmstrip: View {
    private let title: String
    private let accent: Color
    private let shots: [CameraScannerShot]
    private let onAdd: (() -> Void)?

    public init(
        title: String = "Captured",
        accent: Color,
        shots: [CameraScannerShot],
        onAdd: (() -> Void)? = nil
    ) {
        self.title = title
        self.accent = accent
        self.shots = shots
        self.onAdd = onAdd
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack {
                Text(title)
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                Text("\(shots.count) shots")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s3) {
                    ForEach(shots) { ThumbnailTile(shot: $0, accent: accent) }
                    if let onAdd { AddTile(accent: accent, action: onAdd) }
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.bottom, Spacing.s3)
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

private struct ThumbnailTile: View {
    let shot: CameraScannerShot
    let accent: Color

    var body: some View {
        VStack(spacing: 5) {
            ZStack(alignment: .topLeading) {
                Group {
                    if let image = shot.image {
                        Image(uiImage: image).resizable().scaledToFill()
                    } else {
                        ZStack {
                            Color(white: 0.11)
                            StripeField()
                        }
                    }
                }
                .frame(width: 72, height: 88)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(shot.isMain ? accent : Theme.Color.appBorder, lineWidth: shot.isMain ? 2 : 1)
                )

                Text(shot.tag)
                    .font(.system(size: 8, weight: .bold, design: .monospaced))
                    .tracking(0.3)
                    .foregroundStyle(.white.opacity(0.55))
                    .padding(5)

                if shot.isMain {
                    Circle()
                        .fill(accent)
                        .frame(width: 16, height: 16)
                        .overlay(Icon(.star, size: 9, strokeWidth: 2, color: .white))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                        .padding(Spacing.s1)
                }
            }
            .frame(width: 72, height: 88)

            Text(shot.label)
                .font(.system(size: 10, weight: .regular))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
                .frame(width: 72)
        }
        .accessibilityElement()
        .accessibilityLabel("\(shot.label)\(shot.isMain ? ", main shot" : "")")
    }
}

private struct AddTile: View {
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Spacing.s1) {
                Icon(.plus, size: 18, strokeWidth: 2, color: accent)
                Text("Add")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(accent)
            }
            .frame(width: 72, height: 88)
            .background(accent.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(accent.opacity(0.4), style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add a shot")
        .accessibilityIdentifier("cameraScanner_addShot")
    }
}

#Preview("CameraScanner + filmstrip") {
    VStack(spacing: Spacing.s4) {
        CameraScanner(accent: Theme.Color.success) { _ in }
        CapturedFilmstrip(
            accent: Theme.Color.success,
            shots: [
                CameraScannerShot(tag: "UNIT", label: "The machine", isMain: true),
                CameraScannerShot(tag: "BOX", label: "Box + barcode"),
                CameraScannerShot(tag: "RECEIPT", label: "Store receipt"),
                CameraScannerShot(tag: "LABEL", label: "Serial label")
            ]
        ) {}
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
