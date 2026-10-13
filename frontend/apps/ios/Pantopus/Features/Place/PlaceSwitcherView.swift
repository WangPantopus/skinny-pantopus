//
//  PlaceSwitcherView.swift
//  Pantopus
//
//  C2 — "Your homes", the sheet behind the address on Your Place. Lists
//  every Home the person can open (shared or their private setup), then
//  entries still waiting on verification, with Add a home and Manage
//  homes. Fetches `/api/homes/my-homes` through the screen store; the
//  app's sheet chrome provides the scrim.
//

import SwiftUI

// MARK: - Row model

struct PlaceSwitcherRow: Identifiable, Hashable {
    /// `home` opens Your Place for it; `pending` (a claim or residency
    /// request still in review) opens My homes, where its status lives.
    enum Kind: Hashable { case home, pending }

    let id: String
    let line1: String
    let subtitle: String
    let kind: Kind
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
    let onManageHomes: () -> Void
    let onClose: () -> Void

    init(
        activeHomeId: String,
        api: APIClient = .shared,
        onSelect: @escaping (String) -> Void = { _ in },
        onAddPlace: @escaping () -> Void = {},
        onManageHomes: @escaping () -> Void = {},
        onClose: @escaping () -> Void = {}
    ) {
        self.activeHomeId = activeHomeId
        self.api = api
        self.onSelect = onSelect
        self.onAddPlace = onAddPlace
        self.onManageHomes = onManageHomes
        self.onClose = onClose
        // The shared home list shows at once when the store has it.
        if let copy = ScreenStore.store(for: api).peek(HomesEndpoints.myHomes(), as: MyHomesResponse.self) {
            state = .loaded(Self.rows(for: copy.value))
        }
    }

    func load() async {
        do {
            let response = try await HomesStoreReads.myHomes(store: ScreenStore.store(for: api)).value
            state = .loaded(Self.rows(for: response))
        } catch let error as APIError {
            state = .error(message: error.errorDescription ?? "Couldn't load your homes.")
        } catch {
            state = .error(message: "Couldn't load your homes.")
        }
    }

    /// Homes the person can open, by address, then the entries still waiting
    /// on verification. A private setup is a Home too: it is listed.
    static func rows(for response: MyHomesResponse) -> [PlaceSwitcherRow] {
        let entries = response.homes.filter(\.hasValidListContext)
        let openable = PlaceRootResolver.openableHomes(in: response)
            .sorted { line1(for: $0).localizedStandardCompare(line1(for: $1)) == .orderedAscending }
        let pending = entries.filter { $0.accessKind == "verification" }
        return openable.map { row(for: $0, kind: .home) } + pending.map { row(for: $0, kind: .pending) }
    }

    private static func row(for home: MyHome, kind: PlaceSwitcherRow.Kind) -> PlaceSwitcherRow {
        PlaceSwitcherRow(id: home.id, line1: line1(for: home), subtitle: subtitle(for: home), kind: kind)
    }

    private static func line1(for home: MyHome) -> String {
        home.home.address?.nilIfEmpty ?? home.home.name?.nilIfEmpty ?? "Home"
    }

    /// "Camas, WA · Verified" / "· Claimed" / "· Private setup"; a request in
    /// review says where it stands instead. Verified means verified ownership
    /// or a verified household place, as My homes' chips say
    /// (`verification_tier` is the evidence strength, never "verified").
    static func subtitle(for home: MyHome) -> String {
        if home.accessKind == "verification" {
            return home.pendingClaimId != nil ? "Ownership in review" : "Verification in progress"
        }
        let status = if home.accessKind == "private_setup" {
            "Private setup"
        } else if home.ownershipStatus == "verified" || home.occupancy?.verificationStatus == "verified" {
            "Verified"
        } else {
            "Claimed"
        }
        let city = [home.home.city, home.home.state].compactMap { $0?.nilIfEmpty }.joined(separator: ", ")
        return city.isEmpty ? status : "\(city) · \(status)"
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
            Text("Your homes")
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
                            switch row.kind {
                            case .home: viewModel.onSelect(row.id)
                            case .pending: viewModel.onManageHomes()
                            }
                        }
                    }
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                    addPlaceRow
                    manageHomesButton
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
                    Icon(.plus, size: 21, strokeWidth: 2.25, color: Theme.Color.primaryInk)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Add a home")
                        .font(.system(size: 15.5, weight: .semibold))
                        .kerning(-0.15)
                        .foregroundStyle(Theme.Color.primaryInk)
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

    private var manageHomesButton: some View {
        Button { viewModel.onManageHomes() } label: {
            Text("Manage homes")
                .font(.system(size: 14.5, weight: .semibold))
                .foregroundStyle(Theme.Color.primaryInk)
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.top, Spacing.s1)
        .accessibilityIdentifier("place.switcher.manage")
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
                        row.kind == .pending ? .clock : .home,
                        size: 21,
                        strokeWidth: 2,
                        color: isActive ? Theme.Color.primaryInk : Theme.Color.appTextSecondary
                    )
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.line1)
                        .font(.system(size: 15.5, weight: .semibold))
                        .kerning(-0.15)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(row.subtitle)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if isActive {
                    Icon(.check, size: 18, strokeWidth: 2.5, color: Theme.Color.primaryInk)
                        .accessibilityHidden(true)
                } else {
                    PlaceChevron()
                }
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
        .accessibilityAddTraits(isActive ? .isSelected : [])
        .accessibilityIdentifier("place.switcher.row.\(row.id)")
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
