//
//  SystemCameraPicker.swift
//  Pantopus
//
//  Presents the system camera via UIImagePickerController. Use for flows
//  that need a real device camera capture rather than an in-app preview.
//

import SwiftUI
import UIKit

/// Full-screen system camera. Dismisses itself on capture or cancel.
struct SystemCameraPicker: UIViewControllerRepresentable {
    @Binding var isPresented: Bool
    let onImage: (UIImage) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraCaptureMode = .photo
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_: UIImagePickerController, context _: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(isPresented: $isPresented, onImage: onImage)
    }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        @Binding var isPresented: Bool
        let onImage: (UIImage) -> Void

        init(isPresented: Binding<Bool>, onImage: @escaping (UIImage) -> Void) {
            _isPresented = isPresented
            self.onImage = onImage
        }

        func imagePickerController(
            _: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                onImage(image)
            }
            isPresented = false
        }

        func imagePickerControllerDidCancel(_: UIImagePickerController) {
            isPresented = false
        }
    }
}
