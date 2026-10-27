//
//  PulseComposeAssistCard.swift
//  Pantopus
//
//  The composer's AI assist card, at the top of a new post: it writes the
//  whole post from the photos, the place and the person's words
//  (`PulseComposeViewModel+Assist.swift`). With nothing to go on yet it offers
//  to take or choose a photo, and the suggestion follows on its own. Mirrors
//  Android `PulseComposeAssistCard`.
//

import SwiftUI

struct PulseComposeAssistCard: View {
    let assist: PulseComposeAssistState
    /// A photo or words in the form to write from.
    let hasMaterial: Bool
    /// How many of the attachments the suggestion reads.
    let photoCount: Int
    let canUndo: Bool
    let canTakePhoto: Bool
    let onSuggest: () -> Void
    let onUndo: () -> Void
    let onTakePhoto: () -> Void
    let onChoosePhotos: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.sparkles, size: 18, strokeWidth: 2, color: Theme.Color.primary600)
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("Write it with AI")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text(message)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(isFailure ? Theme.Color.error : Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("composePulseAssistMessage")
                    if case let .suggested(note?) = assist, !note.isEmpty {
                        Text(note)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appText)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("composePulseAssistNote")
                    }
                }
                Spacer(minLength: 0)
            }
            actions
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("composePulseAssist")
    }

    private var isFailure: Bool {
        if case .failed = assist { return true }
        return false
    }

    private var message: String {
        switch assist {
        case .writing:
            return "Writing your post…"
        case .suggested:
            return "Suggested by AI. Check it and change anything before you post."
        case let .failed(reason):
            return reason
        case .idle:
            guard hasMaterial else {
                return "Add a photo and Pantopus suggests the whole post. You can change anything before you post."
            }
            let source = switch photoCount {
            case 0: "finish this post from what you wrote"
            case 1: "write this post from your photo"
            default: "write this post from your photos"
            }
            return "Pantopus can \(source). You can change anything before you post."
        }
    }

    @ViewBuilder private var actions: some View {
        switch assist {
        case .writing:
            ProgressView()
                .tint(Theme.Color.primary600)
                .accessibilityLabel("Writing your post")
                .accessibilityIdentifier("composePulseAssistWriting")
        case .suggested:
            HStack(spacing: Spacing.s2) {
                if canUndo {
                    CompactButton(title: "Undo", icon: .undo2, variant: .ghost, action: onUndo)
                        .accessibilityIdentifier("composePulseAssistUndo")
                }
                CompactButton(title: "Try again", icon: .sparkles, variant: .ghost, action: onSuggest)
                    .accessibilityIdentifier("composePulseAssistRetry")
            }
        case .idle, .failed:
            if hasMaterial {
                HStack(spacing: Spacing.s2) {
                    // A retry that failed leaves the first suggestion in the form, and its Undo.
                    if assist != .idle, canUndo {
                        CompactButton(title: "Undo", icon: .undo2, variant: .ghost, action: onUndo)
                            .accessibilityIdentifier("composePulseAssistUndo")
                    }
                    CompactButton(title: assist == .idle ? "Suggest post" : "Try again", icon: .sparkles, action: onSuggest)
                        .accessibilityIdentifier("composePulseAssistSuggest")
                }
            } else {
                HStack(spacing: Spacing.s2) {
                    if canTakePhoto {
                        CompactButton(title: "Take photo", icon: .camera, action: onTakePhoto)
                            .accessibilityIdentifier("composePulseAssistTakePhoto")
                    }
                    CompactButton(
                        title: "Choose photos",
                        icon: .image,
                        variant: canTakePhoto ? .ghost : .primary,
                        action: onChoosePhotos
                    )
                    .accessibilityIdentifier("composePulseAssistChoosePhotos")
                }
            }
        }
    }
}
