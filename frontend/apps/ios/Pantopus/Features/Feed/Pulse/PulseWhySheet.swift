//
//  PulseWhySheet.swift
//  Pantopus
//
//  "Why am I seeing this?" (Pulse S10; build spec §7, contract §2.9): the
//  server's sentences about the reader's own choices only (the area being
//  read, a chosen topic, a matching follow, newest first). Nothing about
//  anyone else. Read with the page's own view, topic and area.
//

import Observation
import SwiftUI

@Observable
@MainActor
final class PulseWhyViewModel {
    enum State: Equatable {
        case loading
        case loaded([PulseWhyReason])
        case error(String)
    }

    private(set) var state: State = .loading
    private let postId: String
    private let view: String?
    private let topic: String?
    private let areaId: String?
    private let api: APIClient

    init(postId: String, view: String?, topic: String?, areaId: String?, api: APIClient = .shared) {
        self.postId = postId
        self.view = view
        self.topic = topic
        self.areaId = areaId
        self.api = api
    }

    func load() async {
        state = .loading
        do {
            let response: PulseWhyResponse = try await api.request(
                PulseEndpoints.whyShown(postId: postId, view: view, topic: topic, areaId: areaId)
            )
            guard !Task.isCancelled else { return }
            let reasons = response.reasons.filter { !$0.text.isEmpty }
            state = reasons.isEmpty ? .error("Couldn't explain this post right now.") : .loaded(reasons)
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            state = .error((error as? APIError)?.errorDescription ?? "Couldn't explain this post right now.")
        }
    }
}

struct PulseWhySheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: PulseWhyViewModel

    init(postId: String, view: String?, topic: String?, areaId: String?) {
        _viewModel = State(initialValue: PulseWhyViewModel(postId: postId, view: view, topic: topic, areaId: areaId))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    content
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Spacing.s4)
            }
            .background(Theme.Color.appBg)
            .navigationTitle("Why am I seeing this?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier("pulseWhyClose")
                }
            }
            .task { await viewModel.load() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("pulseWhySheet")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            FeedSkeletonCard()
                .accessibilityLabel("Loading why this post is shown")
        case let .loaded(reasons):
            ForEach(Array(reasons.enumerated()), id: \.offset) { _, reason in
                Text(reason.text)
                    .pulseFont(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurface, in: RoundedRectangle(cornerRadius: Radii.md))
                    .accessibilityIdentifier("pulseWhyReason_\(reason.kind ?? "other")")
            }
        case let .error(message):
            PulsePageErrorCard(message: message) {
                Task { await viewModel.load() }
            }
        }
    }
}
