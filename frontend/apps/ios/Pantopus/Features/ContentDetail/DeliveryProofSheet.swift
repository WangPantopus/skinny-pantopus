//
//  DeliveryProofSheet.swift
//  Pantopus
//
//  §1B-4 — Proof-of-delivery / completion sheet a hired worker uses to
//  mark a V2 task delivered. Presented over the A09.1 Task-V2 detail
//  (`GigDetailView`). Design: docs/design/new/Delivery Proof Sheet.html
//  + delivery-proof-frames.jsx. One sheet · two states: ENTRY (compose
//  the proof — ≥1 photo required, optional note) and SUBMITTED
//  ("Delivery confirmed" recap with a "Back to task" CTA).
//
//  Submit roundtrip is owned by the host (`GigDetailViewModel`): each
//  photo is uploaded via `POST /api/files/upload`, then the resulting
//  URLs ride `POST /api/gigs/:gigId/mark-completed` with the note.
//

import PhotosUI
import SwiftUI

// MARK: - Presentation contract

/// Presentation target for the Delivery Proof sheet. Carries the gig
/// identity the submit roundtrip needs plus the context line shown in
/// the SUBMITTED recap card.
public struct DeliveryProofTarget: Identifiable, Sendable, Hashable {
    public let id: String
    public let gigId: String
    public let gigTitle: String

    public init(id: String, gigId: String, gigTitle: String) {
        self.id = id
        self.gigId = gigId
        self.gigTitle = gigTitle
    }
}

/// One picked proof photo. The raw bytes are uploaded by the host; the
/// `id` keeps the grid stable across removals.
public struct DeliveryProofPhoto: Identifiable, Sendable, Hashable {
    public let id: String
    public let data: Data
    public let filename: String
    public let mimeType: String

    public init(id: String = UUID().uuidString, data: Data, filename: String, mimeType: String) {
        self.id = id
        self.data = data
        self.filename = filename
        self.mimeType = mimeType
    }
}

// MARK: - Sheet

/// Sheet-presented delivery-proof form. The host owns the upload +
/// mark-completed roundtrip via `onSubmit`; on success the sheet flips
/// to its SUBMITTED confirmation. `onDismiss` tears the sheet down (the
/// host has already refreshed the task by then).
@MainActor
public struct DeliveryProofSheetView: View {
    public typealias Submit = @MainActor ([DeliveryProofPhoto], String?) async -> Bool

    /// Backend caps `completion_photos` at 10; we surface a tidier grid.
    private static let maxPhotos = 6

    private let target: DeliveryProofTarget
    private let onSubmit: Submit
    private let onDismiss: @MainActor () -> Void

    @State private var photos: [DeliveryProofPhoto] = []
    @State private var note: String = ""
    @State private var submitting = false
    @State private var submitted = false
    @State private var errorText: String?
    @State private var pickerItem: PhotosPickerItem?
    @State private var photoPickerPresented = false
    @State private var submittedAt = Date()

    public init(
        target: DeliveryProofTarget,
        onSubmit: @escaping Submit,
        onDismiss: @escaping @MainActor () -> Void
    ) {
        self.target = target
        self.onSubmit = onSubmit
        self.onDismiss = onDismiss
    }

    public var body: some View {
        Group {
            if submitted {
                submittedState
            } else {
                entryState
            }
        }
        .background(Theme.Color.appSurface)
        .presentationDetents(submitted ? [.medium] : [.large])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("deliveryProofSheet")
        .photosPicker(
            isPresented: $photoPickerPresented,
            selection: $pickerItem,
            matching: .images
        )
        .onChange(of: pickerItem) { _, newItem in
            handlePicked(newItem)
        }
    }

    // MARK: - State 1: ENTRY

    private var entryState: some View {
        VStack(spacing: 0) {
            entryHeader
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    photoProofSection
                    noteSection
                    trustLine
                    if let errorText, !errorText.isEmpty {
                        Text(errorText)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.error)
                            .accessibilityIdentifier("deliveryProof.error")
                    }
                }
                .padding(.horizontal, Spacing.s5)
                .padding(.top, Spacing.s4)
                .padding(.bottom, Spacing.s5)
            }
            submitButton
        }
    }

    private var entryHeader: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Confirm delivery")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text("Add a photo so the poster can release your payment.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s2)
            Button(action: onDismiss) {
                Icon(.x, size: 17, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(Theme.Color.appSurfaceSunken))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("deliveryProof.close")
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, Spacing.s3)
    }

    private var photoProofSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            overline("Photo proof *")
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.s2), count: 3),
                spacing: Spacing.s2
            ) {
                ForEach(photos) { photo in
                    photoThumb(photo)
                }
                if photos.count < Self.maxPhotos {
                    addTile
                }
            }
            Text("Show the completed work or the drop-off spot. At least one photo.")
                .font(.system(size: 11))
                .italic()
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func photoThumb(_ photo: DeliveryProofPhoto) -> some View {
        ZStack(alignment: .topTrailing) {
            proofImage(photo)
                .frame(height: 96)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            // Added-confirmation check badge (top-right).
            Icon(.check, size: 10, strokeWidth: 4, color: Theme.Color.appTextInverse)
                .frame(width: 20, height: 20)
                .background(Circle().fill(Theme.Color.success))
                .overlay(Circle().stroke(Theme.Color.appTextInverse, lineWidth: 2))
                .padding(Spacing.s1)
            // Remove (bottom-right).
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Button {
                        remove(photo)
                    } label: {
                        Icon(.x, size: 12, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
                            .frame(width: 22, height: 22)
                            .background(Circle().fill(Color.black.opacity(0.6)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove photo")
                    .accessibilityIdentifier("deliveryProof.removePhoto")
                }
            }
            .padding(Spacing.s1)
        }
    }

    /// Decoded thumbnail when the bytes are an image, else the gradient
    /// placeholder the design renders.
    private func proofImage(_ photo: DeliveryProofPhoto) -> some View {
        Group {
            if let uiImage = UIImage(data: photo.data) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
            } else {
                ZStack {
                    LinearGradient(
                        colors: [Theme.Color.appBorderStrong, Theme.Color.appTextSecondary],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    Icon(.image, size: 26, strokeWidth: 1.8, color: Theme.Color.appTextInverse)
                }
            }
        }
    }

    private var addTile: some View {
        Button {
            photoPickerPresented = true
        } label: {
            VStack(spacing: Spacing.s1) {
                Icon(.camera, size: 22, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                Text("Add")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 96)
            .background(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.appSurfaceMuted)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .strokeBorder(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1.5, dash: [5]))
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add photo")
        .accessibilityIdentifier("deliveryProof.photoUpload")
    }

    private var noteSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            overline("Note (optional)")
            TextField(
                "e.g. Left it by the side door as we agreed — thanks!",
                text: $note,
                axis: .vertical
            )
            .lineLimit(3...6)
            .font(Theme.Font.body)
            .foregroundStyle(Theme.Color.appText)
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
            .frame(minHeight: 74, alignment: .topLeading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityIdentifier("deliveryProof.note")
            Text("The poster sees this with your proof.")
                .font(.system(size: 11))
                .italic()
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var trustLine: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.shieldCheck, size: 16, strokeWidth: 2.2, color: Theme.Color.primary700)
            Text("Payment is released once the poster confirms — usually within a few hours.")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.primary700)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.primary50)
        )
    }

    private var submitButton: some View {
        Button {
            Task { await submit() }
        } label: {
            HStack(spacing: Spacing.s2) {
                if submitting {
                    ProgressView().tint(Theme.Color.appTextInverse)
                } else {
                    Text("Mark as delivered")
                        .font(.system(size: 15.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                    Icon(.checkCheck, size: 18, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(canSubmit ? Theme.Color.primary600 : Theme.Color.primary200)
            )
        }
        .buttonStyle(.plain)
        .disabled(!canSubmit || submitting)
        .padding(.horizontal, Spacing.s5)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s5)
        .accessibilityIdentifier("deliveryProof.submit")
    }
}

// MARK: - State 2: SUBMITTED + helpers

extension DeliveryProofSheetView {
    private var submittedState: some View {
        VStack(spacing: 0) {
            VStack(spacing: Spacing.s4) {
                Icon(.check, size: 36, strokeWidth: 3, color: Theme.Color.success)
                    .frame(width: 78, height: 78)
                    .background(Circle().fill(Theme.Color.successBg))
                    .overlay(Circle().stroke(Theme.Color.success.opacity(0.06), lineWidth: 8))
                    .padding(.top, Spacing.s5)

                VStack(spacing: Spacing.s2) {
                    Text("Delivery confirmed")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text("We’ve let the poster know. Payment releases once they confirm — usually within a few hours.")
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, Spacing.s4)

                recapCard
                    .padding(.horizontal, Spacing.s5)
            }

            Spacer(minLength: Spacing.s5)

            Button(action: onDismiss) {
                HStack(spacing: Spacing.s2) {
                    Text("Back to task")
                        .font(.system(size: 15.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                    Icon(.arrowRight, size: 18, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.primary600)
                )
            }
            .buttonStyle(.plain)
            .padding(.horizontal, Spacing.s5)
            .padding(.bottom, Spacing.s5)
            .accessibilityIdentifier("deliveryProof.backToTask")
        }
        .padding(.top, Spacing.s2)
        .accessibilityIdentifier("deliveryProof.submittedView")
    }

    private var recapCard: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                LinearGradient(
                    colors: [Theme.Color.appBorderStrong, Theme.Color.appTextSecondary],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                Icon(.image, size: 18, color: Theme.Color.appTextInverse)
            }
            .frame(width: 46, height: 46)
            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))

            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(recapTitle)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(recapTimestamp)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Icon(.checkCheck, size: 18, strokeWidth: 2.2, color: Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.appSurfaceMuted)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    // MARK: - Helpers

    private func overline(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .bold))
            .tracking(0.8)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.appTextMuted)
    }

    private var canSubmit: Bool {
        !photos.isEmpty
    }

    private var recapTitle: String {
        let count = photos.count
        let photoLabel = "\(count) photo\(count == 1 ? "" : "s")"
        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmedNote.isEmpty ? "Proof sent · \(photoLabel)" : "Proof sent · \(photoLabel), note"
    }

    private var recapTimestamp: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return "Today at \(formatter.string(from: submittedAt))"
    }

    private func remove(_ photo: DeliveryProofPhoto) {
        photos.removeAll { $0.id == photo.id }
    }

    private func handlePicked(_ newItem: PhotosPickerItem?) {
        guard let newItem else { return }
        Task {
            if let data = try? await newItem.loadTransferable(type: Data.self), !data.isEmpty {
                let filename = "proof-\(UUID().uuidString.prefix(6)).jpg"
                photos.append(DeliveryProofPhoto(data: data, filename: filename, mimeType: "image/jpeg"))
            }
            pickerItem = nil
        }
    }

    private func submit() async {
        guard canSubmit, !submitting else { return }
        submitting = true
        errorText = nil
        defer { submitting = false }
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let ok = await onSubmit(photos, trimmed.isEmpty ? nil : trimmed)
        if ok {
            submittedAt = Date()
            withAnimation { submitted = true }
        } else {
            errorText = "Couldn't send your proof. Check your connection and try again."
        }
    }
}

#Preview {
    Color.black.opacity(0.3)
        .sheet(isPresented: .constant(true)) {
            DeliveryProofSheetView(
                target: DeliveryProofTarget(id: "g1", gigId: "g1", gigTitle: "Move a mattress"),
                onSubmit: { _, _ in true },
                onDismiss: {}
            )
        }
}
