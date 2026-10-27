//
//  MailDetailViewModel+Letter.swift
//  Pantopus
//
//  The letter page's work (Mail tab, Mail build contract v1): the actions on
//  a piece through `POST /api/mailbox/v2/item/:id/action` (counter, done,
//  file, unfile, shred, acknowledge), the Vault's folders that fit it, its
//  enclosures through a fresh link each time, a bundle's pieces, and what
//  to say when it can't open.
//

import Foundation

extension MailDetailViewModel {
    // MARK: - Actions

    /// A tap on the letter page's actions. Pay is the view's (it opens the
    /// invoice); Done and Shred ask first; File asks for a folder.
    func tapLetterAction(_ action: MailLetterAction) async {
        switch action {
        case .pay:
            break
        case .done:
            confirmsDone = true
        case .shred:
            confirmsShred = true
        case .file:
            await openFilePicker()
        case .acknowledge, .counter, .unfile:
            await act(action)
        }
    }

    /// Runs one action on the server, then reads the piece again so the page
    /// shows where it stands now.
    func act(_ action: MailLetterAction, folderId: String? = nil) async {
        guard case .loaded = state, letterActionInFlight == nil, action != .pay else { return }
        confirmsDone = false
        confirmsShred = false
        showsFilePicker = false
        letterActionInFlight = action
        defer { letterActionInFlight = nil }
        do {
            let _: MailboxItemActionResponse = try await api.request(
                MailboxV2Endpoints.itemAction(mailId: mailId, action: action.rawValue, folderId: folderId)
            )
            toast = Self.doneToast(action, folder: fileFolders.first { $0.id == folderId }?.label)
            let center = NotificationCenter.default
            switch action {
            case .done, .file, .shred:
                // It leaves Incoming and the Counter.
                center.post(name: .mailboxMailLeftList, object: mailId)
            case .unfile:
                // It leaves the Vault and comes back to Incoming.
                center.post(name: .mailboxMailLeftList, object: mailId)
                center.post(name: .mailboxMailChanged, object: mailId)
            case .counter, .acknowledge:
                center.post(name: .mailboxMailChanged, object: mailId)
            case .pay:
                break
            }
            await refresh()
        } catch {
            toast = Self.actionFailure(error, action: action)
        }
    }

    /// File in the Vault: the folders that fit this piece (its Home's shared
    /// cabinet for Home mail, the person's own otherwise). No folder yet:
    /// it's filed where the server puts it.
    func openFilePicker() async {
        guard case let .loaded(content) = state, let letter = content.letter, letterActionInFlight == nil else { return }
        letterActionInFlight = .file
        let folders: [VaultFolderDTO]
        do {
            let response: VaultFoldersResponse = try await api.request(MailboxVaultEndpoints.folders(drawer: letter.drawer))
            folders = Self.folders(response.folders, fitting: letter)
        } catch {
            letterActionInFlight = nil
            toast = Self.foldersFailure(error)
            return
        }
        letterActionInFlight = nil
        fileFolders = folders
        if folders.isEmpty {
            await act(.file)
        } else {
            showsFilePicker = true
        }
    }

    static func folders(_ folders: [VaultFolderDTO], fitting letter: MailLetter) -> [VaultFolderDTO] {
        folders
            .filter { folder in
                if let homeId = letter.homeId { return folder.homeId == homeId }
                return folder.homeId == nil && folder.drawer == letter.drawer
            }
            .sorted { ($0.sortOrder ?? 0, $0.label) < ($1.sortOrder ?? 0, $1.label) }
    }

    /// What the toast says once an action is done.
    static func doneToast(_ action: MailLetterAction, folder: String?) -> String {
        switch action {
        case .counter: "On the counter."
        case .done: "Done. It's in the Vault."
        case .file: folder.map { "Filed in \($0)." } ?? "Filed in the Vault."
        case .unfile: "Back in Incoming."
        case .shred: "Shredded. You can bring it back for 30 days."
        case .acknowledge: "Acknowledged."
        case .pay: ""
        }
    }

    /// What went wrong, in words: offline, the server's own sentence, or trouble on our side.
    static func actionFailure(_ error: Error, action: MailLetterAction) -> String {
        let verb = switch action {
        case .counter: "put it on the counter"
        case .done: "mark it done"
        case .file: "file it"
        case .unfile: "take it out of the Vault"
        case .shred: "shred it"
        case .acknowledge: "acknowledge it"
        case .pay: "pay it"
        }
        switch error as? APIError {
        case .transport:
            return "You're offline, so we couldn't \(verb). Check your connection and try again."
        case let .forbidden(message):
            return message ?? "We couldn't \(verb)."
        case let .clientError(status, message):
            return APIError.clientError(status: status, message: message).errorDescription ?? "We couldn't \(verb)."
        case .notFound:
            return "This mail isn't in your mailbox any more, so we couldn't \(verb)."
        default:
            return "We couldn't \(verb) just now. Try again in a moment."
        }
    }

    static func foldersFailure(_ error: Error) -> String {
        if case .transport = error as? APIError {
            return "You're offline, so we couldn't open your Vault. Check your connection and try again."
        }
        return "We couldn't open your Vault just now. Try again in a moment."
    }

    // MARK: - Loading

    /// Why the piece couldn't open, in words.
    static func loadFailure(_ error: Error) -> String {
        switch error as? APIError {
        case .notFound:
            "This mail isn't in your mailbox. It may have been shredded, or it was meant for someone else."
        case let .forbidden(message):
            message ?? "Prove your address to open your home's mail."
        case .transport:
            "You're offline. Check your connection and try again."
        case let .some(apiError):
            apiError.errorDescription ?? "We couldn't open this mail. Try again in a moment."
        case .none:
            "We couldn't open this mail. Try again in a moment."
        }
    }

    /// A Home letter waiting for proof: which Home to verify (the one whose
    /// mail waits for proof, from the person's mailbox).
    func findHomeNeedingProof() async {
        needsProof = true
        if let home = MailBadgeStore.shared.homes.first(where: { !$0.isOpen }) {
            proofHomeId = home.homeId
            return
        }
        let response: DrawerListResponse? = try? await api.request(MailboxV2Endpoints.drawers())
        proofHomeId = response?.homes.first { !$0.isOpen }?.homeId
    }

    /// A bundle opens to its pieces (`GET /api/mailbox/v2/item/:id`, `pieces`).
    func loadBundle() async {
        guard !bundleLoading else { return }
        bundleLoading = true
        bundleFailure = nil
        defer { bundleLoading = false }
        do {
            let response: MailboxV2ItemResponse = try await api.request(MailboxV2Endpoints.item(mailId: mailId))
            let homes = MailBadgeStore.shared.homes
            let person = MailPieceRecipient.personName
            bundlePieces = response.mail.pieces.map { row in
                MailPieceModel(
                    mail: row,
                    recipient: MailPieceRecipient.of(row, homeMail: false, homes: homes, personName: person),
                    opened: row.item.viewed
                )
            }
        } catch {
            bundleFailure = if case .transport = error as? APIError {
                "You're offline, so the bundle couldn't open. Check your connection and try again."
            } else {
                "The bundle couldn't open just now. Try again in a moment."
            }
        }
    }

    // MARK: - Enclosures

    /// Opens an enclosure: a fresh link from the server each time (they last
    /// five minutes), the file saved for Quick Look. An expired link is asked
    /// for again once.
    func openEnclosure(_ enclosure: MailEnclosure) async {
        guard openingEnclosure == nil else { return }
        openingEnclosure = enclosure.id
        defer { openingEnclosure = nil }
        do {
            quickLookURL = try await downloadEnclosure(enclosure, retryingExpired: true)
        } catch {
            toast = Self.enclosureFailure(error)
        }
    }

    private func downloadEnclosure(_ enclosure: MailEnclosure, retryingExpired: Bool) async throws -> URL {
        let link: MailEnclosureLink = try await api.request(
            MailboxEndpoints.enclosureLink(mailId: mailId, enclosureId: enclosure.id)
        )
        guard let url = URL(string: link.url) else { throw EnclosureError.unreadable }
        let (data, response) = try await URLSession.shared.data(from: url)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 200
        if status == 400 || status == 403, retryingExpired {
            // The signed link ran out between asking and opening: ask again.
            return try await downloadEnclosure(enclosure, retryingExpired: false)
        }
        guard (200..<300).contains(status), !data.isEmpty else { throw EnclosureError.unavailable }
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("mail-\(mailId)", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let file = folder.appendingPathComponent(Self.fileName(for: enclosure))
        try data.write(to: file, options: .atomic)
        return file
    }

    /// The enclosure's name with an extension Quick Look understands.
    static func fileName(for enclosure: MailEnclosure) -> String {
        let name = enclosure.name.replacingOccurrences(of: "/", with: "-")
        guard (name as NSString).pathExtension.isEmpty else { return name }
        return switch enclosure.mimeType ?? "" {
        case "application/pdf": "\(name).pdf"
        case "image/jpeg": "\(name).jpg"
        case "image/png": "\(name).png"
        case "image/heic": "\(name).heic"
        default: name
        }
    }

    static func enclosureFailure(_ error: Error) -> String {
        switch error {
        case let apiError as APIError:
            switch apiError {
            case .transport: "You're offline, so it couldn't open. Check your connection and try again."
            case .notFound: "This letter doesn't have that enclosure any more."
            case let .clientError(_, message?): message
            default: "Couldn't open this file just now. Try again in a moment."
            }
        case is URLError: "You're offline, so it couldn't open. Check your connection and try again."
        default: "Couldn't open this file just now. Try again in a moment."
        }
    }

    enum EnclosureError: Error {
        case unreadable
        case unavailable
    }
}

extension Notification.Name {
    /// A piece changed where it stands (on the counter, back in Incoming,
    /// restored): the Mailbox reads its list again when it's next shown.
    static let mailboxMailChanged = Notification.Name("mailboxMailChanged")
}
