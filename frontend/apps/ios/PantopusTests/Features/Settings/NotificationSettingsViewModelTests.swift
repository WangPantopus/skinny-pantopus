//
//  NotificationSettingsViewModelTests.swift
//  PantopusTests
//
//  A14.5 — notification & briefing preferences backed by
//  `GET/PUT /api/hub/preferences`. Covers the four-card projection, the
//  conditional time-chip rows, the wire names + `HH:mm` format the
//  backend's Joi schema demands, the merged debounced patch, and the
//  re-fetch rollback after a failed save. Mirrored on Android.
//

import XCTest
@testable import Pantopus

@MainActor
final class NotificationSettingsViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private typealias RowID = NotificationSettingsViewModel.RowID
    private typealias GroupID = NotificationSettingsViewModel.GroupID

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    /// A long debounce keeps the timer from firing on its own; tests
    /// drain it with `flushPendingSaveNow()` so ordering is exact.
    private func makeViewModel() -> NotificationSettingsViewModel {
        NotificationSettingsViewModel(api: makeAPI(), saveDebounce: .seconds(60))
    }

    private static func prefsJSON(
        dailyEnabled: Bool = true,
        dailyTime: String = "07:30",
        eveningEnabled: Bool = true,
        eveningTime: String = "18:00",
        weather: Bool = true,
        aqi: Bool = true,
        mail: Bool = true,
        gigs: Bool = true,
        homeReminders: Bool = true,
        quietStart: String? = nil,
        quietEnd: String? = nil,
        locationMode: String = "primary_home",
        timezone: String = "America/Los_Angeles"
    ) -> String {
        func quoted(_ value: String?) -> String {
            value.map { "\"\($0)\"" } ?? "null"
        }
        return """
        {"preferences":{
          "user_id":"u_1",
          "daily_briefing_enabled":\(dailyEnabled),
          "daily_briefing_time_local":"\(dailyTime)",
          "daily_briefing_timezone":"\(timezone)",
          "evening_briefing_enabled":\(eveningEnabled),
          "evening_briefing_time_local":"\(eveningTime)",
          "weather_alerts_enabled":\(weather),
          "aqi_alerts_enabled":\(aqi),
          "mail_summary_enabled":\(mail),
          "gig_updates_enabled":\(gigs),
          "home_reminders_enabled":\(homeReminders),
          "quiet_hours_start_local":\(quoted(quietStart)),
          "quiet_hours_end_local":\(quoted(quietEnd)),
          "location_mode":"\(locationMode)",
          "custom_latitude":null,"custom_longitude":null,"custom_label":null
        }}
        """
    }

    private func loadedGroups(_ vm: NotificationSettingsViewModel) -> [GroupedListGroup] {
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return []
        }
        return groups
    }

    private func row(_ groups: [GroupedListGroup], _ id: String) -> GroupedListRow? {
        groups.flatMap(\.rows).first { $0.id == id }
    }

    // MARK: - Loading

    func testLoadProjectsFourCardsFromServerTruth() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.prefsJSON())]
        let vm = makeViewModel()
        await vm.load()

        let groups = loadedGroups(vm)
        XCTAssertEqual(
            groups.map(\.id),
            [GroupID.briefings, GroupID.alerts, GroupID.quietHours, GroupID.briefingLocation]
        )
        XCTAssertEqual(groups.map(\.overline), ["Briefings", "Alert preferences", "Quiet hours", "Briefing location"])
        // The GET must go to the composed backend path.
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.first?.url?.path, "/api/hub/preferences")
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.first?.httpMethod, "GET")
    }

    func testAlertSwitchesMirrorServerValues() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.prefsJSON(weather: false, aqi: true, mail: false, gigs: true, homeReminders: false))
        ]
        let vm = makeViewModel()
        await vm.load()
        let groups = loadedGroups(vm)
        XCTAssertEqual(row(groups, RowID.weatherAlerts)?.control, .toggle(isOn: false))
        XCTAssertEqual(row(groups, RowID.aqiAlerts)?.control, .toggle(isOn: true))
        XCTAssertEqual(row(groups, RowID.mailSummary)?.control, .toggle(isOn: false))
        XCTAssertEqual(row(groups, RowID.gigUpdates)?.control, .toggle(isOn: true))
        XCTAssertEqual(row(groups, RowID.homeReminders)?.control, .toggle(isOn: false))
    }

    func testTimeChipsOnlyRenderWhenTheBriefingIsOn() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.prefsJSON(dailyEnabled: true, dailyTime: "08:30", eveningEnabled: false))
        ]
        let vm = makeViewModel()
        await vm.load()
        let groups = loadedGroups(vm)
        XCTAssertEqual(
            row(groups, RowID.morningTime)?.control,
            .chips(options: NotificationSettingsViewModel.morningTimeOptions, selected: "08:30")
        )
        XCTAssertNil(row(groups, RowID.eveningTime), "Evening chips hide while the evening briefing is off")
    }

    func testQuietHoursBoundsOnlyRenderWhenStartIsSet() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.prefsJSON(quietStart: nil, quietEnd: nil))]
        let vm = makeViewModel()
        await vm.load()
        var groups = loadedGroups(vm)
        XCTAssertEqual(row(groups, RowID.quietHours)?.control, .toggle(isOn: false))
        XCTAssertNil(row(groups, RowID.quietHoursStart))

        SequencedURLProtocol.sequence = [.status(200, body: Self.prefsJSON(quietStart: "23:00", quietEnd: "06:00"))]
        await vm.refresh()
        groups = loadedGroups(vm)
        XCTAssertEqual(row(groups, RowID.quietHours)?.control, .toggle(isOn: true))
        XCTAssertEqual(
            row(groups, RowID.quietHoursStart)?.control,
            .chips(options: NotificationSettingsViewModel.quietStartOptions, selected: "23:00")
        )
        XCTAssertEqual(
            row(groups, RowID.quietHoursEnd)?.control,
            .chips(options: NotificationSettingsViewModel.quietEndOptions, selected: "06:00")
        )
    }

    func testLocationRadiosReflectStoredMode() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.prefsJSON(locationMode: "device_location"))]
        let vm = makeViewModel()
        await vm.load()
        let groups = loadedGroups(vm)
        XCTAssertEqual(row(groups, RowID.locationPrimaryHome)?.control, .radio(isSelected: false))
        XCTAssertEqual(row(groups, RowID.locationViewing)?.control, .radio(isSelected: false))
        XCTAssertEqual(row(groups, RowID.locationDevice)?.control, .radio(isSelected: true))
    }

    func testFooterCaptionNamesTheBriefingTimezone() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.prefsJSON(timezone: "America/New_York"))]
        let vm = makeViewModel()
        await vm.load()
        XCTAssertEqual(vm.footerCaption, "Briefing times use America/New_York")
    }

    func testLoadFailureProducesErrorState() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeViewModel()
        await vm.load()
        guard case let .error(message) = vm.state else {
            return XCTFail("Expected .error, got \(vm.state)")
        }
        XCTAssertFalse(message.isEmpty)
    }

    // MARK: - Saving

    func testToggleSendsTheBackendWireNameOnAPut() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.prefsJSON(weather: true)),
            .status(200, body: Self.prefsJSON(weather: false))
        ]
        let vm = makeViewModel()
        await vm.load()
        await vm.toggleRow(RowID.weatherAlerts, isOn: false)
        // Optimistic before the flush.
        XCTAssertEqual(row(loadedGroups(vm), RowID.weatherAlerts)?.control, .toggle(isOn: false))
        await vm.flushPendingSaveNow()

        let put = try XCTUnwrap(SequencedURLProtocol.capturedRequests.last)
        XCTAssertEqual(put.httpMethod, "PUT")
        XCTAssertEqual(put.url?.path, "/api/hub/preferences")
        let body = try XCTUnwrap(
            JSONSerialization.jsonObject(with: XCTUnwrap(put.httpBodyData())) as? [String: Any]
        )
        XCTAssertEqual(body.count, 1)
        XCTAssertEqual(body["weather_alerts_enabled"] as? Bool, false)
        XCTAssertEqual(vm.toast?.text, "Saved")
    }

    func testTimeChipSendsRawHHMMNotALocaleString() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.prefsJSON(dailyTime: "07:30")),
            .status(200, body: Self.prefsJSON(dailyTime: "09:30"))
        ]
        let vm = makeViewModel()
        await vm.load()
        await vm.selectChip(RowID.morningTime, value: "09:30")
        await vm.flushPendingSaveNow()

        let body = try XCTUnwrap(
            JSONSerialization.jsonObject(
                with: XCTUnwrap(XCTUnwrap(SequencedURLProtocol.capturedRequests.last).httpBodyData())
            ) as? [String: Any]
        )
        XCTAssertEqual(body["daily_briefing_time_local"] as? String, "09:30")
    }

    func testQuietHoursToggleSeedsThenNullsBothBounds() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.prefsJSON(quietStart: nil, quietEnd: nil)),
            .status(200, body: Self.prefsJSON(quietStart: "22:00", quietEnd: "07:00")),
            .status(200, body: Self.prefsJSON(quietStart: nil, quietEnd: nil))
        ]
        let vm = makeViewModel()
        await vm.load()

        await vm.toggleRow(RowID.quietHours, isOn: true)
        await vm.flushPendingSaveNow()
        var body = try XCTUnwrap(
            JSONSerialization.jsonObject(
                with: XCTUnwrap(XCTUnwrap(SequencedURLProtocol.capturedRequests.last).httpBodyData())
            ) as? [String: Any]
        )
        XCTAssertEqual(body["quiet_hours_start_local"] as? String, "22:00")
        XCTAssertEqual(body["quiet_hours_end_local"] as? String, "07:00")

        await vm.toggleRow(RowID.quietHours, isOn: false)
        await vm.flushPendingSaveNow()
        body = try XCTUnwrap(
            JSONSerialization.jsonObject(
                with: XCTUnwrap(XCTUnwrap(SequencedURLProtocol.capturedRequests.last).httpBodyData())
            ) as? [String: Any]
        )
        // Explicit JSON null — the column is nullable and Joi allows it.
        XCTAssertTrue(body["quiet_hours_start_local"] is NSNull)
        XCTAssertTrue(body["quiet_hours_end_local"] is NSNull)
    }

    func testLocationRadioSendsTheModeEnum() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.prefsJSON()),
            .status(200, body: Self.prefsJSON(locationMode: "viewing_location"))
        ]
        let vm = makeViewModel()
        await vm.load()
        await vm.selectRadio(RowID.locationViewing)
        await vm.flushPendingSaveNow()

        let body = try XCTUnwrap(
            JSONSerialization.jsonObject(
                with: XCTUnwrap(XCTUnwrap(SequencedURLProtocol.capturedRequests.last).httpBodyData())
            ) as? [String: Any]
        )
        XCTAssertEqual(body["location_mode"] as? String, "viewing_location")
    }

    func testDebounceMergesEveryPendingKeyIntoOnePut() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.prefsJSON()),
            .status(200, body: Self.prefsJSON(aqi: false, gigs: false))
        ]
        let vm = makeViewModel()
        await vm.load()
        await vm.toggleRow(RowID.aqiAlerts, isOn: false)
        await vm.toggleRow(RowID.gigUpdates, isOn: false)
        await vm.flushPendingSaveNow()

        let writes = SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "PUT" }
        XCTAssertEqual(writes.count, 1, "The debounce collapses the burst into one write")
        let body = try XCTUnwrap(
            JSONSerialization.jsonObject(with: XCTUnwrap(writes[0].httpBodyData())) as? [String: Any]
        )
        XCTAssertEqual(body["aqi_alerts_enabled"] as? Bool, false)
        XCTAssertEqual(body["gig_updates_enabled"] as? Bool, false)
    }

    func testFailedSaveToastsAndRollsBackToServerTruth() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.prefsJSON(mail: true)),
            .status(500, body: "{\"error\":\"nope\"}"),
            .status(200, body: Self.prefsJSON(mail: true))
        ]
        let vm = makeViewModel()
        await vm.load()
        await vm.toggleRow(RowID.mailSummary, isOn: false)
        XCTAssertEqual(row(loadedGroups(vm), RowID.mailSummary)?.control, .toggle(isOn: false))

        await vm.flushPendingSaveNow()
        XCTAssertEqual(vm.toast?.text, "Failed to save")
        XCTAssertEqual(
            row(loadedGroups(vm), RowID.mailSummary)?.control,
            .toggle(isOn: true),
            "The re-fetch restores the server value"
        )
    }

    func testRefreshFailureKeepsContentAndToasts() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.prefsJSON()),
            .status(500, body: "{}")
        ]
        let vm = makeViewModel()
        await vm.load()
        await vm.refresh()
        XCTAssertEqual(vm.toast?.text, "Failed to load preferences")
        XCTAssertFalse(loadedGroups(vm).isEmpty)
    }
}

private extension URLRequest {
    /// `URLProtocol`-stubbed sessions move the body onto
    /// `httpBodyStream`; drain it so assertions don't flake.
    func httpBodyData() -> Data? {
        if let direct = httpBody { return direct }
        guard let stream = httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }

        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }

        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}
