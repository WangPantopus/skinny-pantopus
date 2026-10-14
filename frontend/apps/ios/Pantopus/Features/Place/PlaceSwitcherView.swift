//
//  PlaceSwitcherView.swift
//  Pantopus
//
//  C2 — "Your homes", the sheet behind the address on Your Place. Lists
//  every Home the person can open (shared or their private setup), then
//  entries still waiting on verification, with Add a home and Manage
//  homes. With two or more Homes, one carries the Default pill and the
//  others "Set default" (`PUT /api/homes/default`): Place lands on the
//  default and Today follows it. Fetches `/api/homes/my-homes` through the
//  screen store; the app's sheet chrome provides the scrim.
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
    /// The person's default Home (shown when they can open two or more).
    var isDefault = false
    /// Offers "Set default" (another openable Home, two or more of them).
    var canSetDefault = false

    /// This row once `homeId` is the default.
    func withDefault(_ homeId: String) -> PlaceSwitcherRow {
        guard isDefault || canSetDefault else { return self }
        var row = self
        row.isDefault = id == homeId
        row.canSetDefault = id != homeId
        return row
    }
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
    /// The Home whose "Set default" is in flight.
    private(set) var savingDefaultId: String?
    /// "Couldn't change your default home." after a failed change.
    private(set) var defaultError: String?

    private let api: APIClient
    let onSelect: (String) -> Void
    let onAddPlace: () -> Void
    let onManageHomes: () -> Void
    let onDefaultChanged: (String) -> Void
    let onClose: () -> Void

    init(
        activeHomeId: String,
        api: APIClient = .shared,
        onSelect: @escaping (String) -> Void = { _ in },
        onAddPlace: @escaping () -> Void = {},
        onManageHomes: @escaping () -> Void = {},
        onDefaultChanged: @escaping (String) -> Void = { _ in },
        onClose: @escaping () -> Void = {}
    ) {
        self.activeHomeId = activeHomeId
        self.api = api
        self.onSelect = onSelect
        self.onAddPlace = onAddPlace
        self.onManageHomes = onManageHomes
        self.onDefaultChanged = onDefaultChanged
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

    /// Makes `homeId` the default: the sheet updates in place and stays open,
    /// and the lists that follow the default (homes, Today) read again. On
    /// failure the rows stay as they were, with a line saying so.
    func setDefault(_ homeId: String) async {
        guard savingDefaultId == nil, case let .loaded(rows) = state else { return }
        savingDefaultId = homeId
        defaultError = nil
        defer { savingDefaultId = nil }
        do {
            let _: SetDefaultHomeResponse = try await api.request(HomesEndpoints.setDefaultHome(homeId: homeId))
            state = .loaded(rows.map { $0.withDefault(homeId) })
            onDefaultChanged(homeId)
            ScreenStore.store(for: api).markStale(topics: [ScreenTopic.homes, ScreenTopic.today])
        } catch {
            defaultError = "Couldn't change your default home. Try again."
        }
    }

    /// Homes the person can open, by address, then the entries still waiting
    /// on verification. A private setup is a Home too: it is listed. With two
    /// or more openable Homes, the default carries its pill and the others
    /// offer "Set default".
    static func rows(for response: MyHomesResponse) -> [PlaceSwitcherRow] {
        let entries = response.homes.filter(\.hasValidListContext)
        let openable = PlaceRootResolver.openableHomes(in: response)
            .sorted { line1(for: $0).localizedStandardCompare(line1(for: $1)) == .orderedAscending }
        let pending = entries.filter { $0.accessKind == "verification" }
        let defaultId = openable.count > 1 ? response.defaultHomeId : nil
        return openable.map { home in
            var row = row(for: home, kind: .home)
            if let defaultId {
                row.isDefault = home.id == defaultId
                row.canSetDefault = home.id != defaultId
            }
            return row
        } + pending.map { row(for: $0, kind: .pending) }
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
                        PlaceSwitcherRowView(
                            row: row,
                            isActive: row.id == viewModel.activeHomeId,
                            isSavingDefault: viewModel.savingDefaultId == row.id,
                            onTap: {
                                switch row.kind {
                                case .home: viewModel.onSelect(row.id)
                                case .pending: viewModel.onManageHomes()
                                }
                            },
                            onSetDefault: { Task { await viewModel.setDefault(row.id) } }
                        )
                        .disabled(viewModel.savingDefaultId != nil)
                    }
                    if let message = viewModel.defaultError {
                        Text(message)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Theme.Color.error)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 14)
                            .padding(.top, Spacing.s1)
                            .accessibilityIdentifier("place.switcher.defaultError")
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
    var isSavingDefault = false
    var onTap: () -> Void
    var onSetDefault: () -> Void = {}

    private var showsDefaultLine: Bool {
        row.isDefault || row.canSetDefault
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            selectButton
            if row.isDefault {
                defaultPill
            } else if row.canSetDefault {
                setDefaultButton
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(isActive ? Theme.Color.infoBg : Color.clear)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(isActive ? Theme.Color.primary200 : Color.clear, lineWidth: 1.5)
        )
    }

    /// Under the address: the icon tile (40) and its gap (12) inside the row's padding (14).
    private let detailInset: CGFloat = 66

    private var defaultPill: some View {
        Text("Default")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Theme.Color.primaryInk)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Capsule().fill(Theme.Color.primary100))
            .padding(.leading, detailInset)
            .padding(.bottom, 12)
            .accessibilityLabel("Default home")
    }

    private var setDefaultButton: some View {
        Button(action: onSetDefault) {
            Text(isSavingDefault ? "Saving…" : "Set default")
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(Theme.Color.primaryInk)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.leading, detailInset)
        .accessibilityLabel("Make \(row.line1) your default home")
        .accessibilityIdentifier("place.switcher.default.\(row.id)")
    }

    private var selectButton: some View {
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
            .padding(.top, 13)
            .padding(.bottom, showsDefaultLine ? 4 : 13)
            .padding(.horizontal, 14)
            .contentShape(Rectangle())
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
