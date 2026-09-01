//
//  HomeRecordsView.swift
//  Pantopus
//
//  Home Records — the linked-asset hub behind the Mailbox. Overview:
//  auto-detect banner, room filter chips, and the asset index. Drill-in:
//  asset details + its linked mail, each row pushing the mail item.
//
//  Four states per the Block 2F rule: shimmer skeleton, `EmptyState`,
//  loaded, `ErrorState` with Retry wired to `refresh()`.
//
//  Mirrors `ui/screens/mailbox/home_records/HomeRecordsScreen.kt`.
//

// swiftlint:disable type_body_length

import SwiftUI

public struct HomeRecordsView: View {
    @State private var viewModel: HomeRecordsViewModel

    public init(viewModel: HomeRecordsViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            if let asset = viewModel.selectedAsset {
                assetDetail(asset)
            } else {
                overview
            }
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .accessibilityIdentifier("homeRecords")
        .task { await viewModel.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .overlay(alignment: .bottom) { bottomOverlay }
        .sheet(
            isPresented: Binding(
                get: { viewModel.showsSuggestions },
                set: { viewModel.showsSuggestions = $0 }
            )
        ) {
            suggestionsSheet
        }
        .confirmationDialog(
            "Link to which asset?",
            isPresented: Binding(
                get: { viewModel.pendingLinkMailId != nil },
                set: { if !$0 { viewModel.cancelLink() } }
            ),
            titleVisibility: .visible
        ) {
            ForEach(viewModel.allAssets) { asset in
                Button(asset.name) {
                    Task { await viewModel.linkPendingMail(to: asset) }
                }
                .accessibilityIdentifier("homeRecords_linkTo_\(asset.id)")
            }
            Button("Cancel", role: .cancel) { viewModel.cancelLink() }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: Spacing.s3) {
            Button(action: { viewModel.tapBack() }, label: {
                Icon(.arrowLeft, size: 20, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            })
            .buttonStyle(.plain)
            .accessibilityLabel(viewModel.selectedAsset == nil ? "Back to Mailbox" : "Back to records")
            .accessibilityIdentifier("homeRecords_back")
            VStack(alignment: .leading, spacing: 1) {
                Text(viewModel.selectedAsset?.name ?? "Home Records")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s2)
    }

    private var subtitle: String {
        if let asset = viewModel.selectedAsset {
            let parts = [asset.room, asset.manufacturer].compactMap { $0 }
            return parts.isEmpty ? "No room recorded" : parts.joined(separator: " · ")
        }
        guard case let .loaded(assets, _) = viewModel.state else {
            return "Warranties, receipts, and repairs"
        }
        return "\(assets.count) asset\(assets.count == 1 ? "" : "s") tracked"
    }

    // MARK: - Overview

    @ViewBuilder
    private var overview: some View {
        switch viewModel.state {
        case .loading:
            skeleton
        case .loaded:
            loadedOverview
        case .empty:
            ScrollView {
                VStack(spacing: Spacing.s3) {
                    autoDetect
                    EmptyState(
                        icon: .home,
                        headline: "No assets yet",
                        subcopy: """
                        Link mail items to home assets to track warranties, \
                        receipts, and repairs in one place.
                        """,
                        cta: EmptyState.CTA(title: "Scan mail for assets") {
                            await viewModel.runAutoDetect()
                        },
                        tint: Theme.Color.homeBg,
                        accent: Theme.Color.home
                    )
                    .frame(maxWidth: .infinity, minHeight: 320)
                }
                .padding(.horizontal, Spacing.s4)
            }
            .refreshable { await viewModel.refresh() }
            .accessibilityIdentifier("homeRecords_empty")
        case let .error(message):
            ScrollView {
                ErrorState(headline: "Couldn't load home records", message: message) {
                    await viewModel.refresh()
                }
                .frame(maxWidth: .infinity, minHeight: 360)
            }
            .refreshable { await viewModel.refresh() }
            .accessibilityIdentifier("homeRecords_error")
        }
    }

    private var loadedOverview: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                autoDetect
                if viewModel.rooms.count > 1 {
                    roomChips
                }
                ForEach(viewModel.filteredAssets) { asset in
                    AssetLinkCard(asset: asset) { viewModel.openAsset(asset) }
                }
                if viewModel.filteredAssets.isEmpty {
                    Text("No assets in this room.")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, Spacing.s10)
                        .accessibilityIdentifier("homeRecords_roomEmpty")
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s10)
        }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("homeRecords_list")
    }

    private var autoDetect: some View {
        AutoDetectBanner(
            detectionCount: viewModel.detections.count,
            isScanning: viewModel.isScanning,
            onScan: { Task { await viewModel.runAutoDetect() } },
            onReview: { Task { await viewModel.openSuggestions() } }
        )
    }

    private var roomChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                roomChip(label: "All", room: nil)
                ForEach(viewModel.rooms, id: \.self) { room in
                    roomChip(label: room, room: room)
                }
            }
        }
        .frame(height: 40)
    }

    private func roomChip(label: String, room: String?) -> some View {
        let active = viewModel.roomFilter == room
        return Button(action: { viewModel.selectRoom(room) }, label: {
            Text(label)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(active ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(active ? Theme.Color.home : Theme.Color.appSurfaceSunken)
                .clipShape(Capsule())
        })
        .buttonStyle(.plain)
        .accessibilityIdentifier("homeRecords_room_\(room ?? "all")")
        .accessibilityAddTraits(active ? [.isSelected] : [])
    }

    private var skeleton: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                ForEach(0..<5, id: \.self) { _ in
                    HStack(spacing: Spacing.s3) {
                        Shimmer(width: 42, height: 42, cornerRadius: Radii.md)
                        VStack(alignment: .leading, spacing: 5) {
                            Shimmer(width: 150, height: 11, cornerRadius: Radii.xs)
                            Shimmer(width: 90, height: 9, cornerRadius: Radii.xs)
                            Shimmer(width: 120, height: 9, cornerRadius: Radii.xs)
                        }
                        Spacer(minLength: Spacing.s2)
                    }
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
        .accessibilityIdentifier("homeRecords_loading")
    }

    // MARK: - Asset detail

    private func assetDetail(_ asset: HomeRecordAsset) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                detailsCard(asset)
                linkedMailCard
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s10)
        }
        .accessibilityIdentifier("homeRecords_assetDetail")
    }

    private func detailsCard(_ asset: HomeRecordAsset) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionHeader("DETAILS")
            if let model = asset.modelNumber {
                detailRow(label: "Model", value: model)
            }
            if let purchased = asset.purchasedLabel {
                detailRow(label: "Purchased", value: purchased)
            }
            HStack {
                Text("Warranty")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextMuted)
                Spacer(minLength: Spacing.s2)
                Text(asset.warranty.label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(asset.warranty.tint)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private func detailRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextMuted)
            Spacer(minLength: Spacing.s2)
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.trailing)
        }
    }

    private var linkedMailCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            switch viewModel.detailState {
            case .loading:
                SectionHeader("LINKED MAIL")
                ForEach(0..<3, id: \.self) { _ in
                    Shimmer(height: 12, cornerRadius: Radii.xs)
                }
            case let .loaded(mail, _):
                SectionHeader("LINKED MAIL (\(mail.count))")
                if mail.isEmpty {
                    Text("No mail linked to this asset yet.")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .accessibilityIdentifier("homeRecords_assetMail_empty")
                } else {
                    ForEach(mail) { row in
                        mailRow(row)
                    }
                }
            case let .error(message):
                SectionHeader("LINKED MAIL")
                Text(message)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextMuted)
                Button("Try again") {
                    Task { await viewModel.retryAssetDetail() }
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.primary600)
                .accessibilityIdentifier("homeRecords_assetMail_retry")
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private func mailRow(_ row: HomeRecordMailRow) -> some View {
        Button(action: { viewModel.openMail(row.id) }, label: {
            HStack(spacing: Spacing.s2) {
                Icon(.mail, size: 14, color: Theme.Color.home)
                VStack(alignment: .leading, spacing: 1) {
                    Text(row.subject)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if let caption = mailCaption(row) {
                        Text(caption)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextMuted)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 14, color: Theme.Color.appBorderStrong)
            }
            .frame(minHeight: 44)
        })
        .buttonStyle(.plain)
        .accessibilityIdentifier("homeRecords_mail_\(row.id)")
    }

    private func mailCaption(_ row: HomeRecordMailRow) -> String? {
        let parts = [row.senderName, row.deliveredLabel].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    // MARK: - Suggestions sheet

    private var suggestionsSheet: some View {
        NavigationStack {
            Group {
                if viewModel.isLoadingSuggestions {
                    VStack(spacing: Spacing.s3) {
                        ForEach(0..<4, id: \.self) { _ in
                            Shimmer(height: 46, cornerRadius: Radii.lg)
                        }
                        Spacer(minLength: Spacing.s0)
                    }
                    .padding(Spacing.s4)
                } else if viewModel.suggestions.isEmpty {
                    EmptyState(
                        icon: .fileSearch,
                        headline: "Nothing left to link",
                        subcopy: """
                        Every asset mention we found in your recent mail is \
                        already linked.
                        """,
                        tint: Theme.Color.homeBg,
                        accent: Theme.Color.home
                    )
                } else {
                    ScrollView {
                        VStack(spacing: Spacing.s2) {
                            ForEach(viewModel.suggestions) { suggestion in
                                suggestionRow(suggestion)
                            }
                        }
                        .padding(Spacing.s4)
                    }
                }
            }
            .background(Theme.Color.appBg)
            .navigationTitle("Link suggestions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { viewModel.dismissSuggestions() }
                        .accessibilityIdentifier("homeRecords_suggestions_done")
                }
            }
        }
        .accessibilityIdentifier("homeRecords_suggestions")
    }

    private func suggestionRow(_ suggestion: HomeRecordSuggestion) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(.sparkles, size: 18, color: Theme.Color.warning)
            VStack(alignment: .leading, spacing: 1) {
                Text(suggestion.candidateName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                Text(suggestionCaption(suggestion))
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: Spacing.s2)
            Button(action: { viewModel.requestLink(mailId: suggestion.id) }, label: {
                Text("Link")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 7)
                    .background(Theme.Color.home)
                    .clipShape(Capsule())
            })
            .buttonStyle(.plain)
            .disabled(viewModel.allAssets.isEmpty)
            .accessibilityIdentifier("homeRecords_suggestion_link_\(suggestion.id)")
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("homeRecords_suggestion_\(suggestion.id)")
    }

    private func suggestionCaption(_ suggestion: HomeRecordSuggestion) -> String {
        let brand = suggestion.candidateBrand.map { "\($0) · " } ?? ""
        return "\(brand)\(suggestion.confidencePercent)% match"
    }

    // MARK: - Undo / toast

    private var bottomOverlay: some View {
        VStack(spacing: Spacing.s2) {
            if let undo = viewModel.undoableLink {
                HStack(spacing: Spacing.s3) {
                    Text("Linked to \(undo.assetName)")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                    Spacer(minLength: Spacing.s2)
                    Button("Undo") {
                        Task { await viewModel.undoLastLink() }
                    }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .accessibilityIdentifier("homeRecords_undoLink")
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s3)
                .background(Theme.Color.appText.opacity(0.92))
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .padding(.horizontal, Spacing.s4)
                .accessibilityIdentifier("homeRecords_undoBar")
            }
            if let toast = viewModel.toast {
                Text(toast)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, Spacing.s2)
                    .background(Theme.Color.appText.opacity(0.9))
                    .clipShape(Capsule())
                    .accessibilityIdentifier("homeRecords_toast")
                    .task {
                        try? await Task.sleep(nanoseconds: 2_200_000_000)
                        viewModel.consumeToast()
                    }
            }
        }
        .padding(.bottom, Spacing.s10)
    }
}
