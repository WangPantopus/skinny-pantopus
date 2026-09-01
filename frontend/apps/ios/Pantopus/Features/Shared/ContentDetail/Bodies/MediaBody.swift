//
//  MediaBody.swift
//  Pantopus
//
//  `media` body slot for the Content Detail shell — a segmented control over
//  one or more media groups above a 2-up thumbnail grid. Replaces the former
//  `SegmentedMediaBodyStub` NotYetAvailable placeholder. Mirrors the A10.4
//  Post media grid and the transactional shell's `photoStrip` module (async
//  image with a gradient + glyph fallback).
//

import SwiftUI

/// Whether a tile is a still photo or a video (video gets a play overlay).
public enum MediaKind: Sendable, Hashable {
    case photo
    case video
}

/// A single media thumbnail. When `imageURL` is nil (or fails to load) the
/// tile falls back to a gradient + kind glyph, matching `photoStrip`.
public struct MediaItem: Sendable, Hashable, Identifiable {
    public let id: String
    public let imageURL: URL?
    public let caption: String?
    public let kind: MediaKind

    public init(id: String, imageURL: URL? = nil, caption: String? = nil, kind: MediaKind = .photo) {
        self.id = id
        self.imageURL = imageURL
        self.caption = caption
        self.kind = kind
    }
}

/// A labeled group of media surfaced as one segment.
public struct MediaSegment: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let items: [MediaItem]

    public init(id: String, label: String, items: [MediaItem]) {
        self.id = id
        self.label = label
        self.items = items
    }

    public var count: Int {
        items.count
    }
}

/// Segmented media body. The caller owns the selected-segment binding so the
/// host screen can deep-link to a group, mirroring `GridTabsBody` /
/// `StatsTabsBody`.
@MainActor
public struct MediaBody: View {
    private let segments: [MediaSegment]
    @Binding private var selectedSegment: String

    public init(segments: [MediaSegment], selectedSegment: Binding<String>) {
        self.segments = segments
        _selectedSegment = selectedSegment
    }

    private var active: MediaSegment? {
        segments.first { $0.id == selectedSegment } ?? segments.first
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if segments.count > 1 {
                segmentedControl
            }
            if let active, !active.items.isEmpty {
                grid(active.items)
            } else {
                emptyState
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("contentDetail.mediaBody")
        .accessibilityElement(children: .contain)
    }

    private var segmentedControl: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(segments) { segment in
                segmentButton(segment)
            }
        }
        .padding(Spacing.s1)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(Capsule())
    }

    private func segmentButton(_ segment: MediaSegment) -> some View {
        let isSelected = segment.id == active?.id
        return Button {
            selectedSegment = segment.id
        } label: {
            Text(segment.label)
                .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                .foregroundStyle(isSelected ? Theme.Color.appText : Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, minHeight: 32)
                .background(segmentPill(isSelected: isSelected))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(segment.label)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    @ViewBuilder
    private func segmentPill(isSelected: Bool) -> some View {
        if isSelected {
            Capsule()
                .fill(Theme.Color.appSurface)
                .pantopusShadow(.sm)
        } else {
            Capsule().fill(Color.clear)
        }
    }

    private func grid(_ items: [MediaItem]) -> some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: Spacing.s2),
                GridItem(.flexible(), spacing: Spacing.s2)
            ],
            spacing: Spacing.s2
        ) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                tile(item, index: index)
            }
        }
    }

    private func tile(_ item: MediaItem, index: Int) -> some View {
        ZStack {
            gradient(for: index)
            thumbnail(item)
        }
        .aspectRatio(1, contentMode: .fill)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            if item.kind == .video {
                playOverlay
            }
        }
        .overlay(alignment: .bottomLeading) {
            if let caption = item.caption {
                captionChip(caption)
            }
        }
        .accessibilityElement()
        .accessibilityLabel(item.caption ?? (item.kind == .video ? "Video" : "Photo"))
    }

    @ViewBuilder
    private func thumbnail(_ item: MediaItem) -> some View {
        if let url = item.imageURL {
            AsyncImage(url: url) { phase in
                switch phase {
                case let .success(image):
                    image.resizable().aspectRatio(contentMode: .fill)
                default:
                    placeholderGlyph(item.kind)
                }
            }
        } else {
            placeholderGlyph(item.kind)
        }
    }

    private func placeholderGlyph(_ kind: MediaKind) -> some View {
        Icon(
            kind == .video ? .video : .image,
            size: 24,
            strokeWidth: 1.8,
            color: Color.white.opacity(0.9)
        )
    }

    private var playOverlay: some View {
        Icon(.play, size: 18, color: Theme.Color.appText)
            .frame(width: 40, height: 40)
            .background(Color.white.opacity(0.85))
            .clipShape(Circle())
    }

    private func captionChip(_ text: String) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(.mapPin, size: 10, color: Theme.Color.appTextInverse)
            Text(text)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .lineLimit(1)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Color.black.opacity(0.55))
        .clipShape(Capsule())
        .padding(Spacing.s2)
    }

    private var emptyState: some View {
        EmptyState(
            icon: .image,
            headline: "No media yet",
            subcopy: "Photos and clips will appear here."
        )
        .frame(maxWidth: .infinity, minHeight: 200)
    }

    private func gradient(for index: Int) -> LinearGradient {
        let palettes: [[Color]] = [
            [Theme.Color.primary500, Theme.Color.primary800],
            [Theme.Color.business, Theme.Color.businessDark],
            [Theme.Color.home, Theme.Color.homeDark],
            [Theme.Color.warmAmber, Theme.Color.primary900]
        ]
        let colors = palettes[index % palettes.count]
        return LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

#Preview("Segmented media") {
    @Previewable @State var segment = "all"
    ScrollView {
        MediaBody(
            segments: [
                MediaSegment(
                    id: "all",
                    label: "All",
                    items: [
                        MediaItem(id: "1", caption: "5th & Elm"),
                        MediaItem(id: "2", kind: .video),
                        MediaItem(id: "3"),
                        MediaItem(id: "4", caption: "Back porch")
                    ]
                ),
                MediaSegment(
                    id: "video",
                    label: "Video",
                    items: [MediaItem(id: "2", kind: .video)]
                )
            ],
            selectedSegment: $segment
        )
        .padding(.vertical, Spacing.s4)
    }
    .background(Theme.Color.appBg)
}
