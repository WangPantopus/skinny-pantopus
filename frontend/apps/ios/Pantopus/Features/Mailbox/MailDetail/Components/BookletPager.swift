//
//  BookletPager.swift
//  Pantopus
//
//  A stored booklet's pages (founder, 2026-11-04, "Build it as drawn"). The
//  booklet opens to its page: the page comes first, as large as fits above
//  the letter's pinned actions, with one slim row of controls under it and
//  the page's transcript below. Where two pages fit nearly as tall as one,
//  such as the open iPhone Duo held sideways, two facing pages lie open with
//  the spine on the hinge (`BookletReaderLayout`). Page and grid selection
//  belong to the reader and survive folding, unfolding and turning.
//

import SwiftUI

/// Page or thumbnail presentation of a booklet.
public enum BookletPagerMode: Sendable, Hashable {
    case page
    case grid
}

/// Where a booklet's reader is: the page (a spread's left page) and whether all pages show.
struct BookletPlace: Equatable {
    var page = 0
    var mode = BookletPagerMode.page
}

@MainActor
public struct BookletPager: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.mailItemReadingArea) private var readingArea
    private let pages: [URL]
    private let pageCount: Int
    private let ocrTexts: [String]
    private let onShowPage: () -> Void
    /// Tells the page's model where the reader is, so a new layout (folding, turning) opens it there.
    private let onPlaceChange: (BookletPlace) -> Void
    @State private var currentIndex: Int
    @State private var mode: BookletPagerMode
    /// The reader's width, the screen's side margins beside it, its controls' height, and the Duo's hinge: what
    /// the pages size themselves from.
    @State private var readerWidth: CGFloat = 0
    @State private var screenMargin: CGFloat = 0
    @State private var controlsHeight: CGFloat = 0
    @State private var hinge: BookletHinge?

    public init(
        pages: [URL],
        pageCount: Int? = nil,
        ocrTexts: [String] = [],
        initialPage: Int = 0,
        initialMode: BookletPagerMode = .page,
        onShowPage: @escaping () -> Void = {},
        onPlaceChange: @escaping (BookletPlace) -> Void = { _ in }
    ) {
        self.pages = pages
        self.pageCount = max(pageCount ?? pages.count, pages.count)
        self.ocrTexts = ocrTexts
        self.onShowPage = onShowPage
        self.onPlaceChange = onPlaceChange
        _currentIndex = State(initialValue: max(0, min(initialPage, max(0, pages.count - 1))))
        _mode = State(initialValue: initialMode)
    }

    public var body: some View {
        let layout = BookletReaderLayout(
            width: readerWidth,
            screenMargin: screenMargin,
            reading: readingArea,
            controlsHeight: controlsHeight,
            pageCount: pages.count,
            hinge: hinge
        )
        VStack(spacing: Spacing.s2) {
            switch mode {
            case .page:
                pageMode(layout)
            case .grid:
                besidePages(layout, fill: true) { gridMode(layout) }
            }
        }
        .frame(maxWidth: .infinity)
        // Only the width: scrolling moves the reader up and down without laying it out again.
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { readerWidth = $0 }
        .readsBookletHinge($hinge)
        .readsBookletScreenMargin($screenMargin)
        .onChange(of: BookletPlace(page: currentIndex, mode: mode)) { _, place in onPlaceChange(place) }
        .accessibilityIdentifier("bookletPager")
    }

    // MARK: - Page mode

    private func pageMode(_ layout: BookletReaderLayout) -> some View {
        VStack(spacing: Spacing.s2) {
            Group {
                if layout.isSpread {
                    spreads(layout)
                } else {
                    singlePages(layout)
                }
            }
            // A turn or a fold that changes one page to two starts the pager over on the same page.
            .id(layout.isSpread)
            besidePages(layout) { controls(layout) }
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { controlsHeight = $0 }
            if hasTranscript(layout) {
                besidePages(layout) { transcripts(layout) }
            }
        }
    }

    private func singlePages(_ layout: BookletReaderLayout) -> some View {
        TabView(selection: $currentIndex) {
            ForEach(Array(pages.enumerated()), id: \.offset) { idx, url in
                BookletPageImage(url: url, pageNumber: idx + 1, hasNextPage: idx < pageCount - 1)
                    .frame(width: layout.pageWidth + BookletReaderLayout.edge, height: layout.pageHeight)
                    .frame(maxWidth: .infinity)
                    .tag(idx)
                    .accessibilityIdentifier("bookletPager_page_\(idx)")
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .frame(height: layout.pageHeight)
        // Swipes start at the screen's edge; the page keeps its place.
        .padding(.horizontal, -Spacing.s4)
    }

    /// Two facing pages per spread: 1–2, 3–4 and so on.
    private func spreads(_ layout: BookletReaderLayout) -> some View {
        TabView(selection: spreadSelection) {
            ForEach(0..<((pages.count + 1) / 2), id: \.self) { spread in
                spreadPages(spread * 2, layout: layout)
                    .tag(spread)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .frame(width: layout.areaWidth, height: layout.pageHeight)
        // From the reader's leading edge into the trailing margin, while the reader keeps its own width: a wider
        // reader would widen the screen's column, and the column the reader again.
        .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
    }

    private func spreadPages(_ left: Int, layout: BookletReaderLayout) -> some View {
        HStack(spacing: layout.foldGap) {
            BookletPageImage(url: pages[left], pageNumber: left + 1, hasNextPage: false, foldSize: 0)
                .frame(width: layout.pageWidth, height: layout.pageHeight)
                .accessibilityIdentifier("bookletPager_page_\(left)")
            if left + 1 < pages.count {
                BookletPageImage(url: pages[left + 1], pageNumber: left + 2, hasNextPage: left + 1 < pageCount - 1)
                    .frame(width: layout.pageWidth + BookletReaderLayout.edge, height: layout.pageHeight)
                    .accessibilityIdentifier("bookletPager_page_\(left + 1)")
            } else {
                Color.clear.frame(width: layout.pageWidth + BookletReaderLayout.edge, height: layout.pageHeight)
            }
        }
        .overlay(alignment: .leading) {
            // The spine's shadow where the two pages meet, as in a booklet lying open.
            if layout.foldGap == 0, left + 1 < pages.count {
                LinearGradient(
                    colors: [.clear, .black.opacity(0.1), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .frame(width: Spacing.s6, height: layout.pageHeight)
                .offset(x: layout.pageWidth - Spacing.s3)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            }
        }
        .padding(.leading, layout.leftPageX)
        .frame(width: layout.areaWidth, alignment: .leading)
    }

    /// The spread on screen as a page: swiping to a spread opens its left page.
    private var spreadSelection: Binding<Int> {
        Binding {
            currentIndex / 2
        } set: { spread in
            if spread != currentIndex / 2 { currentIndex = min(spread * 2, max(0, pages.count - 1)) }
        }
    }

    /// Lays the content out as wide as the page (or the spread, around the hinge) and in line with it.
    @ViewBuilder
    private func besidePages(_ layout: BookletReaderLayout, fill: Bool = false, @ViewBuilder _ content: () -> some View) -> some View {
        if layout.isSpread {
            content()
                .frame(width: layout.spreadWidth)
                .offset(x: layout.spreadShift)
                .frame(minWidth: 0, maxWidth: .infinity)
        } else if fill || layout.pageWidth <= 0 {
            content()
        } else {
            content()
                .frame(width: layout.pageWidth + BookletReaderLayout.edge)
                .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - Controls

extension BookletPager {
    /// One slim row under the page; like a toolbar it stops growing at the largest standard text size, and a long
    /// press shows a control large.
    private func controls(_ layout: BookletReaderLayout) -> some View {
        VStack(spacing: 6) {
            scrubber
            ViewThatFits(in: .horizontal) {
                HStack(spacing: Spacing.s1) {
                    pageNavigation(layout).fixedSize(horizontal: true, vertical: false)
                    Spacer(minLength: Spacing.s2)
                    gridButton.fixedSize(horizontal: true, vertical: false)
                }
                VStack(spacing: Spacing.s1) {
                    pageNavigation(layout)
                    gridButton
                }
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    /// The first page on screen: the page, or a spread's left page.
    private func firstShown(_ layout: BookletReaderLayout) -> Int {
        layout.isSpread ? currentIndex / 2 * 2 : currentIndex
    }

    private func pageNavigation(_ layout: BookletReaderLayout) -> some View {
        HStack(spacing: Spacing.s1) {
            pageStepButton(forward: false, layout: layout)
            pageLabel(layout).frame(maxWidth: .infinity)
            pageStepButton(forward: true, layout: layout)
        }
    }

    private func pageStepButton(forward: Bool, layout: BookletReaderLayout) -> some View {
        let step = layout.isSpread ? 2 : 1
        let first = firstShown(layout)
        let label = forward ? (layout.isSpread ? "Next pages" : "Next page") : (layout.isSpread ? "Previous pages" : "Previous page")
        return Button {
            currentIndex = min(max(0, first + (forward ? step : -step)), max(0, pages.count - 1))
        } label: {
            Icon(forward ? .chevronRight : .chevronLeft, size: 14, color: Theme.Color.appTextStrong)
                .frame(width: 32, height: 32)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Circle())
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(forward ? first + step > pages.count - 1 : first == 0)
        .accessibilityLabel(label)
        .accessibilityIdentifier(forward ? "bookletPager_next" : "bookletPager_prev")
        .accessibilityShowsLargeContentViewer {
            Icon(forward ? .chevronRight : .chevronLeft, size: 14)
            Text(label)
        }
    }

    private func pageLabel(_ layout: BookletReaderLayout) -> some View {
        let first = firstShown(layout)
        let shown = layout.isSpread && first + 1 < pages.count ? "Pages \(first + 1)–\(first + 2) " : "Page \(first + 1) "
        return (
            Text(shown)
                .fontWeight(.bold)
                .foregroundColor(Theme.Color.appText)
                + Text("of \(pageCount)")
                .foregroundColor(Theme.Color.appTextSecondary)
        )
        .scaledFont(13)
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityIdentifier("bookletPager_pageLabel")
        .accessibilityShowsLargeContentViewer()
    }

    private var gridButton: some View {
        Button {
            mode = .grid
        } label: {
            HStack(spacing: Spacing.s1) {
                Icon(.layoutGrid, size: 12, color: Theme.Color.primaryInk)
                Text("All pages")
                    .scaledFont(11, weight: .semibold)
                    .foregroundStyle(Theme.Color.primaryInk)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s1)
            .background(Theme.Color.primary50)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("bookletPager_toggleGrid")
        .accessibilityShowsLargeContentViewer {
            Icon(.layoutGrid, size: 12)
            Text("All pages")
        }
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
}

// MARK: - Transcripts

extension BookletPager {
    private func ocrText(for index: Int) -> String? {
        guard ocrTexts.indices.contains(index) else { return nil }
        let text = ocrTexts[index]
        return text.isEmpty ? nil : text
    }

    private func hasTranscript(_ layout: BookletReaderLayout) -> Bool {
        let first = firstShown(layout)
        return ocrText(for: first) != nil || (layout.isSpread && ocrText(for: first + 1) != nil)
    }

    /// The page's text; in a spread each page's text sits under that page.
    @ViewBuilder
    private func transcripts(_ layout: BookletReaderLayout) -> some View {
        if layout.isSpread {
            let first = firstShown(layout)
            HStack(alignment: .top, spacing: max(layout.foldGap, Spacing.s3)) {
                transcript(ocrText(for: first))
                transcript(ocrText(for: first + 1))
            }
        } else if let text = ocrText(for: currentIndex) {
            BookletOCRCard(text: text)
        }
    }

    @ViewBuilder
    private func transcript(_ text: String?) -> some View {
        if let text {
            BookletOCRCard(text: text)
        } else {
            Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
        }
    }
}

// MARK: - Grid mode

extension BookletPager {
    private var gridHeaderLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Spacing.s2))
            : AnyLayout(HStackLayout(alignment: .center, spacing: Spacing.s2))
    }

    /// Three columns, or four in a spread with the widest gap on the hinge, so no page sits on the fold.
    private func gridColumns(_ layout: BookletReaderLayout) -> [GridItem] {
        guard layout.isSpread else { return Array(repeating: GridItem(.flexible(), spacing: Spacing.s2), count: 3) }
        let hinge = max(layout.foldGap, Spacing.s8)
        return [
            GridItem(.flexible(), spacing: Spacing.s2), GridItem(.flexible(), spacing: hinge),
            GridItem(.flexible(), spacing: Spacing.s2), GridItem(.flexible())
        ]
    }

    private func gridMode(_ layout: BookletReaderLayout) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            gridHeaderLayout {
                VStack(alignment: .leading, spacing: 1) {
                    Text("ALL PAGES")
                        .scaledFont(11, weight: .bold)
                        .tracking(0.5)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .accessibilityAddTraits(.isHeader)
                    Text("Tap a thumbnail to jump there")
                        .scaledFont(11)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                if !dynamicTypeSize.isAccessibilitySize { Spacer(minLength: Spacing.s0) }
                Text("\(pageCount) pages")
                    .scaledFont(11, weight: .bold)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, Spacing.s1)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            }
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            LazyVGrid(columns: gridColumns(layout), spacing: Spacing.s2) {
                ForEach(Array(pages.enumerated()), id: \.offset) { idx, url in
                    Button {
                        currentIndex = idx
                        mode = .page
                        onShowPage()
                    } label: {
                        BookletThumbnailCell(
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
            backToReader
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }

    private var backToReader: some View {
        Button {
            mode = .page
            onShowPage()
        } label: {
            HStack(spacing: Spacing.s1) {
                Icon(.chevronLeft, size: 12, color: Theme.Color.primaryInk)
                Text("Back to reader")
                    .scaledFont(11, weight: .semibold)
                    .foregroundStyle(Theme.Color.primaryInk)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s1)
            .background(Theme.Color.primary50)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .accessibilityIdentifier("bookletPager_togglePage")
        .accessibilityShowsLargeContentViewer {
            Icon(.chevronLeft, size: 12)
            Text("Back to reader")
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, Spacing.s3)
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
