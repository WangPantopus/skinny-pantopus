//
//  ListingComposePhotoStep.swift
//  Pantopus
//
//  Photo picker step components for the Snap & Sell listing wizard.
//

import AVFoundation
import PhotosUI
import SwiftUI

struct ListingComposePhotosStep: View {
    @Bindable var viewModel: ListingComposeWizardViewModel
    let onRequestRemove: (ListingComposePhoto) -> Void

    var body: some View {
        if viewModel.isCameraCaptureStep {
            ListingComposeCameraStep(viewModel: viewModel)
        } else {
            ListingComposePhotoGridEditor(viewModel: viewModel, onRequestRemove: onRequestRemove)
        }
    }
}

private struct ListingComposeCameraStep: View {
    @Bindable var viewModel: ListingComposeWizardViewModel
    @State private var showsCamera = false
    @State private var showsPhotosPicker = false
    @State private var photosPickerSelection: [PhotosPickerItem] = []
    @State private var cameraAuthorization = AVCaptureDevice.authorizationStatus(for: .video)
    @State private var didAutoOpenCamera = false

    private var canUseCamera: Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
    }

    private var remainingCaptureSlots: Int {
        max(0, ListingComposeFormState.targetCaptureAngles - viewModel.form.photos.count)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            HeadlineBlock("Snap your item")
            SubcopyBlock(
                "Take up to 4 photos from different angles. Pantopus will suggest a title and price."
            )
            SnapCoachingBanner(text: viewModel.snapCoachingText)
            CapturedAnglesTray(
                photos: viewModel.form.photos,
                progressText: viewModel.snapCaptureProgressText
            )
            if cameraAuthorization == .denied || cameraAuthorization == .restricted {
                CameraAccessDeniedBanner()
            }
            VStack(spacing: Spacing.s3) {
                if canUseCamera, remainingCaptureSlots > 0 {
                    PrimaryButton(title: "Take photo") {
                        openCamera()
                    }
                    .accessibilityIdentifier("listingComposeShutter")
                }
                if remainingCaptureSlots > 0 {
                    GhostButton(title: "Choose from library") {
                        showsPhotosPicker = true
                    }
                    .accessibilityIdentifier("listingComposeLibraryPhoto")
                }
            }
            Button {
                viewModel.skipToManualPhotoEditor()
            } label: {
                HStack(spacing: Spacing.s1) {
                    Text("Skip to manual")
                        .font(.system(size: 13, weight: .semibold))
                    Icon(.arrowRight, size: 14, color: Theme.Color.appTextSecondary)
                }
                .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("listingComposeSkipManual")
        }
        .accessibilityIdentifier("listingComposeCameraStep")
        .fullScreenCover(isPresented: $showsCamera) {
            SystemCameraPicker(isPresented: $showsCamera) { image in
                if let data = ListingPhotoProcessor.uploadData(from: image) {
                    viewModel.captureSnapPhoto(data)
                }
                let remaining = max(
                    0,
                    ListingComposeFormState.targetCaptureAngles - viewModel.form.photos.count
                )
                if remaining > 0 {
                    Task { @MainActor in
                        try? await Task.sleep(nanoseconds: 350_000_000)
                        showsCamera = true
                    }
                }
            }
            .ignoresSafeArea()
        }
        .photosPicker(
            isPresented: $showsPhotosPicker,
            selection: $photosPickerSelection,
            maxSelectionCount: max(1, remainingCaptureSlots),
            matching: .images
        )
        .onChange(of: photosPickerSelection) { _, newItems in
            handleLibraryPicks(newItems)
        }
        .onAppear {
            guard viewModel.form.photos.isEmpty, !didAutoOpenCamera, canUseCamera else { return }
            didAutoOpenCamera = true
            openCamera()
        }
    }

    private func openCamera() {
        switch cameraAuthorization {
        case .authorized:
            showsCamera = true
        case .notDetermined:
            Task {
                let granted = await AVCaptureDevice.requestAccess(for: .video)
                await MainActor.run {
                    cameraAuthorization = granted ? .authorized : .denied
                    if granted {
                        showsCamera = true
                    }
                }
            }
        case .denied, .restricted:
            break
        @unknown default:
            break
        }
    }

    private func handleLibraryPicks(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        Task {
            var loaded: [Data] = []
            for item in items.prefix(remainingCaptureSlots) {
                if let raw = try? await item.loadTransferable(type: Data.self),
                   let data = ListingPhotoProcessor.uploadData(from: raw) {
                    loaded.append(data)
                }
            }
            let images = loaded
            await MainActor.run {
                viewModel.addLibraryPhotos(images)
                photosPickerSelection = []
            }
        }
    }
}

private struct SnapCoachingBanner: View {
    let text: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.sparkles, size: 14, color: Theme.Color.primary600)
            Text(text)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

private struct CameraAccessDeniedBanner: View {
    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.camera, size: 18, color: Theme.Color.appTextSecondary)
            Text("Camera access is off. Enable it in Settings to take photos, or choose from your library.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}

private struct ListingComposePhotoGridEditor: View {
    @Bindable var viewModel: ListingComposeWizardViewModel
    let onRequestRemove: (ListingComposePhoto) -> Void
    @State private var showsPhotosPicker = false
    @State private var photosPickerSelection: [PhotosPickerItem] = []

    private let columns: [GridItem] = [
        GridItem(.flexible(), spacing: Spacing.s3),
        GridItem(.flexible(), spacing: Spacing.s3)
    ]

    private var remainingSlots: Int {
        max(0, ListingComposeFormState.maxPhotos - viewModel.form.photos.count)
    }

    var body: some View {
        HeadlineBlock("Add photos")
        SubcopyBlock(
            "Show your item in good light. The first photo becomes the hero — long-press a tile to reorder, tap to remove."
        )
        LazyVGrid(columns: columns, spacing: Spacing.s3) {
            ForEach(Array(viewModel.form.photos.enumerated()), id: \.element.id) { index, photo in
                PhotoTile(
                    index: index,
                    photo: photo,
                    onTap: { onRequestRemove(photo) },
                    onMoveUp: index > 0 ? { viewModel.movePhoto(from: index, to: index - 1) } : nil,
                    onMoveDown: index < viewModel.form.photos.count - 1
                        ? { viewModel.movePhoto(from: index, to: index + 1) }
                        : nil,
                    onMakeHero: index > 0 ? { viewModel.makeHero(id: photo.id) } : nil
                )
            }
            if remainingSlots > 0 {
                AddPhotoTile { showsPhotosPicker = true }
            }
        }
        .photosPicker(
            isPresented: $showsPhotosPicker,
            selection: $photosPickerSelection,
            maxSelectionCount: max(1, remainingSlots),
            matching: .images
        )
        .onChange(of: photosPickerSelection) { _, newItems in
            handleLibraryPicks(newItems)
        }
        PhotoCountLabel(count: viewModel.form.photos.count)
    }

    private func handleLibraryPicks(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        Task {
            var loaded: [Data] = []
            for item in items.prefix(remainingSlots) {
                if let raw = try? await item.loadTransferable(type: Data.self),
                   let data = ListingPhotoProcessor.uploadData(from: raw) {
                    loaded.append(data)
                }
            }
            let images = loaded
            await MainActor.run {
                viewModel.addLibraryPhotos(images)
                photosPickerSelection = []
            }
        }
    }
}

/// Renders a wizard photo: local bytes first, remote URL fallback
/// (edit-mode hydration), neutral placeholder otherwise. Shared by the
/// grid editor, the capture tray, and the snap-review strip.
struct ListingPhotoThumbnail: View {
    let photo: ListingComposePhoto

    var body: some View {
        if let data = photo.localImageData, let image = UIImage(data: data) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fill)
        } else if photo.isRemote, let url = URL(string: photo.token) {
            AsyncImage(url: url) { phase in
                switch phase {
                case let .success(image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                default:
                    placeholder
                }
            }
        } else {
            placeholder
        }
    }

    private var placeholder: some View {
        Rectangle()
            .fill(Theme.Color.appSurfaceMuted)
            .overlay(
                Icon(.image, size: 24, color: Theme.Color.appTextSecondary)
            )
    }
}

private struct CapturedAnglesTray: View {
    let photos: [ListingComposePhoto]
    let progressText: String

    private let labels = ["Wide", "Detail", "Tag", "Back"]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(progressText)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .textCase(.uppercase)
            HStack(spacing: Spacing.s2) {
                ForEach(0..<ListingComposeFormState.targetCaptureAngles, id: \.self) { index in
                    AngleSlot(
                        photo: index < photos.count ? photos[index] : nil,
                        label: labels[index]
                    )
                }
            }
        }
    }
}

private struct AngleSlot: View {
    let photo: ListingComposePhoto?
    let label: String

    var body: some View {
        ZStack {
            if let photo {
                Color.clear
                    .overlay(ListingPhotoThumbnail(photo: photo))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.success, lineWidth: 1.5)
                    )
                Circle()
                    .fill(Theme.Color.success)
                    .frame(width: 16, height: 16)
                    .overlay(Icon(.check, size: 9, color: .white))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(Spacing.s1)
            } else {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.appSurfaceMuted)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(
                                Theme.Color.appBorder,
                                style: StrokeStyle(lineWidth: 1.5, dash: [4, 4])
                            )
                    )
                Text(label)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .textCase(.uppercase)
            }
        }
        .frame(height: 56)
    }
}

private struct PhotoTile: View {
    let index: Int
    let photo: ListingComposePhoto
    let onTap: () -> Void
    let onMoveUp: (() -> Void)?
    let onMoveDown: (() -> Void)?
    let onMakeHero: (() -> Void)?

    var body: some View {
        Button(action: onTap) {
            ZStack(alignment: .topLeading) {
                Color.clear
                    .aspectRatio(1, contentMode: .fit)
                    .overlay(ListingPhotoThumbnail(photo: photo))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                if index == 0 {
                    HeroChip()
                        .padding(Spacing.s2)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("listingCompose_photo_\(index)")
        .accessibilityLabel(
            index == 0
                ? "Photo \(index + 1) of grid. Hero photo. Tap to remove."
                : "Photo \(index + 1) of grid. Tap to remove."
        )
        .accessibilityAddTraits(.isButton)
        .contextMenu {
            if let onMakeHero {
                Button("Make hero", action: onMakeHero)
                    .accessibilityIdentifier("listingCompose_makeHero_\(index)")
            }
            if let onMoveUp {
                Button("Move up", action: onMoveUp)
                    .accessibilityIdentifier("listingCompose_moveUp_\(index)")
            }
            if let onMoveDown {
                Button("Move down", action: onMoveDown)
                    .accessibilityIdentifier("listingCompose_moveDown_\(index)")
            }
        }
    }
}

private struct HeroChip: View {
    var body: some View {
        Text("HERO")
            .pantopusTextStyle(.overline)
            .foregroundStyle(Theme.Color.appTextInverse)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s1)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
    }
}

private struct AddPhotoTile: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(
                    Theme.Color.appBorder,
                    style: StrokeStyle(lineWidth: 1, dash: [4, 4])
                )
                .aspectRatio(1, contentMode: .fit)
                .overlay(
                    VStack(spacing: Spacing.s1) {
                        Icon(.camera, size: 28, color: Theme.Color.appTextSecondary)
                        Text("Add photo")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("listingCompose_addPhoto")
        .accessibilityLabel("Add photo")
        .accessibilityAddTraits(.isButton)
    }
}

private struct PhotoCountLabel: View {
    let count: Int

    var body: some View {
        Text("\(count) of \(ListingComposeFormState.maxPhotos) photos")
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityIdentifier("listingCompose_photoCount")
    }
}
