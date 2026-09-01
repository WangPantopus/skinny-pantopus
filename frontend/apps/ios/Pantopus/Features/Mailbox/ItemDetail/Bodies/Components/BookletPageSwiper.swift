//
//  BookletPageSwiper.swift
//  Pantopus
//
//  Horizontal pager + page-indicator dots + pinch-to-zoom for the
//  FrameBooklet body. SwiftUI's `TabView` with `.page` style provides
//  snapping and accessibility actions for free; per-page magnification
//  uses a `MagnificationGesture`.
//

import SwiftUI

@MainActor
public struct BookletPageSwiper: View {
    private let pages: [URL]
    private let totalPages: Int
    @State private var currentIndex: Int = 0

    public init(pages: [URL], totalPages: Int? = nil) {
        self.pages = pages
        self.totalPages = max(totalPages ?? pages.count, pages.count)
    }

    public var body: some View {
        if pages.isEmpty {
            emptyState
        } else {
            pager
        }
    }

    private var pager: some View {
        VStack(spacing: Spacing.s2) {
            TabView(selection: $currentIndex) {
                ForEach(Array(pages.enumerated()), id: \.offset) { idx, url in
                    BookletPage(
                        url: url,
                        pageNumber: idx + 1,
                        hasNextPage: idx < totalPages - 1
                    )
                    .tag(idx)
                    .padding(.horizontal, Spacing.s4)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 420)

            HStack(spacing: Spacing.s1) {
                ForEach(0..<totalPages, id: \.self) { idx in
                    Circle()
                        .fill(idx == currentIndex ? Theme.Color.primary600 : Theme.Color.appBorder)
                        .frame(width: 6, height: 6)
                }
            }
            .accessibilityHidden(true)

            Text("Page \(currentIndex + 1) of \(totalPages)")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityLabel("Page \(currentIndex + 1) of \(totalPages)")
                .accessibilityIdentifier("bookletPageSwiper_pageLabel")
        }
        .accessibilityIdentifier("bookletPageSwiper")
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.fileText, size: 24, color: Theme.Color.appTextMuted)
            Text("No booklet pages available")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, minHeight: 220)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("bookletPageSwiper_empty")
    }
}

private struct BookletPage: View {
    let url: URL
    let pageNumber: Int
    let hasNextPage: Bool
    @State private var scale: CGFloat = 1.0
    @State private var baseScale: CGFloat = 1.0

    var body: some View {
        BookletPaperPageChrome(hasNextPage: hasNextPage) {
            AsyncImage(url: url) { phase in
                switch phase {
                case let .success(image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .scaleEffect(scale)
                        .gesture(
                            // Sustain pinch-to-zoom in [1.0, 3.0]. Double-tap
                            // to reset back to 1.0 (handled below).
                            MagnificationGesture()
                                .onChanged { value in
                                    scale = min(max(1.0, baseScale * value), 3.0)
                                }
                                .onEnded { _ in
                                    baseScale = scale
                                }
                        )
                        .onTapGesture(count: 2) {
                            withAnimation(.spring()) {
                                scale = 1.0
                                baseScale = 1.0
                            }
                        }
                        .onChange(of: url) { _, _ in
                            scale = 1.0
                            baseScale = 1.0
                        }
                case .failure:
                    fallback(icon: .alertCircle, label: "Couldn't load page")
                case .empty:
                    fallback(icon: .file, label: "Loading...")
                @unknown default:
                    fallback(icon: .file, label: "")
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
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct BookletPaperPageChrome<Content: View>: View {
    let hasNextPage: Bool
    let foldSize: CGFloat
    let cornerRadius: CGFloat
    let content: Content

    init(
        hasNextPage: Bool,
        foldSize: CGFloat = Spacing.s8,
        cornerRadius: CGFloat = Radii.lg,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.hasNextPage = hasNextPage
        self.foldSize = foldSize
        self.cornerRadius = cornerRadius
        self.content = content()
    }

    var body: some View {
        ZStack(alignment: .trailing) {
            ZStack {
                Theme.Color.appSurfaceRaised
                BookletPaperPageScaffold()
                content
                fold
            }
            .aspectRatio(3.0 / 4.0, contentMode: .fit)
            .padding(.trailing, hasNextPage ? Spacing.s3 : Spacing.s0)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
                    .padding(.trailing, hasNextPage ? Spacing.s3 : Spacing.s0)
            )
            .pantopusShadow(.lg)

            if hasNextPage {
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(Theme.Color.appSurfaceSunken)
                    .overlay(alignment: .leading) {
                        Rectangle()
                            .fill(Theme.Color.appBorderStrong)
                            .frame(width: 1)
                    }
                    .frame(width: Spacing.s3)
                    .padding(.vertical, Spacing.s3)
                    .accessibilityHidden(true)
            }
        }
    }

    private var fold: some View {
        TopRightFoldShape()
            .fill(Theme.Color.appSurfaceSunken)
            .overlay(
                TopRightFoldShape()
                    .stroke(Theme.Color.appBorderStrong, lineWidth: 1)
            )
            .frame(width: foldSize, height: foldSize)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            .opacity(0.92)
            .accessibilityHidden(true)
    }
}

private struct BookletPaperPageScaffold: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Capsule()
                .fill(Theme.Color.appTextMuted)
                .frame(width: 92, height: 4)
            HStack(spacing: Spacing.s2) {
                Rectangle()
                    .fill(Theme.Color.appBorderStrong)
                    .frame(width: 52, height: 64)
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    line(width: 0.78)
                    line(width: 0.64)
                    line(width: 0.72)
                    line(width: 0.48)
                }
            }
            Divider().background(Theme.Color.appBorderSubtle)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                line(width: 0.96)
                line(width: 0.88)
                line(width: 0.94)
                line(width: 0.62)
            }
            Spacer(minLength: Spacing.s0)
            HStack {
                Spacer()
                Capsule()
                    .fill(Theme.Color.appBorderStrong)
                    .frame(width: 36, height: 3)
                Spacer()
            }
        }
        .padding(Spacing.s5)
        .opacity(0.32)
        .accessibilityHidden(true)
    }

    private func line(width: CGFloat) -> some View {
        GeometryReader { proxy in
            Capsule()
                .fill(Theme.Color.appTextMuted)
                .frame(width: proxy.size.width * width, height: 3)
        }
        .frame(height: 3)
    }
}

private struct TopRightFoldShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.closeSubpath()
        return path
    }
}

#Preview {
    BookletPageSwiper(pages: [
        URL(string: "https://placehold.co/360x480")!,
        URL(string: "https://placehold.co/360x480/orange/white")!,
        URL(string: "https://placehold.co/360x480/blue/white")!
    ], totalPages: 3)
        .padding(.vertical)
        .background(Theme.Color.appBg)
}
