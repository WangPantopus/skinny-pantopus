//
//  ProfileTabsSections.swift
//  Pantopus
//
//  The three public-profile tab bodies RN ships and native lacked:
//  Portfolio (grid + filter chips + add/delete), Gigs (rows that
//  deep-link into gig detail) and Reviews (average/total header, the
//  worker | poster | all filter, and a full-screen media viewer).
//
//  Mirrors `src/components/profile/PortfolioTab.tsx`, `GigsTab.tsx` and
//  `ReviewsTab.tsx`. Android counterpart: `ProfileTabsSections.kt`.
//

import PhotosUI
import SwiftUI

// swiftlint:disable file_length multiple_closures_with_trailing_closure

// MARK: - Portfolio

/// Portfolio tab body. `isOwnProfile` unlocks the add bar and the
/// per-card delete affordance, matching RN.
@MainActor
public struct ProfilePortfolioSection: View {
    @State private var viewModel: ProfilePortfolioViewModel

    public init(userId: String, isOwnProfile: Bool) {
        _viewModel = State(
            initialValue: ProfilePortfolioViewModel(userId: userId, isOwnProfile: isOwnProfile)
        )
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            switch viewModel.state {
            case .loading:
                skeleton
            case .empty:
                emptyState
            case .loaded:
                loadedBody
            case let .error(message):
                ErrorState(
                    headline: "Couldn't load the portfolio",
                    message: message
                ) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("profilePortfolioSection")
        .task { await viewModel.load() }
        .confirmationDialog(
            deleteTitle,
            isPresented: Binding(
                get: { viewModel.pendingDelete != nil },
                set: { if !$0 { viewModel.pendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task { await viewModel.confirmDelete() }
            }
            Button("Cancel", role: .cancel) { viewModel.pendingDelete = nil }
        }
        .sheet(isPresented: Binding(
            get: { viewModel.showAddSheet },
            set: { viewModel.showAddSheet = $0 }
        )) {
            AddPortfolioItemSheet(viewModel: viewModel)
        }
        .sheet(item: Binding(
            get: { viewModel.viewerItem },
            set: { viewModel.viewerItem = $0 }
        )) { item in
            ProfileMediaViewer(url: item.fullURL ?? item.imageURL, title: item.title) {
                viewModel.viewerItem = nil
            }
        }
    }

    /// RN: `Are you sure you want to delete "<title>"?`
    /// (`PortfolioTab.tsx:152-154`).
    private var deleteTitle: String {
        "Delete \"\(viewModel.pendingDelete?.title ?? "this item")\"?"
    }

    @ViewBuilder private var loadedBody: some View {
        if viewModel.canEdit {
            Button {
                viewModel.showAddSheet = true
            } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.plus, size: 18, color: Theme.Color.primary600)
                    Text("Add portfolio item")
                        .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary600)
                    Spacer(minLength: Spacing.s0)
                }
                .padding(Spacing.s3)
                .frame(maxWidth: .infinity)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("profilePortfolioAddButton")
        }

        if viewModel.availableFilters.count > 1 {
            filterChips
        }

        VStack(spacing: Spacing.s3) {
            ForEach(viewModel.filteredItems) { item in
                PortfolioCard(
                    item: item,
                    canDelete: viewModel.canEdit,
                    onOpen: { viewModel.viewerItem = item },
                    onDelete: { viewModel.pendingDelete = item }
                )
            }
        }
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                chip(title: "All (\(viewModel.totalCount))", isActive: viewModel.activeFilter == nil) {
                    viewModel.activeFilter = nil
                }
                ForEach(viewModel.availableFilters) { kind in
                    chip(
                        title: "\(kind.label) (\(viewModel.count(of: kind)))",
                        isActive: viewModel.activeFilter == kind
                    ) {
                        viewModel.activeFilter = kind
                    }
                }
            }
        }
        .accessibilityIdentifier("profilePortfolioFilters")
    }

    private func chip(title: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: PantopusTextStyle.caption.size, weight: .semibold))
                .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, 7)
                .background(isActive ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var emptyState: some View {
        EmptyState(
            icon: .image,
            headline: viewModel.canEdit ? "Showcase your best work" : "No portfolio items",
            subcopy: viewModel.canEdit
                ? "Add projects, photos, certificates, or anything that highlights your skills and experience."
                : "This user hasn't added any portfolio items yet.",
            cta: viewModel.canEdit
                ? EmptyState.CTA(title: "Add portfolio item") {
                    await MainActor.run { viewModel.showAddSheet = true }
                }
                : nil
        )
        .frame(minHeight: 220)
    }

    private var skeleton: some View {
        VStack(spacing: Spacing.s3) {
            ForEach(0..<3, id: \.self) { _ in
                Shimmer(height: 96, cornerRadius: Radii.lg)
            }
        }
        .accessibilityIdentifier("profilePortfolioSkeleton")
    }
}

/// One portfolio card — thumbnail, title, description, optional delete.
private struct PortfolioCard: View {
    let item: PortfolioItem
    let canDelete: Bool
    let onOpen: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            Button(action: onOpen) {
                thumbnail
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open \(item.title)")

            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(item.title)
                    .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                if let subtitle = item.subtitle {
                    Text(subtitle)
                        .font(.system(size: PantopusTextStyle.caption.size))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2)
                }
                HStack(spacing: Spacing.s1) {
                    Icon(item.kind.icon, size: 12, color: Theme.Color.appTextMuted)
                    Text(item.kind.label)
                        .font(.system(size: PantopusTextStyle.caption.size))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            Spacer(minLength: Spacing.s0)

            if canDelete {
                Button(action: onDelete) {
                    Icon(.trash, size: 16, color: Theme.Color.error)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("profilePortfolioDelete_\(item.id)")
                .accessibilityLabel("Delete \(item.title)")
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .pantopusShadow(.sm)
    }

    private var thumbnail: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
            if let url = item.imageURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case let .success(image):
                        image.resizable().scaledToFill()
                    default:
                        Icon(item.kind.icon, size: 22, color: Theme.Color.appTextMuted)
                    }
                }
            } else {
                Icon(item.kind.icon, size: 22, color: Theme.Color.appTextMuted)
            }
        }
        .frame(width: 72, height: 72)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}

/// Add-portfolio-item sheet — cover photo, title, description, type.
/// Mirrors RN's `AddPortfolioModal` (`PortfolioTab.tsx:431-560`).
private struct AddPortfolioItemSheet: View {
    let viewModel: ProfilePortfolioViewModel

    @State private var title: String = ""
    @State private var summary: String = ""
    @State private var kind: PortfolioItemKind = .photo
    @State private var showsPicker = false
    @State private var selection: PhotosPickerItem?
    @State private var pickedData: Data?
    @State private var pickedName: String = "portfolio.jpg"
    @State private var pickedMime: String = "image/jpeg"

    var body: some View {
        FormShell(
            title: "Add portfolio item",
            rightActionLabel: nil,
            bottomActionLabel: "Add",
            isValid: !title.trimmingCharacters(in: .whitespaces).isEmpty && pickedData != nil,
            isDirty: true,
            isSaving: viewModel.isMutating,
            onClose: { viewModel.showAddSheet = false },
            onCommit: submit
        ) {
            Button { showsPicker = true } label: { picker }
                .buttonStyle(.plain)
                .padding(.horizontal, Spacing.s4)
                .accessibilityIdentifier("portfolioAddPhotoButton")

            FormFieldGroup("Details") {
                PantopusTextField(
                    "Title",
                    text: $title,
                    placeholder: "What is this?",
                    identifier: "portfolioAddTitleField"
                )
                PantopusTextField(
                    "Description",
                    text: $summary,
                    placeholder: "Optional",
                    identifier: "portfolioAddDescriptionField"
                )
            }

            FormFieldGroup("Type") {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.s2) {
                        ForEach(PortfolioItemKind.allCases) { candidate in
                            Button { kind = candidate } label: {
                                Text(candidate.label)
                                    .font(.system(size: PantopusTextStyle.caption.size, weight: .semibold))
                                    .foregroundStyle(
                                        kind == candidate
                                            ? Theme.Color.appTextInverse
                                            : Theme.Color.appTextSecondary
                                    )
                                    .padding(.horizontal, Spacing.s3)
                                    .padding(.vertical, 7)
                                    .background(
                                        kind == candidate
                                            ? Theme.Color.primary600
                                            : Theme.Color.appSurfaceSunken
                                    )
                                    .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .accessibilityIdentifier("portfolioAddTypePicker")
            }
        }
        .photosPicker(isPresented: $showsPicker, selection: $selection, matching: .images)
        .onChange(of: selection) { _, newValue in
            guard let newValue else { return }
            selection = nil
            load(newValue)
        }
    }

    private var picker: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
            if pickedData == nil {
                VStack(spacing: Spacing.s1) {
                    Icon(.camera, size: 28, color: Theme.Color.appTextMuted)
                    Text("Tap to add a photo")
                        .font(.system(size: PantopusTextStyle.small.size))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text("This will be the cover image")
                        .font(.system(size: PantopusTextStyle.caption.size))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            } else {
                VStack(spacing: Spacing.s1) {
                    Icon(.check, size: 24, color: Theme.Color.success)
                    Text(pickedName)
                        .font(.system(size: PantopusTextStyle.caption.size))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
        }
        .frame(height: 140)
    }

    private func submit() {
        Task {
            await viewModel.upload(
                data: pickedData,
                filename: pickedName,
                mimeType: pickedMime,
                title: title,
                description: summary,
                category: kind
            )
        }
    }

    private func load(_ item: PhotosPickerItem) {
        Task {
            let data = try? await item.loadTransferable(type: Data.self)
            let type = item.supportedContentTypes.first
            let ext = type?.preferredFilenameExtension ?? "jpg"
            await MainActor.run {
                pickedData = data
                pickedName = "portfolio-\(Int(Date().timeIntervalSince1970)).\(ext)"
                pickedMime = type?.preferredMIMEType ?? "image/jpeg"
            }
        }
    }
}

// MARK: - Gigs

/// Gigs tab body — the gigs this profile posted, each row deep-linking
/// into gig detail. Mirrors `src/components/profile/GigsTab.tsx`.
@MainActor
public struct ProfileGigsSection: View {
    @State private var viewModel: ProfileGigsViewModel
    private let onOpenGig: @MainActor (String) -> Void

    public init(userId: String, onOpenGig: @escaping @MainActor (String) -> Void) {
        _viewModel = State(initialValue: ProfileGigsViewModel(userId: userId))
        self.onOpenGig = onOpenGig
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            switch viewModel.state {
            case .loading:
                VStack(spacing: Spacing.s3) {
                    ForEach(0..<3, id: \.self) { _ in
                        Shimmer(height: 104, cornerRadius: Radii.lg)
                    }
                }
                .accessibilityIdentifier("profileGigsSkeleton")
            case .empty:
                EmptyState(
                    icon: .briefcase,
                    headline: "No tasks posted yet",
                    subcopy: "This user hasn't posted any tasks."
                )
                .frame(minHeight: 200)
            case let .loaded(rows):
                ForEach(rows) { row in
                    Button {
                        onOpenGig(row.id)
                    } label: {
                        ProfileGigCard(row: row)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("profileGigRow_\(row.id)")
                }
            case let .error(message):
                ErrorState(headline: "Couldn't load tasks", message: message) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("profileGigsSection")
        .task { await viewModel.load() }
    }
}

private struct ProfileGigCard: View {
    let row: ProfileGigRow

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Text(row.title)
                    .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(row.price)
                    .font(.system(size: PantopusTextStyle.body.size, weight: .bold))
                    .foregroundStyle(Theme.Color.success)
            }
            if let summary = row.summary {
                Text(summary)
                    .font(.system(size: PantopusTextStyle.caption.size))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(2)
            }
            HStack(spacing: Spacing.s2) {
                if let category = row.category {
                    badge(category, foreground: Theme.Color.primary600, background: Theme.Color.personalBg)
                }
                badge(
                    row.status.uppercased(),
                    foreground: row.isOpen ? Theme.Color.success : Theme.Color.appTextSecondary,
                    background: row.isOpen ? Theme.Color.successBg : Theme.Color.appSurfaceSunken
                )
                Spacer(minLength: Spacing.s0)
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private func badge(_ text: String, foreground: Color, background: Color) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(foreground)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
    }
}

// MARK: - Gig reviews

/// Reviews tab body — average/total header, the worker | poster | all
/// filter driven by `received_as`, and a full-screen media viewer.
/// Mirrors `src/components/profile/ReviewsTab.tsx`.
@MainActor
public struct ProfileGigReviewsSection: View {
    @State private var viewModel: ProfileGigReviewsViewModel
    private let onOpenReviewer: @MainActor (String) -> Void

    public init(userId: String, onOpenReviewer: @escaping @MainActor (String) -> Void = { _ in }) {
        _viewModel = State(initialValue: ProfileGigReviewsViewModel(userId: userId))
        self.onOpenReviewer = onOpenReviewer
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            switch viewModel.state {
            case .loading:
                VStack(spacing: Spacing.s3) {
                    Shimmer(height: 108, cornerRadius: Radii.lg)
                    Shimmer(height: 88, cornerRadius: Radii.lg)
                    Shimmer(height: 88, cornerRadius: Radii.lg)
                }
                .accessibilityIdentifier("profileReviewsSkeleton")
            case .empty:
                EmptyState(
                    icon: .star,
                    headline: "No reviews yet",
                    subcopy: "Reviews appear here after completed gigs."
                )
                .frame(minHeight: 200)
            case let .loaded(summary, _):
                ReviewSummaryCard(summary: summary)
                filterRow(summary: summary)
                reviewList
            case let .error(message):
                ErrorState(headline: "Couldn't load reviews", message: message) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("profileReviewsSection")
        .task { await viewModel.load() }
        .sheet(item: Binding(
            get: { viewModel.viewerURL.map(IdentifiedURL.init) },
            set: { viewModel.viewerURL = $0?.url }
        )) { wrapper in
            ProfileMediaViewer(url: wrapper.url, title: "Review photo") {
                viewModel.viewerURL = nil
            }
        }
    }

    @ViewBuilder private var reviewList: some View {
        if viewModel.filteredReviews.isEmpty {
            Text(
                viewModel.totalCount == 0
                    ? "No reviews yet"
                    : "No reviews in this category"
            )
            .font(.system(size: PantopusTextStyle.small.size))
            .foregroundStyle(Theme.Color.appTextMuted)
            .frame(maxWidth: .infinity, minHeight: 80)
            .accessibilityIdentifier("profileReviewsFilterEmpty")
        } else {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                ForEach(viewModel.filteredReviews) { review in
                    GigReviewCard(
                        review: review,
                        onOpenReviewer: { id in onOpenReviewer(id) },
                        onOpenMedia: { url in viewModel.viewerURL = url }
                    )
                }
            }
        }
    }

    private func filterRow(summary: ProfileReviewSummary) -> some View {
        HStack(spacing: Spacing.s2) {
            ForEach(ProfileReviewFilter.allCases) { filter in
                let count = switch filter {
                case .all: summary.total
                case .worker: summary.workerCount
                case .poster: summary.posterCount
                }
                Button {
                    viewModel.activeFilter = filter
                } label: {
                    Text("\(filter.label) (\(count))")
                        .font(.system(size: PantopusTextStyle.caption.size, weight: .semibold))
                        .foregroundStyle(
                            viewModel.activeFilter == filter
                                ? Theme.Color.appTextInverse
                                : Theme.Color.appTextSecondary
                        )
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, 7)
                        .background(
                            viewModel.activeFilter == filter
                                ? Theme.Color.primary600
                                : Theme.Color.appSurfaceSunken
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("profileReviewsFilter_\(filter.rawValue)")
            }
            Spacer(minLength: Spacing.s0)
        }
    }
}

/// Average · stars · total on the left, per-star bars on the right.
private struct ReviewSummaryCard: View {
    let summary: ProfileReviewSummary

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.s4) {
            VStack(spacing: Spacing.s1) {
                Text(String(format: "%.1f", summary.average))
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                HStack(spacing: 2) {
                    ForEach(0..<5, id: \.self) { index in
                        Icon(
                            .star,
                            size: 12,
                            color: index < Int(summary.average.rounded())
                                ? Theme.Color.warning
                                : Theme.Color.appTextMuted
                        )
                    }
                }
                Text("\(summary.total) review\(summary.total == 1 ? "" : "s")")
                    .font(.system(size: PantopusTextStyle.caption.size))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(minWidth: 80)

            VStack(alignment: .leading, spacing: 3) {
                ForEach([5, 4, 3, 2, 1], id: \.self) { star in
                    HStack(spacing: Spacing.s1) {
                        Text("\(star)")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Icon(.star, size: 10, color: Theme.Color.warning)
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Theme.Color.appBorder)
                                Capsule()
                                    .fill(Theme.Color.warning)
                                    .frame(width: geo.size.width * fraction(star))
                            }
                        }
                        .frame(height: 6)
                        Text("\(summary.distribution[star] ?? 0)")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextMuted)
                            .frame(width: 18, alignment: .trailing)
                    }
                }
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("profileReviewsSummary")
    }

    private func fraction(_ star: Int) -> CGFloat {
        let count = summary.distribution[star] ?? 0
        let denominator = summary.distribution.values.reduce(0, +)
        guard denominator > 0 else { return 0 }
        return CGFloat(count) / CGFloat(denominator)
    }
}

private struct GigReviewCard: View {
    let review: ProfileGigReview
    let onOpenReviewer: (String) -> Void
    let onOpenMedia: (URL) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Button {
                    if let id = review.reviewerId { onOpenReviewer(id) }
                } label: {
                    HStack(spacing: Spacing.s2) {
                        AvatarWithIdentityRing(
                            name: review.reviewerName,
                            imageURL: review.reviewerAvatarURL,
                            identity: .personal,
                            ringProgress: 1,
                            size: 36
                        )
                        VStack(alignment: .leading, spacing: 1) {
                            Text(review.reviewerName)
                                .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                            if let handle = review.reviewerHandle {
                                Text("@\(handle)")
                                    .font(.system(size: PantopusTextStyle.caption.size))
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                            }
                        }
                    }
                }
                .buttonStyle(.plain)
                .disabled(review.reviewerId == nil)

                Spacer(minLength: Spacing.s0)

                HStack(spacing: 2) {
                    ForEach(0..<5, id: \.self) { index in
                        Icon(
                            .star,
                            size: 12,
                            color: index < review.rating ? Theme.Color.warning : Theme.Color.appTextMuted
                        )
                    }
                }
            }

            if let comment = review.comment {
                Text(comment)
                    .font(.system(size: PantopusTextStyle.small.size))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(3)
            }

            if !review.mediaURLs.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.s2) {
                        ForEach(review.mediaURLs, id: \.self) { url in
                            Button { onOpenMedia(url) } label: {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case let .success(image):
                                        image.resizable().scaledToFill()
                                    default:
                                        Theme.Color.appSurfaceSunken
                                    }
                                }
                                .frame(width: 80, height: 80)
                                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Open review photo")
                        }
                    }
                }
            }

            HStack(spacing: Spacing.s1) {
                if let date = review.dateLabel {
                    Text(date)
                        .font(.system(size: PantopusTextStyle.caption.size))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                if let role = review.roleLabel {
                    Text("•")
                        .font(.system(size: PantopusTextStyle.caption.size))
                        .foregroundStyle(Theme.Color.appTextMuted)
                    Text(role)
                        .font(.system(size: PantopusTextStyle.caption.size))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                Spacer(minLength: Spacing.s0)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("profileReviewCard_\(review.id)")
    }
}

// MARK: - Shared media viewer

/// `URL` wrapper so it can drive `.sheet(item:)`.
private struct IdentifiedURL: Identifiable {
    let url: URL

    var id: String {
        url.absoluteString
    }
}

/// Minimal full-screen media viewer used by the Portfolio and Reviews
/// tabs — RN opens `ImageViewerModal` from both.
private struct ProfileMediaViewer: View {
    let url: URL?
    let title: String
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            HStack {
                Text(title)
                    .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Spacer()
                Button(action: onClose) {
                    Icon(.x, size: 20, color: Theme.Color.appText)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
            }
            .padding(Spacing.s4)

            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case let .success(image):
                        image.resizable().scaledToFit()
                    case .failure:
                        EmptyState(
                            icon: .alertCircle,
                            headline: "Couldn't load that file",
                            subcopy: "Try again in a moment."
                        )
                    default:
                        Shimmer(height: 260, cornerRadius: Radii.lg)
                            .padding(.horizontal, Spacing.s4)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                EmptyState(
                    icon: .alertCircle,
                    headline: "Nothing to preview",
                    subcopy: "This item has no viewable file."
                )
                .frame(maxHeight: .infinity)
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("profileMediaViewer")
    }
}
