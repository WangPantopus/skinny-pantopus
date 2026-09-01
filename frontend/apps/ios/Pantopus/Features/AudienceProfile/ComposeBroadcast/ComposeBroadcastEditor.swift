//
//  ComposeBroadcastEditor.swift
//  Pantopus
//
//  A.7 (A22.2) — The composer card from the Compose Broadcast screen,
//  extracted as its own view for testability. Renders the PersonaRow,
//  the auto-growing body editor (grows with content up to a max height,
//  then scrolls internally), the optional media preview with a remove
//  affordance, and the counter row (media-add button + audience chip +
//  live character count).
//

import SwiftUI

struct ComposeBroadcastEditor: View {
    let persona: BroadcastPersona
    @Binding var text: String
    let media: [ComposeMediaPreview]
    let audience: BroadcastAudience
    let audienceReach: Int?
    let characterCount: Int
    let maxCharacterCount: Int
    let isOverLimit: Bool
    let placeholder: String
    let onAddMedia: @MainActor () -> Void
    let onRemoveMedia: @MainActor (String) -> Void
    let onChangeAudience: @MainActor () -> Void

    @State private var measuredHeight: CGFloat = 0

    private let minEditorHeight: CGFloat = 140
    private let maxEditorHeight: CGFloat = 300
    private let bodyFont = Font.system(size: 15)

    private var editorHeight: CGFloat {
        min(max(measuredHeight, minEditorHeight), maxEditorHeight)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            personaRow
            bodyEditor
            if !media.isEmpty {
                mediaGrid
            }
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(height: 1)
            counterRow
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("composeBroadcastEditor")
    }

    // MARK: - Persona

    private var personaRow: some View {
        HStack(spacing: Spacing.s2) {
            ZStack {
                Circle().fill(persona.kind.accent)
                Text(persona.avatarInitial)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(width: 36, height: 36)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 1) {
                Text(persona.handle)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Sending as \(persona.kind.label)")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            pillarChip
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(persona.handle), sending as \(persona.kind.label)")
        .accessibilityIdentifier("composeBroadcastPersona")
    }

    private var pillarChip: some View {
        Text(persona.kind.label.uppercased())
            .font(.system(size: 9, weight: .bold))
            .kerning(0.4)
            .foregroundStyle(persona.kind.accent)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(persona.kind.accent.opacity(0.12))
            .clipShape(Capsule())
            .accessibilityHidden(true)
    }

    // MARK: - Body editor

    private var bodyEditor: some View {
        ZStack(alignment: .topLeading) {
            // Hidden mirror measures the rendered text height so the
            // editor can grow with content up to `maxEditorHeight`.
            Text(text.isEmpty ? placeholder : text)
                .font(bodyFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 5)
                .padding(.vertical, Spacing.s2)
                .background(
                    GeometryReader { proxy in
                        Color.clear.preference(key: EditorHeightKey.self, value: proxy.size.height)
                    }
                )
                .hidden()

            if text.isEmpty {
                Text(placeholder)
                    .font(bodyFont)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.horizontal, 5)
                    .padding(.vertical, Spacing.s2)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }

            TextEditor(text: $text)
                .font(bodyFont)
                .foregroundStyle(Theme.Color.appText)
                .scrollContentBackground(.hidden)
                .frame(height: editorHeight)
                .accessibilityIdentifier("composeBroadcastBodyInput")
                .accessibilityLabel("Broadcast message")
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .onPreferenceChange(EditorHeightKey.self) { measuredHeight = $0 }
    }

    // MARK: - Media

    /// Up to nine attachments. One item keeps the full-bleed preview the
    /// design shows; two or more tile into a 3-up grid.
    @ViewBuilder private var mediaGrid: some View {
        if media.count == 1, let only = media.first {
            mediaTile(only, height: 160)
        } else {
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.s2), count: 3),
                spacing: Spacing.s2
            ) {
                ForEach(media) { item in
                    mediaTile(item, height: 92)
                }
            }
            .accessibilityIdentifier("composeBroadcastMediaGrid")
        }
    }

    private func mediaTile(_ media: ComposeMediaPreview, height: CGFloat) -> some View {
        ZStack(alignment: .topTrailing) {
            Group {
                if media.kind == .image, let data = media.data, let image = UIImage(data: data) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    Rectangle()
                        .fill(Theme.Color.appSurfaceSunken)
                        .overlay {
                            Icon(
                                media.kind == .video ? .video : .image,
                                size: 28,
                                color: Theme.Color.appTextMuted
                            )
                        }
                }
            }
            .frame(height: height)
            .frame(maxWidth: .infinity)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .accessibilityIdentifier("composeBroadcastMediaPreview")
            .accessibilityLabel(media.caption.map { "Attached media: \($0)" } ?? "Attached media")

            Button { onRemoveMedia(media.id) } label: {
                Icon(.x, size: 14, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
                    .frame(width: 28, height: 28)
                    .background(Color.black.opacity(0.55))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .padding(Spacing.s2)
            .accessibilityLabel("Remove media")
            .accessibilityIdentifier("composeBroadcastRemoveMedia")

            if let caption = media.caption, height > 120 {
                captionOverlay(caption)
            }
        }
    }

    private func captionOverlay(_ caption: String) -> some View {
        HStack(spacing: 5) {
            Icon(.image, size: 11, color: Theme.Color.appTextInverse)
            Text(caption)
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .lineLimit(1)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Color.black.opacity(0.45))
        .clipShape(Capsule())
        .padding(Spacing.s2)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    // MARK: - Counter row

    /// True once the nine-attachment cap is reached.
    private var isFull: Bool {
        media.count >= ComposeBroadcastDraft.mediaLimit
    }

    private var counterRow: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onAddMedia) {
                HStack(spacing: 3) {
                    Icon(.imagePlus, size: 20, color: isFull ? Theme.Color.appTextMuted : Theme.Color.appTextStrong)
                    // Counter appears only once a second item is attached, so
                    // the single-attachment frame stays visually unchanged.
                    if media.count > 1 {
                        Text("\(media.count)/\(ComposeBroadcastDraft.mediaLimit)")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextMuted)
                            .monospacedDigit()
                            .accessibilityIdentifier("composeBroadcastMediaCount")
                    }
                }
                .frame(minWidth: 44, minHeight: 44)
            }
            .buttonStyle(.plain)
            .disabled(isFull)
            .accessibilityLabel(
                isFull
                    ? "Attachment limit reached, 9 of 9"
                    : "Add photos or videos, \(media.count) of \(ComposeBroadcastDraft.mediaLimit) attached"
            )
            .accessibilityIdentifier("composeBroadcastAddMedia")

            audienceChip

            Spacer(minLength: Spacing.s2)

            Text("\(characterCount) / \(maxCharacterCount)")
                .font(.system(size: 11, weight: isOverLimit ? .semibold : .regular))
                .foregroundStyle(isOverLimit ? Theme.Color.warning : Theme.Color.appTextMuted)
                .monospacedDigit()
                .accessibilityLabel("\(characterCount) of \(maxCharacterCount) characters")
                .accessibilityIdentifier("composeBroadcastCounter")
        }
    }

    private var audienceChip: some View {
        let accent = Self.audienceColor(audience)
        return Button(action: onChangeAudience) {
            HStack(spacing: 5) {
                Icon(audience.icon, size: 11, color: accent)
                Text(audienceChipLabel)
                    .font(.system(size: 11, weight: .bold))
                    .kerning(0.2)
                    .foregroundStyle(accent)
                    .lineLimit(1)
                Icon(.chevronDown, size: 11, color: accent)
            }
            .padding(.horizontal, Spacing.s2)
            .frame(minHeight: 44)
            .background(accent.opacity(0.10))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Audience: \(audience.title). Tap to change.")
        .accessibilityIdentifier("composeBroadcastAudienceChip")
    }

    private var audienceChipLabel: String {
        if let reach = audienceReach {
            return "\(audience.title) · \(reach.formatted())"
        }
        return audience.title
    }

    /// All-beacons follows the primary accent; tier-locked options borrow
    /// the persona tier ladder coloring used across the audience surface.
    static func audienceColor(_ audience: BroadcastAudience) -> Color {
        guard let rank = audience.tierRank else { return Theme.Color.primary600 }
        return AudienceProfileView.tierColor(rank: rank)
    }
}

private struct EditorHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}
