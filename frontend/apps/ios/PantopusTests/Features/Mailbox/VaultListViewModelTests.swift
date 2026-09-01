//
//  VaultListViewModelTests.swift
//  PantopusTests
//
//  T6.5e (P19.5) — Tests for the Mailbox Vault list VM. Covers the
//  four-state lifecycle, cross-folder flattening + sort, row
//  projection, and client-side query filtering.
//

// swiftlint:disable type_body_length

import XCTest
@testable import Pantopus

@MainActor
final class VaultListViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    // MARK: - Four states

    func testLoadEmptyRendersEmptyState() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"folders\":[]}")
        ]
        let vm = VaultListViewModel(api: makeAPI())
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "Your vault is empty")
        XCTAssertEqual(content.icon, .archive)
    }

    func testLoadErrorRendersErrorState() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = VaultListViewModel(api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected error, got \(vm.state)")
            return
        }
    }

    func testLoadLoadedRendersRowsAcrossFolders() async {
        // 2 folders. First has 2 items, second has 1 — the flattened
        // list shows 3 rows sorted by createdAt desc.
        let foldersBody = """
        {"folders":[
          {
            "id":"f1","user_id":"u1","drawer":"personal","label":"Civic",
            "icon":"📋","color":"#1E40AF","system":true,"item_count":2,
            "sort_order":0,"created_at":"2026-05-01T00:00:00Z"
          },
          {
            "id":"f2","user_id":"u1","drawer":"personal","label":"Receipts",
            "icon":"🧾","color":"#D97706","system":true,"item_count":1,
            "sort_order":1,"created_at":"2026-05-02T00:00:00Z"
          }
        ]}
        """
        let f1Items = """
        {"items":[
          {
            "id":"m1","mail_type":"notice","subject":"Block-party permit",
            "sender_business_name":"PBOT","created_at":"2026-05-14T12:00:00Z",
            "lifecycle":"filed","vault_folder_id":"f1"
          },
          {
            "id":"m2","mail_type":"notice","subject":"Sewer cleaning",
            "sender_business_name":"Water Bureau","created_at":"2026-05-13T12:00:00Z",
            "lifecycle":"filed","vault_folder_id":"f1"
          }
        ],"total":2}
        """
        let f2Items = """
        {"items":[
          {
            "id":"m3","mail_type":"receipt","subject":"Costco statement",
            "sender_business_name":"Costco","created_at":"2026-05-15T12:00:00Z",
            "lifecycle":"filed","vault_folder_id":"f2"
          }
        ],"total":1}
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: foldersBody),
            .status(200, body: f1Items),
            .status(200, body: f2Items)
        ]
        let vm = VaultListViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 3)
        // Newest first — m3 (May 15) before m1 (May 14) before m2 (May 13).
        XCTAssertEqual(sections.first?.rows.map(\.id), ["m3", "m1", "m2"])
    }

    // MARK: - Projection helpers

    func testFlattenSortsByCreatedAtDesc() {
        let folder = VaultFolderDTO(
            id: "f1",
            userId: "u1",
            drawer: "personal",
            label: "Civic",
            icon: nil,
            color: nil,
            system: true,
            itemCount: nil,
            sortOrder: 0,
            createdAt: nil
        )
        let older = VaultMailItemDTO(
            id: "m1",
            mailType: "notice",
            type: nil,
            subject: "A",
            displayTitle: nil,
            previewText: nil,
            senderAddress: nil,
            senderBusinessName: "X",
            createdAt: "2026-05-13T00:00:00Z",
            lifecycle: "filed",
            viewedAt: nil,
            attachments: nil,
            vaultFolderId: "f1"
        )
        let newer = VaultMailItemDTO(
            id: "m2",
            mailType: "notice",
            type: nil,
            subject: "B",
            displayTitle: nil,
            previewText: nil,
            senderAddress: nil,
            senderBusinessName: "Y",
            createdAt: "2026-05-14T00:00:00Z",
            lifecycle: "filed",
            viewedAt: nil,
            attachments: nil,
            vaultFolderId: "f1"
        )
        let rows = VaultListViewModel.flatten(
            folders: [folder],
            itemsByFolder: ["f1": [older, newer]]
        )
        XCTAssertEqual(rows.map(\.id), ["m2", "m1"])
    }

    func testFilterMatchesTitleSubtitleOrFolderLabel() {
        let civicFolder = VaultFolderDTO(
            id: "f1",
            userId: "u1",
            drawer: "personal",
            label: "Civic",
            icon: nil,
            color: nil,
            system: true,
            itemCount: nil,
            sortOrder: 0,
            createdAt: nil
        )
        let receiptsFolder = VaultFolderDTO(
            id: "f2",
            userId: "u1",
            drawer: "personal",
            label: "Receipts",
            icon: nil,
            color: nil,
            system: true,
            itemCount: nil,
            sortOrder: 1,
            createdAt: nil
        )
        let permit = VaultListRow(
            id: "m1",
            item: VaultMailItemDTO(
                id: "m1",
                mailType: "permit",
                type: nil,
                subject: "Block-party permit approved",
                displayTitle: nil,
                previewText: nil,
                senderAddress: nil,
                senderBusinessName: "PBOT",
                createdAt: nil,
                lifecycle: "filed",
                viewedAt: nil,
                attachments: nil,
                vaultFolderId: "f1"
            ),
            folder: civicFolder
        )
        let receipt = VaultListRow(
            id: "m2",
            item: VaultMailItemDTO(
                id: "m2",
                mailType: "receipt",
                type: nil,
                subject: "Costco statement",
                displayTitle: nil,
                previewText: nil,
                senderAddress: nil,
                senderBusinessName: "Costco",
                createdAt: nil,
                lifecycle: "filed",
                viewedAt: nil,
                attachments: nil,
                vaultFolderId: "f2"
            ),
            folder: receiptsFolder
        )
        let rows = [permit, receipt]
        XCTAssertEqual(VaultListViewModel.filter(rows: rows, query: "permit").map(\.id), ["m1"])
        XCTAssertEqual(VaultListViewModel.filter(rows: rows, query: "costco").map(\.id), ["m2"])
        XCTAssertEqual(VaultListViewModel.filter(rows: rows, query: "Civic").map(\.id), ["m1"])
        XCTAssertEqual(VaultListViewModel.filter(rows: rows, query: "Receipts").map(\.id), ["m2"])
        XCTAssertEqual(VaultListViewModel.filter(rows: rows, query: "").count, 2)
    }

    // MARK: - Type-icon mapping

    func testMailTypeMappingPicksAccentForKnownTypes() {
        XCTAssertEqual(MailboxVaultMailType.fromRaw("notice"), .notice)
        XCTAssertEqual(MailboxVaultMailType.fromRaw("permit"), .permit)
        XCTAssertEqual(MailboxVaultMailType.fromRaw("receipt"), .receipt)
        XCTAssertEqual(MailboxVaultMailType.fromRaw("scan"), .scan)
        XCTAssertEqual(MailboxVaultMailType.fromRaw("package"), .parcel)
        XCTAssertEqual(MailboxVaultMailType.fromRaw(nil), .letter)
        XCTAssertEqual(MailboxVaultMailType.fromRaw("unknown"), .letter)
    }

    // MARK: - Query filter

    func testQueryChangeUpdatesLoadedRows() async {
        let foldersBody = """
        {"folders":[
          {
            "id":"f1","user_id":"u1","drawer":"personal","label":"Receipts",
            "icon":"🧾","color":"#D97706","system":true,"item_count":2,"sort_order":0
          }
        ]}
        """
        let itemsBody = """
        {"items":[
          {
            "id":"m1","mail_type":"receipt","subject":"Costco statement",
            "sender_business_name":"Costco","created_at":"2026-05-15T12:00:00Z",
            "lifecycle":"filed","vault_folder_id":"f1"
          },
          {
            "id":"m2","mail_type":"receipt","subject":"Trader Joes statement",
            "sender_business_name":"TJ","created_at":"2026-05-14T12:00:00Z",
            "lifecycle":"filed","vault_folder_id":"f1"
          }
        ],"total":2}
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: foldersBody),
            .status(200, body: itemsBody)
        ]
        let vm = VaultListViewModel(api: makeAPI())
        await vm.load()
        guard case .loaded = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        vm.onQueryChange("Costco")
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded after filter, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.id, "m1")
    }

    // MARK: - Server-side search (RN `vault.tsx:65` performSearch)

    func testPerformSearchRendersServerResultsAcrossDrawers() async {
        let searchBody = """
        {"results":[
          {
            "id":"s1","drawer":"business","mail_type":"receipt",
            "subject":"Costco statement","preview_text":"Your July statement",
            "sender_display":"Costco Wholesale","created_at":"2026-05-15T12:00:00Z",
            "_matchField":"sender","_matchExcerpt":"Costco Wholesale"
          }
        ],"total":1,"query":"Costco"}
        """
        SequencedURLProtocol.sequence = [.status(200, body: searchBody)]
        let vm = VaultListViewModel(api: makeAPI())
        vm.query = "Costco"
        await vm.performSearch()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded search results, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.header, "1 result · All drawers")
        XCTAssertEqual(sections.first?.rows.map(\.id), ["s1"])
        XCTAssertEqual(sections.first?.rows.first?.title, "Costco Wholesale")
    }

    func testPerformSearchWithNoResultsRendersNoMatchesEmpty() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"results\":[],\"total\":0,\"query\":\"zzz\"}")
        ]
        let vm = VaultListViewModel(api: makeAPI())
        vm.query = "zzz"
        await vm.performSearch()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No matches found")
    }

    func testPerformSearchFailureRendersErrorState() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = VaultListViewModel(api: makeAPI())
        vm.query = "Costco"
        await vm.performSearch()
        guard case .error = vm.state else {
            XCTFail("Expected error, got \(vm.state)")
            return
        }
    }

    func testShortQueryStaysOnTheClientSideFilter() {
        let vm = VaultListViewModel(api: makeAPI())
        vm.query = "c"
        XCTAssertFalse(vm.isSearching)
        vm.query = "co"
        XCTAssertTrue(vm.isSearching)
    }

    // MARK: - Drawer tabs

    func testDrawerTabsMirrorRNDrawerTabs() {
        let vm = VaultListViewModel(api: makeAPI())
        XCTAssertEqual(vm.tabs.map(\.id), ["personal", "home", "business"])
        XCTAssertEqual(vm.tabs.map(\.label), ["Me", "Home", "Business"])
        XCTAssertEqual(vm.selectedTab, "personal")
    }
}
