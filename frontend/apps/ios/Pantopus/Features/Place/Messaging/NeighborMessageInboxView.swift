//
//  NeighborMessageInboxView.swift
//  Pantopus
//
//  The verified-neighbor inbox list. Each row is an anonymized heads-up ("a
//  verified neighbor nearby") with an unread dot; tapping opens the D2
//  detail. Empty / error / loading follow the Place state rule.
//

import SwiftUI

struct NeighborMessageInboxView: View {
    @State var viewModel: NeighborMessageInboxViewModel
    var onBack: () -> Void
    var onOpenMessage: (String) -> Void

    var body: some View {
        VStack(spacing: 0) {
            PlaceDetailHeader(
                title: "Messages",
                address: "From verified neighbors",
                onBack: onBack
            )
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            InboxSkeleton()
        case .empty:
            EmptyState(
                icon: .inbox,
                headline: "No messages yet",
                subcopy: "When a verified neighbor on your block sends you a heads-up, it'll show up here."
            )
        case let .error(message):
            ErrorState(message: message) { await viewModel.load() }
        case let .loaded(messages):
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(messages) { message in
                        Button { onOpenMessage(message.id) } label: {
                            InboxRow(message: message)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 40)
            }
            .refreshable { await viewModel.refresh() }
        }
    }
}

private struct InboxRow: View {
    let message: ReceivedNeighborMessage

    private var unread: Bool {
        message.readAt == nil
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle()
                    .fill(Theme.Color.appSurfaceSunken)
                    .overlay(Circle().strokeBorder(Theme.Color.appBorder, lineWidth: 1))
                Icon(.shieldCheck, size: 20, strokeWidth: 2, color: Theme.Color.home)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text("A verified neighbor nearby")
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if unread {
                        Circle().fill(Theme.Color.primary600).frame(width: 7, height: 7)
                    }
                    Spacer(minLength: 0)
                    Text(neighborRelativeTime(message.createdAt))
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                Text(message.body)
                    .font(.system(size: 13.5))
                    .lineSpacing(1.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            Icon(.chevronRight, size: 18, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
                .padding(.top, 2)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .placeCard()
    }
}

private struct InboxSkeleton: View {
    var body: some View {
        VStack(spacing: 8) {
            ForEach(0..<4, id: \.self) { _ in
                HStack(alignment: .top, spacing: 12) {
                    PlaceSkeleton(width: 40, height: 40, radius: 20)
                    VStack(alignment: .leading, spacing: 8) {
                        PlaceSkeleton(widthFraction: 0.6, height: 13)
                        PlaceSkeleton(widthFraction: 0.9, height: 12)
                    }
                    Spacer(minLength: 0)
                }
                .padding(14)
                .placeCard()
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }
}
