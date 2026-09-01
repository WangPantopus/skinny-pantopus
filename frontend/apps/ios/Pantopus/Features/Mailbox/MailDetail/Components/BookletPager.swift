//
//  BookletPager.swift
//  Pantopus
//
//  T6.5c (P21) — Booklet variant of the A17 shell's body slot.
//
//  Two render modes per `booklet.jsx`:
//    - `.page` — indicator strip ("Page N of M" + sky scrubber +
//      grid-mode toggle button) above a full-width `TabView` swiping
//      through folded paper page images.
//    - `.grid` — 3-column thumbnail grid; tap a thumbnail to jump
//      straight back to `.page` mode at that page.
//
//  Lives in the feature folder per the P21 brief — the swipeable
//  paper-page geometry doesn't generalise to other mail variants.
//  Community attachments (P22) use a different shape.
//

import SwiftUI

/// Rendering mode for the pager. Exposed at the view init so the variant
/// view can persist the mode in its caller (e.g. across re-renders).
public enum BookletPagerMode: Sendable, Hashable {
    case page
    case grid
}

@MainActor
public struct BookletPager: View {
    private let pages: [URL]
    private let pageCount: Int
    private let ocrTexts: [String]
    @State private var currentIndex: Int
    @State private var mode: BookletPagerMode

    public init(
        pages: [URL],
        pageCount: Int? = nil,
        ocrTexts: [String] = [],
        initialPage: Int = 0,
        initialMode: BookletPagerMode = .page
    ) {
        self.pages = pages
        self.pageCount = max(pageCount ?? pages.count, pages.count)
        self.ocrTexts = ocrTexts
        _currentIndex = State(initialValue: max(0, min(initialPage, max(0, pages.count - 1))))
        _mode = State(initialValue: initialMode)
    }

    public var body: some View {
        VStack(spacing: Spacing.s2) {
            switch mode {
            case .page:
                pageMode
            case .grid:
                gridMode
            }
        }
        .accessibilityIdentifier("bookletPager")
    }

    // MARK: - Page mode

    private var pageMode: some View {
        VStack(spacing: Spacing.s2) {
            pageIndicator
            TabView(selection: $currentIndex) {
                ForEach(Array(pages.enumerated()), id: \.offset) { idx, url in
                    BookletPageImage(
                        url: url,
                        pageNumber: idx + 1,
                        hasNextPage: idx < pageCount - 1
                    )
                    .tag(idx)
                    .padding(.horizontal, Spacing.s4)
                    .accessibilityIdentifier("bookletPager_page_\(idx)")
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 420)
            if let ocrText = ocrText(for: currentIndex) {
                BookletOCRCard(text: ocrText)
            }
        }
    }

    /// A17.2 — per-page OCR transcript, when the sample data carries one.
    private func ocrText(for index: Int) -> String? {
        guard ocrTexts.indices.contains(index) else { return nil }
        let text = ocrTexts[index]
        return text.isEmpty ? nil : text
    }

    private var pageIndicator: some View {
        VStack(spacing: Spacing.s2) {
            HStack(alignment: .center, spacing: Spacing.s2) {
                Button {
                    currentIndex = max(0, currentIndex - 1)
                } label: {
                    Icon(.chevronLeft, size: 14, color: Theme.Color.appTextStrong)
                        .frame(width: 32, height: 32)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(currentIndex == 0)
                .accessibilityLabel("Previous page")
                .accessibilityIdentifier("bookletPager_prev")
                VStack(alignment: .center, spacing: 1) {
                    HStack(spacing: Spacing.s1) {
                        Text("Page \(currentIndex + 1)")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        Text("of \(pageCount)")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    .accessibilityLabel("Page \(currentIndex + 1) of \(pageCount)")
                    .accessibilityIdentifier("bookletPager_pageLabel")
                }
                .frame(maxWidth: .infinity)
                Button {
                    currentIndex = min(pages.count - 1, currentIndex + 1)
                } label: {
                    Icon(.chevronRight, size: 14, color: Theme.Color.appTextStrong)
                        .frame(width: 32, height: 32)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(currentIndex >= pages.count - 1)
                .accessibilityLabel("Next page")
                .accessibilityIdentifier("bookletPager_next")
            }
            scrubber
            Button {
                mode = .grid
            } label: {
                HStack(spacing: Spacing.s1) {
                    Icon(.fileType, size: 12, color: Theme.Color.primary600)
                    Text("View all pages")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary600)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.primary50)
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("bookletPager_toggleGrid")
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }

    private var scrubber: some View {
        GeometryReader { proxy in
            let totalSegments = max(1, pageCount - 1)
            let filled = pageCount <= 1
                ? proxy.size.width
                : proxy.size.width * CGFloat(currentIndex) / CGFloat(totalSegments)
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(height: 4)
                Capsule()
                    .fill(Theme.Color.primary600)
                    .frame(width: max(4, filled), height: 4)
            }
        }
        .frame(height: 4)
        .accessibilityHidden(true)
    }

    // MARK: - Grid mode

    private var gridMode: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(alignment: .center, spacing: Spacing.s2) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("ALL PAGES")
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.5)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .accessibilityAddTraits(.isHeader)
                    Text("Tap a thumbnail to jump there")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                Text("\(pageCount) pages")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, Spacing.s1)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.s2), count: 3),
                spacing: Spacing.s2
            ) {
                ForEach(Array(pages.enumerated()), id: \.offset) { idx, url in
                    Button {
                        currentIndex = idx
                        mode = .page
                    } label: {
                        ThumbnailCell(
                            url: url,
                            page: idx + 1,
                            isCurrent: idx == currentIndex,
                            hasNextPage: idx < pageCount - 1
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Jump to page \(idx + 1)")
                    .accessibilityIdentifier("bookletPager_thumb_\(idx)")
                }
            }
            .padding(Spacing.s3)
            HStack {
                Spacer()
                Button {
                    mode = .page
                } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.chevronLeft, size: 12, color: Theme.Color.primary600)
                        Text("Back to reader")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.Color.primary600)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s1)
                    .background(Theme.Color.primary50)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("bookletPager_togglePage")
                Spacer()
            }
            .padding(.bottom, Spacing.s3)
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }
}

private struct BookletPageImage: View {
    let url: URL
    let pageNumber: Int
    let hasNextPage: Bool

    var body: some View {
        BookletPaperPageChrome(hasNextPage: hasNextPage) {
            AsyncImage(url: url) { phase in
                switch phase {
                case let .success(image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .failure:
                    fallback(icon: .alertCircle, label: "Couldn't load page")
                case .empty:
                    fallback(icon: .fileType, label: "Loading...")
                @unknown default:
                    fallback(icon: .fileType, label: "")
                }
            }
        }
        .accessibilityLabel("Booklet page \(pageNumber)")
    }

    private func fallback(icon: PantopusIcon, label: String) -> some View {
        ZStack {
            Theme.Color.appSurfaceSunken
            VStack(spacing: Spacing.s2) {
                Icon(icon, size: 24, color: Theme.Color.appTextMuted)
                if !label.isEmpty {
                    Text(label)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct ThumbnailCell: View {
    let url: URL
    let page: Int
    let isCurrent: Bool
    let hasNextPage: Bool

    var body: some View {
        ZStack(alignment: .topTrailing) {
            BookletPaperPageChrome(
                hasNextPage: hasNextPage,
                foldSize: Spacing.s4,
                cornerRadius: Radii.sm
            ) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case let .success(image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    case .failure, .empty:
                        Rectangle()
                            .fill(Theme.Color.appSurfaceSunken)
                    @unknown default:
                        Rectangle()
                            .fill(Theme.Color.appSurfaceSunken)
                    }
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: Radii.sm)
                    .stroke(
                        isCurrent ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isCurrent ? 2.5 : 1
                    )
            )
            VStack(alignment: .trailing, spacing: Spacing.s0) {
                if isCurrent {
                    Icon(.eye, size: 10, color: Theme.Color.appTextInverse)
                        .frame(width: 18, height: 18)
                        .background(Theme.Color.primary600)
                        .clipShape(Circle())
                        .padding(Spacing.s1)
                }
                Spacer(minLength: Spacing.s0)
                Text("\(page)")
                    .font(.system(size: 10, weight: .bold, design: .serif))
                    .italic()
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s1)
                    .padding(.bottom, Spacing.s1)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
    }
}

/// OCR transcript card (booklet.jsx OCRCard): scan chip + "Text from this
/// page" header with the OCR confidence pill, the per-page transcript
/// (first line = overline, second = title, rest = body), and inert
/// Copy / Translate / Read aloud actions.
private struct BookletOCRCard: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            transcript
            VStack(alignment: .leading, spacing: 10) {
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                HStack(spacing: 14) {
                    action(icon: .copy, label: "Copy text", color: Theme.Color.primary600)
                    action(icon: .globe, label: "Translate", color: Theme.Color.appTextMuted)
                    action(icon: .megaphone, label: "Read aloud", color: Theme.Color.appTextMuted)
                }
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("bookletPager_ocrCard")
    }

    private var header: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.scanLine, size: 13, color: Theme.Color.appTextSecondary)
                .frame(width: 22, height: 22)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
            Text("Text from this page")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityAddTraits(.isHeader)
            Text("OCR · 99%")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.success)
                .padding(.horizontal, 7)
                .padding(.vertical, 2)
                .background(Theme.Color.successBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
        }
    }

    /// Transcript lines map onto the JSX kinds by position: line 0 is the
    /// overline, line 1 the title, the remainder body copy.
    private var transcript: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(text.components(separatedBy: "\n").enumerated()), id: \.offset) { idx, line in
                switch idx {
                case 0:
                    Text(line)
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.8)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Color.appTextMuted)
                case 1:
                    Text(line)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                default:
                    Text(line)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineSpacing(3)
                }
            }
        }
    }

    private func action(icon: PantopusIcon, label: String, color: Color) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(icon, size: 12, color: color)
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(color)
        }
    }
}

#Preview {
    BookletPager(pages: [
        "https://placehold.co/360x480",
        "https://placehold.co/360x480/orange/white",
        "https://placehold.co/360x480/blue/white",
        "https://placehold.co/360x480/green/white",
        "https://placehold.co/360x480/red/white",
        "https://placehold.co/360x480/purple/white"
    ].compactMap(URL.init(string:)), pageCount: 6)
        .padding()
        .background(Theme.Color.appBg)
}
