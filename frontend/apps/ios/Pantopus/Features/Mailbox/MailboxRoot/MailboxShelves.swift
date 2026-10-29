//
//  MailboxShelves.swift
//  Pantopus
//
//  The Mailbox's other places (Mail tab drawings): the Counter with its
//  manila due tags (R9), the Vault's folders, search and archive (R10), the
//  closed Home box while the address waits for proof (R14), and the banner
//  for a vacation hold (R11).
//
// swiftlint:disable file_length

import SwiftUI

// MARK: - The Counter

struct MailCounterShelf: View {
    let viewModel: MailboxRootViewModel
    let hasMore: Bool

    var body: some View {
        let items = viewModel.counterItems
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text(items.count == 1 ? "1 waiting on you" : "\(items.count) waiting on you")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text("Soonest first. Done pieces go to the Vault.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            VStack(alignment: .leading, spacing: Spacing.s5) {
                ForEach(items) { item in
                    MailCounterRow(item: item, onOpen: { viewModel.openMail(item.id) }, onAction: { viewModel.act(on: item) })
                        .onAppear {
                            if item.id == items.last?.id { Task { await viewModel.loadMoreIfNeeded() } }
                        }
                }
                MailLoadMoreFooter(viewModel: viewModel, hasMore: hasMore)
            }
            .padding(.top, 18)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, 14)
        .padding(.bottom, Spacing.s4)
        .background(MailPaper.counter, in: RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .padding(.horizontal, Spacing.s3)
        .padding(.top, 14)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("mailboxCounter")
    }
}

private struct MailCounterRow: View {
    let item: MailCounterItem
    let onOpen: () -> Void
    let onAction: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Button(action: onOpen) {
                MailPieceView(model: item.piece)
                    .padding(.trailing, 44)
                    .overlay(alignment: .topTrailing) { MailDueTag(text: item.tag) }
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(item.spokenLabel)
            .accessibilityAddTraits(.isButton)
            .accessibilityIdentifier("mailCounterPiece.\(item.id)")
            // The letter opens out of this piece and goes back into it.
            .itemZoomSource(.mailPiece, id: item.id)
            HStack(alignment: .center, spacing: Spacing.s2) {
                (Text(item.lineTitle).fontWeight(.semibold)
                    + Text(item.lineDetail.map { " · \($0)" } ?? "")
                    .foregroundColor(item.isPressing ? Theme.Color.warning : Theme.Color.appTextSecondary))
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: onAction) {
                    Text(item.actionLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.primaryInk)
                        .padding(.horizontal, Spacing.s4)
                        .frame(minHeight: 44)
                        .background(Theme.Color.appSurface, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("mailCounterAction.\(item.id)")
            }
        }
    }
}

/// The manila tag tied to a piece on the Counter.
private struct MailDueTag: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .bold, design: .monospaced))
            .tracking(0.8)
            .multilineTextAlignment(.leading)
            .foregroundStyle(MailPaper.manilaInk)
            .padding(.leading, 18)
            .padding(.trailing, 10)
            .padding(.vertical, 6)
            .background(MailPaper.manila, in: UnevenRoundedRectangle(
                topLeadingRadius: 3,
                bottomLeadingRadius: 3,
                bottomTrailingRadius: 9,
                topTrailingRadius: 9,
                style: .continuous
            ))
            .overlay(alignment: .leading) {
                Circle()
                    .fill(MailPaper.counter)
                    .overlay(Circle().strokeBorder(MailPaper.manilaEdge, lineWidth: 1))
                    .frame(width: 6, height: 6)
                    .padding(.leading, 6)
            }
            .shadow(color: .black.opacity(0.12), radius: 2, x: 0, y: 2)
            .rotationEffect(.degrees(4))
            .offset(x: 2, y: 16)
            .accessibilityHidden(true)
    }
}

// MARK: - The Vault

struct MailVaultShelf: View {
    @Bindable var viewModel: MailboxRootViewModel
    let filedEmpty: Bool
    let hasMore: Bool
    /// The search box has the keyboard: a tap on the shelf below only closes it.
    @FocusState private var searchFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            searchField
            Group {
                if let results = viewModel.vaultResults {
                    searchResults(results)
                } else {
                    if viewModel.openFolder == nil {
                        folders
                    } else if let folder = viewModel.openFolder {
                        Button { viewModel.openVaultFolder(nil) } label: {
                            HStack(spacing: Spacing.s1) {
                                Icon(.chevronLeft, size: 16, strokeWidth: 2.25, color: Theme.Color.primaryInk)
                                Text("All folders")
                            }
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Color.primaryInk)
                            .frame(minHeight: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("mailVaultAllFolders")
                        sectionTitle(folder.label)
                    }
                    if viewModel.openFolder == nil { sectionTitle("Recently filed") }
                    if filedEmpty {
                        Text(viewModel.openFolder == nil
                            ? "Nothing filed yet. File a letter from its page and it waits here."
                            : "Nothing in this folder yet.")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .accessibilityIdentifier("mailVaultEmpty")
                    } else {
                        pieceRows(viewModel.pieceSections.flatMap(\.pieces), pagesMore: true)
                        MailLoadMoreFooter(viewModel: viewModel, hasMore: hasMore)
                    }
                    if viewModel.openFolder == nil, !viewModel.archivedPieces.isEmpty {
                        sectionTitle("Archived")
                        pieceRows(viewModel.archivedPieces)
                    }
                }
            }
            .closesKeyboardFirst(searchFocused)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, 14)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("mailboxVault")
    }

    private var searchField: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.search, size: 18, color: Theme.Color.appTextSecondary)
            TextField("Search everything you have filed", text: $viewModel.vaultQuery)
                .font(.system(size: 15))
                .focused($searchFocused)
                .submitLabel(.search)
                .onSubmit { Task { await viewModel.searchVault() } }
                .accessibilityIdentifier("mailVaultSearch")
            if viewModel.vaultSearching {
                ProgressView()
            } else if !viewModel.vaultQuery.isEmpty {
                Button { viewModel.clearVaultSearch() } label: {
                    Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.leading, Spacing.s3)
        .frame(minHeight: 44)
        .background(Theme.Color.appSurface, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        // Clearing the box keeps typing.
        .keepsKeyboardOnTap()
    }

    @ViewBuilder
    private var folders: some View {
        if let failure = viewModel.vaultFailure {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(failure)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Try again") { Task { await viewModel.refresh() } }
                    .font(.system(size: 14, weight: .semibold))
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("mailVaultRetry")
            }
        } else if !viewModel.vaultCabinets.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                ForEach(viewModel.vaultCabinets) { cabinet in
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        if let title = cabinet.title { sectionTitle(title) }
                        LazyVGrid(
                            columns: [GridItem(.flexible(), spacing: Spacing.s3), GridItem(.flexible(), spacing: Spacing.s3)],
                            spacing: 14
                        ) {
                            ForEach(cabinet.folders) { folder in
                                MailVaultFolder(folder: folder) { viewModel.openVaultFolder(folder) }
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func searchResults(_ results: [MailPieceModel]) -> some View {
        if !results.isEmpty {
            sectionTitle(results.count == 1 ? "1 filed piece matches" : "\(results.count) filed pieces match")
            pieceRows(results)
        }
        if results.isEmpty, !viewModel.vaultSearching, viewModel.vaultSearchFailure == nil {
            Text("Nothing you've filed matches. Try a sender or a word from the letter.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityIdentifier("mailVaultNoMatches")
        }
        MailSearchPageControls(
            isLoading: viewModel.vaultSearching,
            hasMore: viewModel.vaultHasMore,
            failure: viewModel.vaultSearchFailure
        ) {
            Task { await viewModel.searchVault(loadMore: viewModel.vaultHasMore) }
        }
        .accessibilityIdentifier("mailVaultSearchMore")
    }

    /// `pagesMore`: the filed list, whose last piece asks for the next page.
    private func pieceRows(_ pieces: [MailPieceModel], pagesMore: Bool = false) -> some View {
        LazyVStack(alignment: .leading, spacing: Spacing.s4) {
            ForEach(pieces) { piece in
                MailPieceRow(piece: piece) { viewModel.openMail(piece.id) }
                    .onAppear {
                        if pagesMore, piece.id == pieces.last?.id { Task { await viewModel.loadMoreIfNeeded() } }
                    }
            }
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .tracking(0.7)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.top, Spacing.s1)
            .accessibilityAddTraits(.isHeader)
    }
}

/// A Vault folder drawn as a manila folder with its tab.
private struct MailVaultFolder: View {
    let folder: VaultFolderDTO
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                UnevenRoundedRectangle(topLeadingRadius: 7, topTrailingRadius: 7, style: .continuous)
                    .fill(MailPaper.manilaTab)
                    .frame(width: 64, height: 12)
                HStack(alignment: .firstTextBaseline) {
                    Text(folder.label)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(MailPaper.handInk)
                        .lineLimit(2)
                    Spacer(minLength: Spacing.s1)
                    Text("\(folder.itemCount ?? 0)")
                        .font(.system(size: 13))
                        .foregroundStyle(MailPaper.manilaInk)
                }
                .padding(.horizontal, Spacing.s3)
                .frame(maxWidth: .infinity, minHeight: 64, alignment: .topLeading)
                .padding(.top, 10)
                .background(MailPaper.manila, in: UnevenRoundedRectangle(
                    bottomLeadingRadius: 10,
                    bottomTrailingRadius: 10,
                    topTrailingRadius: 10,
                    style: .continuous
                ))
                .shadow(color: .black.opacity(0.08), radius: 1, x: 0, y: 1)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(folder.label), \(folder.itemCount ?? 0) filed")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("mailVaultFolder.\(folder.id)")
    }
}

// MARK: - The closed Home box

/// The Home drawer while every Home here waits for proof of the address.
struct MailClosedHomeDrawer: View {
    let home: DrawerListResponse.MailboxHome
    let onVerify: () -> Void
    let onGoToMe: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ClosedMailbox()
                .frame(width: 150, height: 150)
                .accessibilityHidden(true)
            Text("Verify your home to get its mail")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .padding(.top, Spacing.s3)
                .accessibilityAddTraits(.isHeader)
            Text(
                "Bills, notices and ballot guides for your household come to the Home drawer once you verify you live at "
                    + "\(MailPieceModel.firstText(home.addressLine, home.name) ?? "your home")."
            )
            .font(.system(size: 15))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 6)
            PantopusButton(title: "Verify your home", kind: .primary) { onVerify() }
                .padding(.top, 18)
                .accessibilityIdentifier("mailClosedHomeVerify")
            Button(action: onGoToMe) {
                (Text("Your own mail still comes to ") + Text("Me").underline() + Text("."))
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.s1)
            .accessibilityIdentifier("mailClosedHomeGoToMe")
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, 28)
        .padding(.bottom, 22)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface, in: RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("mailClosedHome")
    }
}

/// A smaller note above the Home drawer's mail when one Home waits for proof.
struct MailHomeWaitingBanner: View {
    let home: DrawerListResponse.MailboxHome
    let onVerify: () -> Void

    var body: some View {
        Button(action: onVerify) {
            HStack(spacing: Spacing.s3) {
                Icon(.lock, size: 18, color: Theme.Color.appTextStrong)
                Text("\(MailPieceModel.firstText(home.name, home.addressLine) ?? "A home")'s mail waits until you verify the address.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("Verify")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.primaryInk)
            }
            .padding(Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("mailHomeWaiting")
    }
}

/// The grey padlocked mailbox from the drawing.
private struct ClosedMailbox: View {
    var body: some View {
        GeometryReader { geo in
            let unit = min(geo.size.width, geo.size.height) / 120
            ZStack(alignment: .topLeading) {
                Rectangle().fill(MailPaper.mailboxPost)
                    .frame(width: 12 * unit, height: 28 * unit)
                    .clipShape(RoundedRectangle(cornerRadius: 2 * unit))
                    .offset(x: 54 * unit, y: 92 * unit)
                MailboxArch(inset: 0).fill(MailPaper.lockedBody)
                    .frame(width: 84 * unit, height: 86 * unit)
                    .offset(x: 18 * unit, y: 8 * unit)
                MailboxArch(inset: 0).fill(MailPaper.lockedDoor)
                    .frame(width: 66 * unit, height: 70 * unit)
                    .offset(x: 27 * unit, y: 20 * unit)
                RoundedRectangle(cornerRadius: 2 * unit).fill(MailPaper.lockedPlate)
                    .frame(width: 40 * unit, height: 13 * unit)
                    .offset(x: 40 * unit, y: 68 * unit)
                Rectangle().fill(MailPaper.lockedBody)
                    .frame(width: 16 * unit, height: 7 * unit)
                    .clipShape(RoundedRectangle(cornerRadius: 1.5 * unit))
                    .offset(x: 102 * unit, y: 64 * unit)
                // The padlock.
                Circle().trim(from: 0.5, to: 1)
                    .stroke(MailPaper.lockedPlate, lineWidth: 3 * unit)
                    .frame(width: 14 * unit, height: 14 * unit)
                    .offset(x: 53 * unit, y: 41 * unit)
                RoundedRectangle(cornerRadius: 3 * unit).fill(MailPaper.lockedPlate)
                    .frame(width: 22 * unit, height: 16 * unit)
                    .offset(x: 49 * unit, y: 48 * unit)
            }
        }
    }
}

// MARK: - The vacation hold banner

struct MailHoldBanner: View {
    let hold: DrawerListResponse.MailVacationHold
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: Spacing.s3) {
                Icon(.calendarClock, size: 20, color: Theme.Color.info)
                VStack(alignment: .leading, spacing: 2) {
                    Text(hold.isActive ? "Your mail is on hold" : "Your mail hold is set")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(detail)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
            }
            .padding(Spacing.s3)
            .background(Theme.Color.infoBg, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(Theme.Color.infoLight, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("mailHoldBanner")
    }

    /// "Back Sun, Nov 29 · 3 days left · 4 pieces held", or when it starts.
    private var detail: String {
        let calendar = Calendar.current
        let now = Date()
        let end = hold.endDate.flatMap(MailDates.parseDay)
        let start = hold.startDate.flatMap(MailDates.parseDay)
        var parts: [String] = []
        if hold.isActive {
            if let end {
                parts.append("Back \(MailDates.dueDay(end, calendar: calendar))")
                let days = max(0, MailDates.daysBetween(now, end, calendar: calendar))
                parts.append(days == 1 ? "1 day left" : "\(days) days left")
            }
            parts.append(hold.heldCount == 1 ? "1 piece held" : "\(hold.heldCount) pieces held")
        } else {
            if let start { parts.append("Starts \(MailDates.dueDay(start, calendar: calendar))") }
            if let end { parts.append("back \(MailDates.dueDay(end, calendar: calendar))") }
        }
        return parts.joined(separator: " · ")
    }
}
