//
//  WifiQRScannerSheet.swift
//  Pantopus
//
//  A12.2 — the Add-Home wizard's Wi-Fi QR scanner. Ports RN's
//  `src/components/homes/QrScannerModal.tsx`: a full-screen camera with
//  a hint strip that autofills the network name + password from a
//  `WIFI:` barcode, plus a "Scan again" affordance after a rejected code.
//
//  Determinism + permissions follow `CameraScanner`: the live
//  `AVCaptureMetadataOutput` session is compiled out under the simulator
//  and skipped when camera access is denied, so previews and snapshots
//  never depend on a camera.
//

import AVFoundation
import SwiftUI

@MainActor
struct WifiQRScannerSheet: View {
    /// Called with the raw barcode payload. Returns true when the code
    /// parsed as a Wi-Fi QR and was applied.
    let onScanned: (String) -> Bool
    let onClose: () -> Void

    @State private var authorization = AVCaptureDevice.authorizationStatus(for: .video)
    /// True after a scan has been consumed, so a code sitting in frame
    /// can't fire repeatedly. Mirrors RN's `scannerLocked`.
    @State private var isLocked = false
    @State private var invalidCodeMessage: String?

    private var isSimulator: Bool {
        #if targetEnvironment(simulator)
        true
        #else
        false
        #endif
    }

    private var isLive: Bool {
        authorization == .authorized && !isSimulator
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            ZStack {
                if isLive {
                    #if !targetEnvironment(simulator)
                    WifiQRScannerPreview(isPaused: isLocked) { payload in
                        handle(payload)
                    }
                    #endif
                } else {
                    unavailablePlaceholder
                }
                VStack {
                    Spacer()
                    hintStrip
                    if isLocked {
                        Button("Scan again") {
                            invalidCodeMessage = nil
                            isLocked = false
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .padding(.horizontal, Spacing.s5)
                        .padding(.vertical, Spacing.s3)
                        .background(Theme.Color.primary600)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        .padding(.bottom, Spacing.s5)
                        .accessibilityIdentifier("addHome_scanAgain")
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.black)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("addHomeWifiQrScanner")
        .task { await requestAccessIfNeeded() }
    }

    private var header: some View {
        HStack {
            Button(action: onClose) {
                Icon(.x, size: 22, strokeWidth: 2, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close scanner")
            .accessibilityIdentifier("addHome_closeScanner")
            Spacer()
            Text("Scan WiFi QR")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            Color.clear.frame(width: 36, height: 36)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
    }

    private var hintStrip: some View {
        Text(
            invalidCodeMessage
                ?? "Point your camera at a WiFi QR code to autofill network name and password."
        )
        .font(.system(size: 12.5))
        .multilineTextAlignment(.center)
        .foregroundStyle(Theme.Color.appTextInverse)
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity)
        .background(Color.black.opacity(0.55))
        .accessibilityIdentifier("addHome_scannerHint")
    }

    private var unavailablePlaceholder: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.camera, size: 28, strokeWidth: 2, color: Theme.Color.appTextInverse.opacity(0.5))
            Text(placeholderHint)
                .font(.system(size: 12.5))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appTextInverse.opacity(0.7))
                .padding(.horizontal, Spacing.s5)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(placeholderHint)
    }

    private var placeholderHint: String {
        switch authorization {
        case .denied, .restricted:
            "Camera access is off — enable it in Settings to scan a WiFi QR code."
        default:
            "Camera preview unavailable here. Enter the network name and password manually."
        }
    }

    private func handle(_ payload: String) {
        guard !isLocked else { return }
        isLocked = true
        if onScanned(payload) {
            invalidCodeMessage = nil
        } else {
            // RN's alert copy (`useHomeForm.ts:221`).
            invalidCodeMessage = "Invalid QR code — this does not look like a WiFi QR code."
        }
    }

    private func requestAccessIfNeeded() async {
        guard authorization == .notDetermined else { return }
        let granted = await AVCaptureDevice.requestAccess(for: .video)
        authorization = granted ? .authorized : .denied
    }
}

// MARK: - Live metadata capture (device only)

#if !targetEnvironment(simulator)
private struct WifiQRScannerPreview: UIViewControllerRepresentable {
    let isPaused: Bool
    let onPayload: (String) -> Void

    func makeUIViewController(context _: Context) -> WifiQRScannerController {
        WifiQRScannerController()
    }

    func updateUIViewController(_ controller: WifiQRScannerController, context _: Context) {
        controller.onPayload = onPayload
        controller.isPaused = isPaused
    }
}

private final class WifiQRScannerController: UIViewController,
    AVCaptureMetadataOutputObjectsDelegate {
    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(
        label: "app.pantopus.wifiQrScanner.session",
        qos: .userInitiated
    )
    private let metadataOutput = AVCaptureMetadataOutput()
    private lazy var previewLayer = AVCaptureVideoPreviewLayer(session: session)
    var onPayload: ((String) -> Void)?
    var isPaused = false
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

    private func startSessionIfNeeded() {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            if isConfigured {
                if !session.isRunning { session.startRunning() }
                return
            }
            session.beginConfiguration()
            defer { self.session.commitConfiguration() }
            guard let device = AVCaptureDevice.default(
                .builtInWideAngleCamera,
                for: .video,
                position: .back
            ),
                let input = try? AVCaptureDeviceInput(device: device),
                session.canAddInput(input),
                session.canAddOutput(metadataOutput)
            else { return }
            session.addInput(input)
            session.addOutput(metadataOutput)
            metadataOutput.setMetadataObjectsDelegate(self, queue: .main)
            metadataOutput.metadataObjectTypes = [.qr]
            isConfigured = true
            session.startRunning()
        }
    }

    private func stopSession() {
        sessionQueue.async { [session] in
            if session.isRunning { session.stopRunning() }
        }
    }

    func metadataOutput(
        _: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from _: AVCaptureConnection
    ) {
        guard !isPaused else { return }
        guard let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              object.type == .qr,
              let payload = object.stringValue
        else { return }
        onPayload?(payload)
    }
}
#endif
