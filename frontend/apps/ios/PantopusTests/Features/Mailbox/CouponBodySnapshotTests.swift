//
//  CouponBodySnapshotTests.swift
//  PantopusTests
//
//  A17.5 — structural render snapshots for Coupon mail across unused,
//  redeemed, and expired states.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class CouponBodySnapshotTests: XCTestCase {
    func test_coupon_unused_renders() {
        assertRenders(
            CouponBody(
                coupon: MailItemSampleData.couponUnused,
                state: .unused,
                similarOffers: MailItemSampleData.couponSimilarOffers
            )
        )
    }

    func test_coupon_redeemed_renders() {
        assertRenders(
            CouponBody(
                coupon: MailItemSampleData.couponRedeemed,
                state: .redeemed,
                similarOffers: MailItemSampleData.couponSimilarOffers,
                walletReminderDetail: MailItemSampleData.couponWalletReminderDetail,
                walletArrivalDetail: MailItemSampleData.couponWalletArrivalDetail
            )
        )
    }

    func test_coupon_expired_renders() {
        assertRenders(
            CouponBody(
                coupon: MailItemSampleData.couponExpired,
                state: .expired,
                similarOffers: MailItemSampleData.couponSimilarOffers
            )
        )
    }

    func test_coupon_expanded_barcode_renders() {
        assertRenders(
            CouponBody(
                coupon: MailItemSampleData.couponUnused,
                state: .unused,
                barcodeInitiallyExpanded: true,
                similarOffers: MailItemSampleData.couponSimilarOffers
            )
        )
    }

    /// The live body ships no fixtures — the invented "similar offers" rail
    /// and the fake wallet reminder / geofence chips must stay hidden.
    func test_coupon_liveBody_hidesFixtureDrivenRail() {
        assertRenders(CouponBody(coupon: MailItemSampleData.couponRedeemed, state: .redeemed))
    }

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: ScrollView { view }
                .frame(width: 390, height: 1300)
                .background(Theme.Color.appBg)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 1300)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
