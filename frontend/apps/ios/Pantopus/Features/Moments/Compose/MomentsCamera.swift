//
//  MomentsCamera.swift
//  Pantopus
//
//  Board P1, the camera: tap for a photo, hold for a video up to 30 seconds
//  with its sound. The place chip at the top shows where the Moment will pin
//  before anything is taken. Flash, front or back camera, the library's
//  newest photo, and Library · Camera · Text under it. Where there's no
//  camera (the iOS simulator) it says so and the library and text still work.
//

import AVFoundation
import Photos
import SwiftUI
import UIKit

/// The capture session, run on its own queue.
final class MomentsCameraController: NSObject, @unchecked Sendable {
    let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "app.pantopus.ios.moments.camera")
    private let photoOutput = AVCapturePhotoOutput()
    private let movieOutput = AVCaptureMovieFileOutput()
    private var videoInput: AVCaptureDeviceInput?
    private var photoContinuation: CheckedContinuation<UIImage?, Never>?
    /// The finger lifted before the recording had begun: it stops as soon as it starts.
    private var stopRequested = false
    /// A video finished: by the finger lifting, or at 30 seconds.
    var onVideo: (@MainActor (URL?) -> Void)?

    static var hasCamera: Bool {
        AVCaptureDevice.default(for: .video) != nil
    }

    /// Asks for the camera, and the microphone for a video's sound, then starts.
    func start() async -> Bool {
        guard Self.hasCamera, await AVCaptureDevice.requestAccess(for: .video) else { return false }
        let withSound = await AVCaptureDevice.requestAccess(for: .audio)
        return await withCheckedContinuation { continuation in
            queue.async { [self] in
                if videoInput == nil { configure(withSound: withSound) }
                if !session.isRunning { session.startRunning() }
                continuation.resume(returning: videoInput != nil)
            }
        }
    }

    func stop() {
        queue.async { [self] in
            if movieOutput.isRecording { movieOutput.stopRecording() }
            if session.isRunning { session.stopRunning() }
        }
    }

    private func configure(withSound: Bool) {
        session.beginConfiguration()
        session.sessionPreset = .high
        if let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
           let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) {
            session.addInput(input)
            videoInput = input
        }
        if withSound, let microphone = AVCaptureDevice.default(for: .audio),
           let input = try? AVCaptureDeviceInput(device: microphone), session.canAddInput(input) {
            session.addInput(input)
        }
        if session.canAddOutput(photoOutput) { session.addOutput(photoOutput) }
        if session.canAddOutput(movieOutput) {
            session.addOutput(movieOutput)
            movieOutput.maxRecordedDuration = CMTime(seconds: MomentsMediaExport.maxVideoSeconds, preferredTimescale: 600)
        }
        session.commitConfiguration()
    }

    /// Front or back.
    func switchCamera() {
        queue.async { [self] in
            guard let current = videoInput else { return }
            let position: AVCaptureDevice.Position = current.device.position == .back ? .front : .back
            guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
                  let input = try? AVCaptureDeviceInput(device: device) else { return }
            session.beginConfiguration()
            session.removeInput(current)
            if session.canAddInput(input) {
                session.addInput(input)
                videoInput = input
            } else {
                session.addInput(current)
            }
            session.commitConfiguration()
        }
    }

    func takePhoto(flash: Bool) async -> UIImage? {
        await withCheckedContinuation { continuation in
            queue.async { [self] in
                photoContinuation = continuation
                let settings = AVCapturePhotoSettings()
                if flash, photoOutput.supportedFlashModes.contains(.on) { settings.flashMode = .on }
                upright(photoOutput.connection(with: .video))
                photoOutput.capturePhoto(with: settings, delegate: self)
            }
        }
    }

    func startVideo(flash: Bool) {
        queue.async { [self] in
            guard !movieOutput.isRecording else { return }
            stopRequested = false
            torch(flash)
            upright(movieOutput.connection(with: .video))
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("moment-\(UUID().uuidString).mov")
            movieOutput.startRecording(to: url, recordingDelegate: self)
        }
    }

    func stopVideo() {
        queue.async { [self] in
            stopRequested = true
            if movieOutput.isRecording { movieOutput.stopRecording() }
        }
    }

    private func torch(_ isOn: Bool) {
        guard let device = videoInput?.device, device.hasTorch, (try? device.lockForConfiguration()) != nil else { return }
        device.torchMode = isOn ? .on : .off
        device.unlockForConfiguration()
    }

    /// Portrait, as the screen is held.
    private func upright(_ connection: AVCaptureConnection?) {
        guard let connection else { return }
        if connection.isVideoRotationAngleSupported(90) { connection.videoRotationAngle = 90 }
        if videoInput?.device.position == .front, connection.isVideoMirroringSupported {
            connection.automaticallyAdjustsVideoMirroring = false
            connection.isVideoMirrored = true
        }
    }
}

extension MomentsCameraController: AVCapturePhotoCaptureDelegate, AVCaptureFileOutputRecordingDelegate {
    func photoOutput(_: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error _: (any Error)?) {
        let image = photo.fileDataRepresentation().flatMap(UIImage.init(data:))
        queue.async { [self] in
            photoContinuation?.resume(returning: image)
            photoContinuation = nil
        }
    }

    func fileOutput(_: AVCaptureFileOutput, didStartRecordingTo _: URL, from _: [AVCaptureConnection]) {
        // Let go in the instant before the recording began: stop it now, not at 30 seconds.
        queue.async { [self] in
            if stopRequested, movieOutput.isRecording { movieOutput.stopRecording() }
        }
    }

    func fileOutput(
        _: AVCaptureFileOutput, didFinishRecordingTo url: URL, from _: [AVCaptureConnection], error: (any Error)?
    ) {
        // Stopping at 30 seconds reports an error that says the file is fine.
        let finished = error == nil || ((error as NSError?)?.userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool) == true
        queue.async { [self] in torch(false) }
        let result = finished ? url : nil
        Task { @MainActor [weak self] in self?.onVideo?(result) }
    }
}

/// What the camera sees, edge to edge.
struct MomentsCameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context _: Context) -> PreviewView {
        let view = PreviewView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspectFill
        view.backgroundColor = .black
        return view
    }

    func updateUIView(_: PreviewView, context _: Context) {}

    final class PreviewView: UIView {
        override static var layerClass: AnyClass {
            AVCaptureVideoPreviewLayer.self
        }

        var previewLayer: AVCaptureVideoPreviewLayer {
            // swiftlint:disable:next force_cast
            layer as! AVCaptureVideoPreviewLayer
        }
    }
}
