//
//  HolidayCardPhotoRow.swift
//  Pantopus
//
//  "Add a photo" on Write on the back (memories plan step 4, `holiday_card_memories`; wave 4 drawings 1 and 2), under
//  the note, which stays first and required. The system photo picker (no permission asked), then the print with its
//  upload progress, Replace and Remove, a failed upload's words with Try again and Remove, and the photo's optional
//  description for screen readers. Web's Write on the back has the same row.
//

import PhotosUI
import SwiftUI

struct HolidayCardPhotoRow: View {
    @Bindable var attachments: HolidayCardAttachments
    @State private var picked: PhotosPickerItem?
    @State private var picking = false
    @FocusState private var describing: Bool
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if let photo = attachments.photo {
                HStack(alignment: .top, spacing: Spacing.s4) {
                    CardPrintView(
                        source: photo.stored.map { .own(fileId: $0.fileId) },
                        localImage: photo.preview,
                        aspect: photo.stored?.aspect ?? photo.preview.map { $0.size.width / max($0.size.height, 1) } ?? 4 / 3,
                        alt: attachments.photoAlt.isEmpty ? nil : attachments.photoAlt,
                        uploading: photo.status == .uploading
                    )
                    .frame(maxWidth: 170)
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        status(photo)
                        controls(photo)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("sendCardPhoto")
                describe
            } else {
                HolidayCardPaperButton(title: "Add a photo", isPressed: false) { open() }
                    .accessibilityIdentifier("sendCardAddPhoto")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .photosPicker(isPresented: $picking, selection: $picked, matching: .images, preferredItemEncoding: .current)
        .onChange(of: picked) { _, item in
            guard let item else { return }
            picked = nil
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self) else { return }
                attachments.add(data)
            }
        }
    }

    private func open() {
        Keyboard.close()
        picking = true
    }

    @ViewBuilder
    private func status(_ photo: HolidayCardAttachments.Photo) -> some View {
        switch photo.status {
        case .uploading:
            Text(verbatim: photo.progress > 0 ? "Uploading… \(Int((photo.progress * 100).rounded()))%" : "Uploading…")
                .font(.system(size: 13))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .monospacedDigit()
                .accessibilityIdentifier("sendCardPhotoStatus")
        case .ready:
            Text("Added.")
                .font(.system(size: 13))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .accessibilityIdentifier("sendCardPhotoStatus")
        case let .failed(sentence):
            Text(verbatim: sentence)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(HolidayCardDesk.error(scheme))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("sendCardPhotoError")
        }
    }

    private func controls(_ photo: HolidayCardAttachments.Photo) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if case .failed = photo.status {
                HolidayCardPaperButton(title: "Try again", isPressed: false) { attachments.retry() }
                    .accessibilityIdentifier("sendCardPhotoRetry")
            } else {
                HolidayCardPaperButton(title: "Replace", isPressed: false) { open() }
                    .accessibilityIdentifier("sendCardPhotoReplace")
            }
            HolidayCardPaperButton(title: "Remove", isPressed: false) { attachments.remove() }
                .accessibilityIdentifier("sendCardPhotoRemove")
        }
    }

    private var describe: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Describe the photo (optional, for screen readers)")
                .font(.system(size: 13))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityHidden(true)
            TextField("", text: $attachments.photoAlt)
                .font(.system(size: 15))
                .foregroundStyle(MailPaper.cardText)
                .submitLabel(.done)
                .focused($describing)
                .padding(.horizontal, Spacing.s3)
                .frame(minHeight: 44)
                .typesInFieldOnTap($describing)
                .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .strokeBorder(describing ? MailPaper.wax : MailPaper.cardFieldEdge, lineWidth: 1)
                )
                .accessibilityLabel("Describe the photo, optional, for screen readers")
                .accessibilityIdentifier("sendCardPhotoAlt")
        }
    }
}
