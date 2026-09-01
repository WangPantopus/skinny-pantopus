//
//  ViewAsViewModelTests.swift
//  PantopusTests
//
//  B5.2 (A18.5) — projection tests for the "View as" preview. Locks the
//  privacy matrix's two design endpoints (Public redacts the most,
//  Connection the least) and the instant re-resolve when the picker
//  changes.
//

import XCTest
@testable import Pantopus

@MainActor
final class ViewAsViewModelTests: XCTestCase {
    private func loadedRender(
        _ vm: ViewAsViewModel,
        file: StaticString = #filePath,
        line: UInt = #line
    ) -> ViewAsRender? {
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded state", file: file, line: line)
            return nil
        }
        return loaded.render
    }

    private func disclosure(_ render: ViewAsRender, _ fieldId: String) -> ViewAsFieldDisclosure? {
        render.fields.first { $0.id == fieldId }?.disclosure
    }

    func test_startsLoading_thenLoadResolvesSelectedRender() async {
        let vm = ViewAsViewModel(selected: .connection)
        guard case .loading = vm.state else {
            return XCTFail("Expected initial .loading state")
        }
        await vm.load()
        XCTAssertEqual(loadedRender(vm)?.viewer, .connection)
    }

    func test_startLoaded_seedsResolvedRender() {
        let vm = ViewAsViewModel(selected: .public, startLoaded: true)
        XCTAssertEqual(loadedRender(vm)?.viewer, .public)
        XCTAssertEqual(vm.selected, .public)
    }

    func test_publicRedactsMutualsAndContact() {
        let vm = ViewAsViewModel(selected: .public, startLoaded: true)
        guard let render = loadedRender(vm) else { return }
        XCTAssertEqual(disclosure(render, "mutuals")?.isHidden, true)
        XCTAssertEqual(disclosure(render, "contact")?.isHidden, true)
        // Location is coarsened, not withheld — the value still reads.
        XCTAssertEqual(disclosure(render, "location")?.shownValue, "Maple Heights district")
        // Two locked verification chips for the public.
        XCTAssertEqual(render.badges.filter { !$0.isOn }.count, 2)
        XCTAssertEqual(render.banner.tone, .restricted)
    }

    func test_connectionRedactsNothing() {
        let vm = ViewAsViewModel(selected: .connection, startLoaded: true)
        guard let render = loadedRender(vm) else { return }
        XCTAssertFalse(render.fields.contains { $0.disclosure.isHidden })
        XCTAssertTrue(render.badges.allSatisfy(\.isOn))
        XCTAssertEqual(disclosure(render, "contact")?.shownValue, "Available on request")
        XCTAssertEqual(render.banner.tone, .info)
    }

    func test_selectReResolvesRenderInPlace() {
        let vm = ViewAsViewModel(selected: .connection, startLoaded: true)
        XCTAssertEqual(loadedRender(vm).flatMap { disclosure($0, "contact")?.isHidden }, false)

        vm.select(.public)

        XCTAssertEqual(vm.selected, .public)
        guard let render = loadedRender(vm) else { return }
        XCTAssertEqual(render.viewer, .public)
        XCTAssertEqual(disclosure(render, "contact")?.isHidden, true)
    }

    func test_selectWhileLoadingUpdatesSelectionButStaysLoading() {
        let vm = ViewAsViewModel(selected: .connection)
        vm.select(.public)
        XCTAssertEqual(vm.selected, .public)
        guard case .loading = vm.state else {
            return XCTFail("Expected to remain in .loading until load() runs")
        }
    }

    func test_everyAudienceResolves() {
        for audience in ViewerAudience.allCases {
            let vm = ViewAsViewModel(selected: audience, startLoaded: true)
            XCTAssertEqual(loadedRender(vm)?.viewer, audience)
            XCTAssertEqual(loadedRender(vm)?.fields.count, 5)
        }
    }
}
