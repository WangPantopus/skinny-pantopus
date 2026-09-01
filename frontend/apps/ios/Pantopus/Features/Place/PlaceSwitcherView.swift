//
//  PlaceSwitcherView.swift
//  Pantopus
//
//  C2 — the multi-home switcher bottom sheet. Ported from
//  `place-switcher.jsx`. Lists the resident's places (verified / claimed
//  status), highlights the active one, and offers "Add a place". Fetches
//  `/api/homes/my-homes`; the app's existing sheet chrome provides the
//  grabber + scrim.
//

import SwiftUI

// MARK: - Row model

struct PlaceSwitcherRow: Identifiable, Hashable {
    let id: String
    let line1: String
    let city: String
    let isVerified: Bool
    var initials: String
}

// MARK: - ViewModel

@Observable
@MainActor
final class PlaceSwitcherViewModel {
    enum State {
        case loading
        case loaded([PlaceSwitcherRow])
        case error(message: String)
    }

    private(set) var state: State = .loading
    let activeHomeId: String

    private let api: APIClient
    let onSelect: (String) -> Void
    let onAddPlace: () -> Void
    let onClose: () -> Void

    init(
        activeHomeId: String,
        api: APIClient = .shared,
        onSelect: @escaping (String) -> Void = { _ in },
        onAddPlace: @escaping () -> Void = {},
        onClose: @escaping () -> Void = {}
    ) {
        self.activeHomeId = activeHomeId
        self.api = api
        self.onSelect = onSelect
        self.onAddPlace = onAddPlace
        self.onClose = onClose
    }

    func load() async {
        do {
            let response: MyHomesResponse = try await api.request(HomesEndpoints.myHomes())
            state = .loaded(response.homes.map(Self.row(for:)))
        } catch let error as APIError {
            state = .error(message: error.errorDescription ?? "Couldn't load your places.")
        } catch {
            state = .error(message: "Couldn't load your places.")
        }
    }

    private static func row(for home: MyHome) -> PlaceSwitcherRow {
        let line1 = home.home.address ?? home.home.name ?? "A place"
        let cityParts = [home.home.city, home.home.state].compactMap { $0 }.filter { !$0.isEmpty }
        let verified = (home.verificationTier?.lowercased() == "verified")
        return PlaceSwitcherRow(
            id: home.id,
            line1: line1,
            city: cityParts.joined(separator: ", "),
            isVerified: verified,
            initials: Self.initials(line1)
        )
    }

    private static func initials(_ label: String) -> String {
        let words = label.split { $0 == " " || $0 == "," }
            .filter { $0.first?.isLetter ?? false }
        let letters = words.prefix(2).compactMap(\.first).map(String.init)
        return letters.isEmpty ? "PL" : letters.joined().uppercased()
    }
}

// MARK: - Sheet

struct PlaceSwitcherSheet: View {
    @State private var viewModel: PlaceSwitcherViewModel

    init(viewModel: PlaceSwitcherViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        VStack(spacing: 0) {
            grabber
            header
            content
        }
        .background(Theme.Color.appSurface)
        .task { await viewModel.load() }
    }

    private var grabber: some View {
        Capsule()
            .fill(Theme.Color.appBorder)
            .frame(width: 38, height: 5)
            .padding(.top, 9)
    }

    private var header: some View {
        HStack {
            Text("Switch place")
                .font(.system(size: 19, weight: .bold))
                .kerning(-0.28)
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            Button { viewModel.onClose() } label: {
                Icon(.x, size: 17, strokeWidth: 2.25, color: Theme.Color.appTextSecondary)
                    .frame(width: 30, height: 30)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
        .padding(.horizontal, 18)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            VStack(spacing: 2) {
                ForEach(0..<2, id: \.self) { _ in
                    PlaceSkeleton(widthFraction: 1, height: 66, radius: 14)
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 2)
            Spacer(minLength: 0)
        case let .loaded(rows):
            ScrollView {
                VStack(spacing: 2) {
                    ForEach(rows) { row in
                        PlaceSwitcherRowView(row: row, isActive: row.id == viewModel.activeHomeId) {
                            viewModel.onSelect(row.id)
                        }
                    }
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                    addPlaceRow
                }
                .padding(.horizontal, 12)
                .padding(.bottom, Spacing.s10)
            }
        case let .error(message):
            ErrorState(message: message) { await viewModel.load() }
        }
    }

    private var addPlaceRow: some View {
        Button { viewModel.onAddPlace() } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .fill(Theme.Color.primary100)
                    Icon(.plus, size: 21, strokeWidth: 2.25, color: Theme.Color.primary600)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Add a place")
                        .font(.system(size: 15.5, weight: .semibold))
                        .kerning(-0.15)
                        .foregroundStyle(Theme.Color.primary600)
                    Text("Claim or verify another address")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                PlaceChevron()
            }
            .padding(.vertical, 13)
            .padding(.horizontal, 14)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("place.switcher.add")
    }
}

// MARK: - Row

struct PlaceSwitcherRowView: View {
    let row: PlaceSwitcherRow
    let isActive: Bool
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .fill(isActive ? Theme.Color.primary100 : Theme.Color.appSurfaceSunken)
                    Icon(
                        .home,
                        size: 21,
                        strokeWidth: 2,
                        color: isActive ? Theme.Color.primary600 : Theme.Color.appTextSecondary
                    )
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.line1)
                        .font(.system(size: 15.5, weight: .semibold))
                        .kerning(-0.15)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(isActive ? "Current place" : row.city)
                        .font(.system(size: 13, weight: isActive ? .semibold : .medium))
                        .foregroundStyle(isActive ? Theme.Color.primary700 : Theme.Color.appTextMuted)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                PlaceChip(model: row.isVerified
                    ? PlaceChipModel(tone: .success, text: "Verified", icon: .shieldCheck)
                    : PlaceChipModel(tone: .warning, text: "Claimed", icon: .home))
                PlaceChevron()
            }
            .padding(.vertical, 13)
            .padding(.horizontal, 14)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isActive ? Theme.Color.infoBg : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(isActive ? Theme.Color.primary200 : Color.clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("place.switcher.row.\(row.id)")
    }
}
