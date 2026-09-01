//
//  EditProfileAvatarBlock.swift
//  Pantopus
//
//  A13.9 §① "Avatar + cover" — the 92pt avatar with a camera badge and a
//  "Change photo" text button, per
//  `A13 — Form (single screen)/edit-profile-frames.jsx:52-90`.
//
//  Tapping either the avatar or the button opens the system photos picker.
//  The picked item is read as `Data` and pushed to
//  `POST /api/upload/profile-picture` by
//  `EditProfileViewModel.uploadAvatar(...)`.
//
//  Permissions: the `.photosPicker(isPresented:…)` modifier presents
//  `PHPickerViewController` out-of-process, so it needs no
//  `NSPhotoLibraryUsageDescription` and never raises an authorization
//  prompt — there is no "denied" branch to render. What *can* fail is
//  reading the picked asset (revoked limited-library access, an iCloud
//  asset that won't materialise); that path renders the real inline error
//  below instead of a silent no-op.
//

import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// Avatar + "Change photo" affordance for the Edit Profile form.
@MainActor
struct EditProfileAvatarBlock: View {
    let avatarURL: URL?
    let initial: String
    let state: EditProfileAvatarState
    let onPicked: @MainActor (Data?, String, String) -> Void
    let onDismissError: @MainActor () -> Void

    @State private var showsPicker = false
    @State private var selection: PhotosPickerItem?

    private var isUploading: Bool {
        if case .uploading = state { return true }
        return false
    }

    private var errorMessage: String? {
        if case let .failed(message) = state { return message }
        return nil
    }

    var body: some View {
        VStack(spacing: 10) {
            Button { showsPicker = true } label: { avatarCircle }
                .buttonStyle(.plain)
                .disabled(isUploading)
                .accessibilityIdentifier("editProfileAvatar")
                .accessibilityLabel("Profile photo")
                .accessibilityHint("Opens your photo library to pick a new profile photo")

            Button { showsPicker = true } label: { changePhotoLabel }
                .buttonStyle(.plain)
                .disabled(isUploading)
                .frame(minHeight: 44)
                .accessibilityIdentifier("editProfileChangePhotoButton")

            if let errorMessage {
                VStack(spacing: Spacing.s1) {
                    Text(errorMessage)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Color.error)
                        .multilineTextAlignment(.center)
                    Button("Dismiss") { onDismissError() }
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("editProfileAvatarError")
            }
        }
        .frame(maxWidth: .infinity)
        .photosPicker(isPresented: $showsPicker, selection: $selection, matching: .images)
        .onChange(of: selection) { _, newValue in
            guard let newValue else { return }
            selection = nil
            load(newValue)
        }
    }

    @ViewBuilder private var changePhotoLabel: some View {
        if isUploading {
            HStack(spacing: Spacing.s1) {
                ProgressView()
                    .controlSize(.small)
                Text("Uploading…")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        } else {
            Text("Change photo")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.primary600)
        }
    }

    private var avatarCircle: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                Circle().fill(Theme.Color.personalBg)
                if let avatarURL {
                    AsyncImage(url: avatarURL) { phase in
                        switch phase {
                        case let .success(image):
                            image.resizable().scaledToFill()
                        default:
                            initialLabel
                        }
                    }
                } else {
                    initialLabel
                }
            }
            .frame(width: 92, height: 92)
            .clipShape(Circle())
            .opacity(isUploading ? 0.6 : 1)

            ZStack {
                Circle().fill(Theme.Color.appSurface)
                Circle().stroke(Theme.Color.appBg, lineWidth: 2)
                Icon(.camera, size: 15, color: Theme.Color.primary600)
            }
            .frame(width: 30, height: 30)
            .pantopusShadow(.sm)
            .offset(x: 2, y: 2)
        }
        .frame(width: 92, height: 92)
    }

    private var initialLabel: some View {
        Text(initial)
            .font(.system(size: 30, weight: .bold))
            .foregroundStyle(Theme.Color.personal)
    }

    /// Read the picked asset. A `nil` payload is a genuine read failure
    /// (revoked access / undownloadable iCloud asset) and is forwarded so
    /// the view-model can render it.
    private func load(_ item: PhotosPickerItem) {
        let isPNG = item.supportedContentTypes.contains { $0.conforms(to: .png) }
        let mimeType = isPNG ? "image/png" : "image/jpeg"
        let filename = "profile-\(Int(Date().timeIntervalSince1970)).\(isPNG ? "png" : "jpg")"
        Task {
            let data = try? await item.loadTransferable(type: Data.self)
            onPicked(data, filename, mimeType)
        }
    }
}
