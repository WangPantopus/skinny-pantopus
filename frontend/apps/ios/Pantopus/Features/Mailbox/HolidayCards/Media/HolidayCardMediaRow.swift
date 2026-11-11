//
//  HolidayCardMediaRow.swift
//  Pantopus
//
//  "Add a photo" and "Record a greeting" on Write on the back (memories plan steps 4 and 7, `holiday_card_memories`;
//  wave 4 drawings 1 and 2), under the note, which stays first and required. The photo comes from the system picker
//  (no permission asked) and uploads with its own progress; the greeting records once the microphone is allowed (asked
//  on the tap) and uploads when it stops. Each shows with its own buttons, side by side, and a failed upload keeps the
//  note and offers Try again or Remove. Web's Write on the back has the same row.
//

import PhotosUI
import SwiftUI

struct HolidayCardMediaRow: View {
    @Bindable var attachments: HolidayCardAttachments
    let takesPhoto: Bool
    let takesVoice: Bool
    /// Who the greeting is for ("For Maya") and the card's mood (a gift tag for Christmas with Jesus Christ).
    let forName: String
    let gift: Bool

    @State private var picked: PhotosPickerItem?
    @State private var picking = false
    @State private var listen = HolidayCardGreetingPlayer()
    @FocusState private var describing: Bool
    @Environment(\.colorScheme) private var scheme

    private var showsPhoto: Bool {
        takesPhoto || attachments.photo != nil
    }

    private var showsVoice: Bool {
        takesVoice || attachments.voice != nil || attachments.recorder.recording
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if attachments.photo == nil, attachments.voice == nil, !attachments.recorder.recording {
                HStack(spacing: Spacing.s2) {
                    if showsPhoto { addPhoto }
                    if showsVoice { record }
                    Spacer(minLength: 0)
                }
            } else {
                HStack(alignment: .top, spacing: Spacing.s4) {
                    Group {
                        if let photo = attachments.photo {
                            photoCell(photo)
                        } else if showsPhoto {
                            addPhoto
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    Group {
                        if attachments.recorder.recording {
                            recordingCell
                        } else if let voice = attachments.voice {
                            voiceCell(voice)
                        } else if showsVoice {
                            record
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                }
            }
            if let refused = attachments.recorder.refused {
                Text(verbatim: refused)
                    .font(.system(size: 13))
                    .foregroundStyle(HolidayCardDesk.muted(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("sendCardMicRefused")
            }
            if attachments.photo != nil { describe }
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
        .onAppear { listen.set(source: nil, local: attachments.voice?.upload) }
        .onChange(of: attachments.voice?.upload) { _, data in listen.set(source: nil, local: data) }
        .onDisappear { listen.stop() }
    }

    // MARK: The photo

    private var addPhoto: some View {
        HolidayCardPaperButton(title: "Add a photo", isPressed: false) {
            Keyboard.close()
            picking = true
        }
        .accessibilityIdentifier("sendCardAddPhoto")
    }

    private func photoCell(_ photo: HolidayCardAttachments.Photo) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            CardPrintView(
                source: photo.stored.map { .own(fileId: $0.fileId) },
                localImage: photo.preview,
                aspect: photo.stored?.aspect ?? photo.preview.map { $0.size.width / max($0.size.height, 1) } ?? 4 / 3,
                alt: attachments.photoAlt.isEmpty ? nil : attachments.photoAlt,
                uploading: photo.status == .uploading
            )
            .frame(maxWidth: 170)
            status(photo.status, progress: photo.progress, identifier: "sendCardPhotoStatus")
            if case .failed = photo.status {
                HolidayCardPaperButton(title: "Try again", isPressed: false) { attachments.retry() }
                    .accessibilityIdentifier("sendCardPhotoRetry")
            } else {
                HolidayCardPaperButton(title: "Replace", isPressed: false) {
                    Keyboard.close()
                    picking = true
                }
                .accessibilityIdentifier("sendCardPhotoReplace")
            }
            HolidayCardPaperButton(title: "Remove", isPressed: false) { attachments.remove() }
                .accessibilityIdentifier("sendCardPhotoRemove")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sendCardPhoto")
    }

    // MARK: The greeting

    private var record: some View {
        HolidayCardPaperButton(title: "Record a greeting", isPressed: false) {
            Keyboard.close()
            listen.stop()
            Task { await attachments.recorder.start() }
        }
        .accessibilityIdentifier("sendCardRecord")
    }

    private var recordingCell: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            CardGreetingObject(forName: forName, gift: gift, turning: true, recording: true, tilt: 2)
                .frame(maxWidth: 160)
            Text(verbatim: "● Recording \(HolidayCardGreetingWords.clock(attachments.recorder.elapsed)) of 1:00")
                .font(.system(size: 13))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .monospacedDigit()
                .accessibilityIdentifier("sendCardRecording")
            HolidayCardPaperButton(title: "Stop", isPressed: false) { attachments.recorder.stop() }
                .accessibilityIdentifier("sendCardRecordStop")
        }
    }

    private func voiceCell(_ voice: HolidayCardAttachments.Voice) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            CardGreetingObject(
                forName: forName,
                gift: gift,
                turning: listen.playing,
                durationMs: voice.stored?.durationMs,
                tilt: 2
            )
            .frame(maxWidth: 160)
            status(voice.status, progress: 0, identifier: "sendCardVoiceStatus")
            if case .failed = voice.status {
                HolidayCardPaperButton(title: "Try again", isPressed: false) { attachments.retryVoice() }
                    .accessibilityIdentifier("sendCardVoiceRetry")
            } else {
                HolidayCardPaperButton(
                    title: listen.playing
                        ? "❚❚ Pause"
                        : "▶ Listen" + (voice.stored?.durationMs).map { " \(HolidayCardGreetingWords.length($0))" }.orEmpty,
                    isPressed: listen.playing
                ) {
                    Task { await listen.toggle() }
                }
                .accessibilityIdentifier("sendCardListen")
            }
            if takesVoice {
                HolidayCardPaperButton(title: "Record again", isPressed: false) {
                    listen.stop()
                    Task { await attachments.recorder.start() }
                }
                .accessibilityIdentifier("sendCardRecordAgain")
            }
            HolidayCardPaperButton(title: "Remove", isPressed: false) {
                listen.stop()
                attachments.removeVoice()
            }
            .accessibilityIdentifier("sendCardVoiceRemove")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sendCardVoice")
    }

    // MARK: Shared

    @ViewBuilder
    private func status(_ status: HolidayCardAttachments.PhotoStatus, progress: Double, identifier: String) -> some View {
        switch status {
        case .uploading:
            Text(verbatim: progress > 0 ? "Uploading… \(Int((progress * 100).rounded()))%" : "Uploading…")
                .font(.system(size: 13))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .monospacedDigit()
                .accessibilityIdentifier(identifier)
        case .ready:
            Text("Added.")
                .font(.system(size: 13))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .accessibilityIdentifier(identifier)
        case let .failed(sentence):
            Text(verbatim: sentence)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(HolidayCardDesk.error(scheme))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier(identifier)
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

private extension String? {
    var orEmpty: String {
        self ?? ""
    }
}
