//
//  BookletPagerParts.swift
//  Pantopus
//
//  A booklet's page on its paper, a thumbnail in the All pages grid, and a
//  page's transcript with its Copy action (`BookletPager`).
//

import SwiftUI
import UIKit

struct BookletThumbnailCell: View {
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
                CachedAsyncImage(url: url, keepsOnDisk: false, maxPixelSize: 600) { phase in
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
                        .background(Theme.Color.primarySolid)
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

/// The supplied transcript, with the supported Copy action.
struct BookletOCRCard: View {
    let text: String
    @State private var copied = false

    init(text: String) {
        self.text = text
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            transcript
            VStack(alignment: .leading, spacing: 10) {
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                Button {
                    UIPasteboard.general.string = text
                    copied = true
                } label: {
                    action(icon: .copy, label: copied ? "Copied" : "Copy text", color: Theme.Color.primary600)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
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
        .onChange(of: text) { _, _ in copied = false }
    }

    private var header: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.scanLine, size: 13, color: Theme.Color.appTextSecondary)
                .frame(width: 22, height: 22)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
            Text("Text from this page")
                .scaledFont(12, weight: .bold)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityAddTraits(.isHeader)
        }
    }

    /// Transcript lines supply an overline, a title, then body copy.
    private var transcript: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(text.components(separatedBy: "\n").enumerated()), id: \.offset) { idx, line in
                switch idx {
                case 0:
                    Text(line)
                        .scaledFont(10, weight: .bold)
                        .tracking(0.8)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Color.appTextMuted)
                case 1:
                    Text(line)
                        .scaledFont(14, weight: .bold)
                        .foregroundStyle(Theme.Color.appText)
                default:
                    Text(line)
                        .scaledFont(12.5)
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
                .scaledFont(12, weight: .semibold)
                .foregroundStyle(color)
        }
    }
}

/// One stored page on its paper, with Loading and a Retry when it fails.
struct BookletPageImage: View {
    let url: URL
    let pageNumber: Int
    let hasNextPage: Bool
    /// The folded top corner; a spread's left page has none, as at a booklet's spine.
    var foldSize = Spacing.s8
    @State private var retryAttempt = 0

    init(url: URL, pageNumber: Int, hasNextPage: Bool, foldSize: CGFloat = Spacing.s8) {
        self.url = url
        self.pageNumber = pageNumber
        self.hasNextPage = hasNextPage
        self.foldSize = foldSize
    }

    var body: some View {
        BookletPaperPageChrome(hasNextPage: hasNextPage, foldSize: foldSize) {
            // About the largest a page is shown (a thumbnail, 600), not the scan's full ~31 MB bitmap.
            CachedAsyncImage(url: url, keepsOnDisk: false, maxPixelSize: 2048) { phase in
                switch phase {
                case let .success(image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .accessibilityLabel("Booklet page \(pageNumber)")
                case .failure:
                    fallback(icon: .alertCircle, label: "Couldn't load page", canRetry: true)
                case .empty:
                    fallback(icon: .fileType, label: "Loading...")
                @unknown default:
                    fallback(icon: .fileType, label: "")
                }
            }
            .id(retryAttempt)
        }
    }

    private func fallback(icon: PantopusIcon, label: String, canRetry: Bool = false) -> some View {
        ZStack {
            Theme.Color.appSurfaceSunken
            VStack(spacing: Spacing.s2) {
                Icon(icon, size: 24, color: Theme.Color.appTextMuted)
                if !label.isEmpty {
                    Text(label)
                        .scaledFont(11)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                }
                if canRetry {
                    Button {
                        retryAttempt += 1
                    } label: {
                        Text("Try again")
                            .scaledFont(11, weight: .semibold)
                            .foregroundStyle(Theme.Color.primaryInk)
                            .padding(.horizontal, Spacing.s3)
                            .padding(.vertical, Spacing.s2)
                            .frame(minHeight: 44)
                            .background(Theme.Color.primary50, in: RoundedRectangle(cornerRadius: Radii.pill))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Retry page \(pageNumber)")
                }
            }
            .padding(Spacing.s4)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
