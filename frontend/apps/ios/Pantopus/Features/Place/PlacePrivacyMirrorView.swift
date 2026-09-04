//
//  PlacePrivacyMirrorView.swift
//  Pantopus
//
//  The privacy mirror (Wedge v2 §2): your home exactly as a neighbor
//  outside your household sees it. Not a mock-up — the backend renders it
//  through the same serializer that answers a real outsider, so what this
//  screen shows is what they get. Parity twin of the web
//  `/app/homes/[id]/privacy` page.
//

import Observation
import SwiftUI

/// The four lines of the promise, verbatim from the web `PrivacyPromise`.
/// Every line is a statement about what the product does today.
public let privacyPromiseLines: [String] = [
    "Neighbors see a first name and a street at most. Never a house number or unit.",
    "We never sell your address or use it for ads.",
    "Verifying never asks for your GPS. It works by mail, a landlord, or a document you choose.",
    "Verification documents are seen by one reviewer, never by neighbors, and deleted once your claim is decided.",
]

@Observable
@MainActor
final class PlacePrivacyMirrorViewModel {
    enum State: Equatable {
        case loading
        case loaded(HomeMirrorDTO)
        case error(message: String)
    }

    private(set) var state: State = .loading
    let homeId: String
    private let client: APIClient

    init(homeId: String, client: APIClient = .shared) {
        self.homeId = homeId
        self.client = client
    }

    func load() async {
        if case .loaded = state { return }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    private func fetch() async {
        state = .loading
        do {
            let mirror: HomeMirrorDTO = try await client.request(IdentityCenterEndpoints.homeMirror(homeId: homeId))
            state = .loaded(mirror)
        } catch {
            state = .error(message: "We couldn't load the preview. Only a member of this home can see it.")
        }
    }
}

struct PlacePrivacyMirrorView: View {
    @State private var viewModel: PlacePrivacyMirrorViewModel
    var onBack: () -> Void

    init(viewModel: PlacePrivacyMirrorViewModel, onBack: @escaping () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("What neighbors see")
                        .font(.system(size: 24, weight: .bold))
                        .kerning(-0.4)
                        .foregroundStyle(Theme.Color.appText)
                    Text("This is your address as someone outside your household sees it, rendered by the same code that serves them. "
                        + "If it looks wrong here, it is wrong for them too.")
                        .font(.system(size: 14))
                        .lineSpacing(3)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    switch viewModel.state {
                    case .loading:
                        placeholders
                    case let .error(message):
                        errorBody(message)
                    case let .loaded(mirror):
                        neighborCard(mirror)
                        hiddenList(mirror)
                        promise
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, Spacing.s10)
            }
        }
        .background(Theme.Color.appBg)
        .toolbar(.hidden, for: .navigationBar)
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("place.privacyMirror.screen")
    }

    private var header: some View {
        HStack {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 20, strokeWidth: 2.5, color: Theme.Color.appTextStrong)
                    .frame(width: 34, height: 34).background(Theme.Color.appSurface).clipShape(Circle())
            }
            .buttonStyle(.plain)
            Text("Your Place")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    private var placeholders: some View {
        VStack(spacing: 12) {
            ForEach(0 ..< 2, id: \.self) { i in
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(height: i == 0 ? 88 : 160)
            }
        }
    }

    private func errorBody(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(Theme.Color.appText)
            Button("Try again") { Task { await viewModel.refresh() } }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.primary600)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .placeCard()
    }

    private func neighborCard(_ mirror: HomeMirrorDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(mirror.viewerLabel.uppercased())
                .font(.system(size: 11, weight: .bold))
                .kerning(0.8)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(Theme.Color.homeBg)
                    Text(initial(of: mirror.owner?.name))
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Theme.Color.home)
                }
                .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(mirror.owner?.name ?? "A resident")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    HStack(spacing: 4) {
                        Icon(.mapPin, size: 13, strokeWidth: 2.25, color: Theme.Color.appTextSecondary)
                        Text(mirror.addressLine)
                            .font(.system(size: 13.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .accessibilityIdentifier("place.privacyMirror.address")
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .placeCard()
            Text(mirror.discoverable
                ? "Street only, no house number. That is the whole card."
                : "Your home is not discoverable right now, so neighbors see nothing unless you share it. "
                    + "This is what they would see if you did.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }

    private func hiddenList(_ mirror: HomeMirrorDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Icon(.eyeOff, size: 15, strokeWidth: 2.25, color: Theme.Color.appTextSecondary)
                Text("NEVER SHOWN TO NEIGHBORS")
                    .font(.system(size: 11, weight: .bold))
                    .kerning(0.8)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            ForEach(mirror.hidden) { item in
                Text(item.label)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appText)
                    .padding(.vertical, 6)
                if item.id != mirror.hidden.last?.id {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .placeCard()
    }

    private var promise: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Icon(.shieldCheck, size: 15, strokeWidth: 2.25, color: Theme.Color.home)
                Text("WHAT WE DO WITH YOUR ADDRESS")
                    .font(.system(size: 11, weight: .bold))
                    .kerning(0.8)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            ForEach(privacyPromiseLines, id: \.self) { line in
                HStack(alignment: .top, spacing: 8) {
                    Circle().fill(Theme.Color.homeSolid).frame(width: 4, height: 4).padding(.top, 7)
                    Text(line)
                        .font(.system(size: 13))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
    }

    private func initial(of name: String?) -> String {
        guard let first = name?.trimmingCharacters(in: .whitespaces).first else { return "·" }
        return String(first).uppercased()
    }
}
