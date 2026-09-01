//
//  TodayDetailMappingTests.swift
//  PantopusTests
//
//  P1-F — covers the live wiring of the Hub Today briefing:
//    - pure HubTodayPayload → TodayDetailContent projection,
//    - weather / AQI / signal / glyph field mapping,
//    - populated vs. alert state selection,
//    - the live load() path (incl. CONTEXT_UNAVAILABLE → error).
//

import XCTest
@testable import Pantopus

@MainActor
final class TodayDetailMappingTests: XCTestCase {
    private func weather(
        temp: Double? = 67,
        code: String? = "clear",
        label: String? = "Mostly sunny",
        high: Double? = 74,
        low: Double? = 58,
        precip: Bool? = false
    ) -> HubTodayPayload.TodayWeather {
        .init(
            currentTempF: temp,
            conditionCode: code,
            conditionLabel: label,
            highF: high,
            lowF: low,
            precipitationNext6h: precip
        )
    }

    private func payload(
        label: String? = "Elm Park",
        weather: HubTodayPayload.TodayWeather? = nil,
        aqi: HubTodayPayload.TodayAQI? = nil,
        alerts: [HubTodayPayload.TodayAlert]? = [],
        signals: [HubTodayPayload.TodaySignalDTO]? = []
    ) -> HubTodayPayload {
        .init(
            location: .init(label: label, timezone: "America/New_York", latitude: nil, longitude: nil),
            summary: "Mild and mostly sunny.",
            displayMode: "standard",
            weather: weather,
            aqi: aqi,
            alerts: alerts,
            signals: signals,
            seasonal: nil,
            error: nil
        )
    }

    // MARK: - Whole-content projection

    func testMakeContentMapsWeatherAndAqi() {
        let content = TodayDetailViewModel.makeContent(
            from: payload(
                weather: weather(),
                aqi: .init(index: 42, category: "Good", isNoteworthy: false)
            )
        )
        XCTAssertEqual(content.kicker, "Elm Park")
        XCTAssertEqual(content.temperature, "67°")
        XCTAssertEqual(content.condition, "Mostly sunny")
        XCTAssertEqual(content.highLowFeels, "High 74° · Low 58°")
        XCTAssertEqual(content.chips.count, 1)
        XCTAssertEqual(content.chips.first?.label, "AQI")
        XCTAssertEqual(content.chips.first?.value, "42")
        XCTAssertEqual(content.chips.first?.dotTone, .success)
        XCTAssertFalse(content.isAlert)
    }

    func testTemperatureFallsBackWhenMissing() {
        let content = TodayDetailViewModel.makeContent(from: payload(weather: nil))
        XCTAssertEqual(content.temperature, "—°")
        XCTAssertTrue(content.chips.isEmpty, "No AQI block → no chip")
    }

    func testAlertSelectsAlertStateAndErrorAccent() {
        let content = TodayDetailViewModel.makeContent(
            from: payload(
                weather: weather(code: "freezing", label: "Hard freeze"),
                alerts: [
                    .init(
                        id: "a1",
                        severity: "severe",
                        title: "Hard-freeze warning",
                        startsAt: nil,
                        endsAt: nil
                    )
                ]
            )
        )
        XCTAssertTrue(content.isAlert)
        XCTAssertEqual(content.kicker, "Elm Park · Advisory")
        XCTAssertEqual(content.signalsAccent, .error)
        XCTAssertEqual(content.ribbon?.title, "Hard-freeze warning")
        XCTAssertEqual(content.glyph, .snowflake)
    }

    func testSignalsMapWithIconAndSeverity() {
        let content = TodayDetailViewModel.makeContent(
            from: payload(signals: [
                .init(kind: "rain", label: "Light shower", detail: "After 4pm", urgency: "low", action: nil),
                .init(kind: "grid", label: "Grid strain", detail: "Reduce heat", urgency: "high", action: nil)
            ])
        )
        XCTAssertEqual(content.signals.count, 2)
        XCTAssertEqual(content.signalsTitle, "Signals · 2 today")
        XCTAssertEqual(content.signals[0].icon, .cloudRain)
        XCTAssertNil(content.signals[0].severity)
        XCTAssertEqual(content.signals[1].icon, .zap)
        XCTAssertEqual(content.signals[1].severity?.label, "High")
    }

    func testGlyphMapping() {
        XCTAssertEqual(TodayDetailViewModel.glyph(for: weather(code: "rain", label: "Showers"), hasAlert: false), .cloudRain)
        XCTAssertEqual(TodayDetailViewModel.glyph(for: weather(code: "clear", label: "Sunny"), hasAlert: false), .sun)
        XCTAssertEqual(TodayDetailViewModel.glyph(for: weather(code: "cloudy", label: "Overcast"), hasAlert: false), .cloudSun)
    }

    func testDateLabelHonoursTimezone() {
        // 2026-05-19T17:00:00Z is 1pm EDT (Tuesday) in New York.
        var comps = DateComponents()
        comps.year = 2026
        comps.month = 5
        comps.day = 19
        comps.hour = 17
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? cal.timeZone
        guard let instant = cal.date(from: comps) else {
            return XCTFail("Expected valid date components")
        }
        XCTAssertEqual(
            TodayDetailViewModel.dateLabel(instant, timezone: "America/New_York"),
            "Tue · May 19"
        )
    }

    // MARK: - Live load() path

    func testLiveLoadPopulates() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            // Success body is the payload at the TOP LEVEL — no `today` wrapper.
            "/api/hub/today": [
                .status(200, body: """
                {"location":{"label":"Elm Park","timezone":"America/New_York"},\
                "summary":"Mild.","display_mode":"standard",\
                "weather":{"current_temp_f":67,"condition_code":"clear",\
                "condition_label":"Mostly sunny","high_f":74,"low_f":58,"precipitation_next_6h":false},\
                "aqi":{"index":42,"category":"Good","is_noteworthy":false},"alerts":[],\
                "signals":[{"kind":"rain","label":"Light shower","detail":"After 4pm","urgency":"low"}],\
                "seasonal":null}
                """)
            ]
        ])
        let vm = TodayDetailViewModel(api: APIClient(session: session, retryPolicy: .none))
        await vm.load()
        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected populated, got \(vm.state)")
        }
        XCTAssertEqual(content.temperature, "67°")
        XCTAssertEqual(content.signals.count, 1)
    }

    func testLiveLoadContextUnavailableSurfacesError() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/hub/today": [
                .status(200, body: "{\"today\":null,\"error\":\"CONTEXT_UNAVAILABLE\"}")
            ]
        ])
        let vm = TodayDetailViewModel(api: APIClient(session: session, retryPolicy: .none))
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected error for CONTEXT_UNAVAILABLE, got \(vm.state)")
        }
    }

    func testLiveLoadHiddenDisplayModeSurfacesError() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        // No usable location → the orchestrator returns display_mode=hidden.
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/hub/today": [
                .status(200, body: """
                {"summary":"Location not available.","display_mode":"hidden","weather":null,"signals":[]}
                """)
            ]
        ])
        let vm = TodayDetailViewModel(api: APIClient(session: session, retryPolicy: .none))
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected error for display_mode=hidden, got \(vm.state)")
        }
    }
}
