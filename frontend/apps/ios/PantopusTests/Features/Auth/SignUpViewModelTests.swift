//
//  SignUpViewModelTests.swift
//  PantopusTests
//
//  Covers each validation rule, submit-success, submit-failure rollback,
//  and that the right backend payload reaches AuthManager.signUp.
//

import XCTest
@testable import Pantopus

@MainActor
final class SignUpViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    // MARK: - Validation rules (one test per rule)

    func test_email_required_and_format() {
        let vm = SignUpViewModel()
        XCTAssertEqual(vm.validate(.email), "Email is required.")
        vm.email = "not-an-email"
        XCTAssertEqual(vm.validate(.email), "Enter a valid email address.")
        vm.email = "alice@example.com"
        XCTAssertNil(vm.validate(.email))
    }

    func test_password_required_min_length_letter_digit() {
        let vm = SignUpViewModel()
        XCTAssertEqual(vm.validate(.password), "Password is required.")
        vm.password = "short1"
        XCTAssertEqual(vm.validate(.password), "Password must be at least 8 characters.")
        vm.password = "12345678"
        XCTAssertEqual(vm.validate(.password), "Password must include at least one letter.")
        vm.password = "abcdefgh"
        XCTAssertEqual(vm.validate(.password), "Password must include at least one number.")
        vm.password = "strongpass1"
        XCTAssertNil(vm.validate(.password))
    }

    func test_confirmPassword_must_match() {
        let vm = SignUpViewModel()
        vm.password = "strongpass1"
        vm.confirmPassword = ""
        XCTAssertEqual(vm.validate(.confirmPassword), "Confirm your password.")
        vm.confirmPassword = "different1"
        XCTAssertEqual(vm.validate(.confirmPassword), "Passwords don't match.")
        vm.confirmPassword = "strongpass1"
        XCTAssertNil(vm.validate(.confirmPassword))
    }

    func test_username_lowercase_3_to_20() {
        let vm = SignUpViewModel()
        XCTAssertEqual(vm.validate(.username), "Username is required.")
        vm.username = "ab"
        XCTAssertEqual(vm.validate(.username), "Username must be at least 3 characters.")
        vm.username = "Alice"
        XCTAssertEqual(
            vm.validate(.username),
            "Use lowercase letters, numbers, or underscores only."
        )
        vm.username = "alice_kowalski-21"
        XCTAssertEqual(
            vm.validate(.username),
            "Use lowercase letters, numbers, or underscores only."
        )
        vm.username = "alice_21"
        XCTAssertNil(vm.validate(.username))
    }

    func test_firstName_required() {
        let vm = SignUpViewModel()
        XCTAssertEqual(vm.validate(.firstName), "First name is required.")
        vm.firstName = "Maria"
        XCTAssertNil(vm.validate(.firstName))
    }

    func test_lastName_required() {
        let vm = SignUpViewModel()
        XCTAssertEqual(vm.validate(.lastName), "Last name is required.")
        vm.lastName = "Kowalski"
        XCTAssertNil(vm.validate(.lastName))
    }

    func test_middleName_optional() {
        let vm = SignUpViewModel()
        XCTAssertNil(vm.validate(.middleName))
        vm.middleName = "M."
        XCTAssertNil(vm.validate(.middleName))
    }

    func test_dateOfBirth_required_and_18_plus() {
        let vm = SignUpViewModel()
        XCTAssertEqual(vm.validate(.dateOfBirth), "Date of birth is required.")
        // 10 years ago — fails 18+.
        vm.dateOfBirth = Calendar.current.date(byAdding: .year, value: -10, to: Date())
        XCTAssertEqual(vm.validate(.dateOfBirth), "You must be at least 18 years old.")
        // 25 years ago — passes.
        vm.dateOfBirth = Calendar.current.date(byAdding: .year, value: -25, to: Date())
        XCTAssertNil(vm.validate(.dateOfBirth))
    }

    func test_phone_optional_but_must_be_e164_when_present() {
        let vm = SignUpViewModel()
        XCTAssertNil(vm.validate(.phoneNumber)) // optional
        vm.phoneNumber = "555-1234"
        XCTAssertEqual(
            vm.validate(.phoneNumber),
            "Phone must be in E.164 format, e.g. +15555550123."
        )
        vm.phoneNumber = "+15555550123"
        XCTAssertNil(vm.validate(.phoneNumber))
    }

    func test_address_city_state_zip_required_and_min_length() {
        let vm = SignUpViewModel()
        XCTAssertEqual(vm.validate(.address), "Address is required.")
        vm.address = "12"
        XCTAssertEqual(vm.validate(.address), "Address must be at least 5 characters.")
        vm.address = "123 Main"
        XCTAssertNil(vm.validate(.address))

        XCTAssertEqual(vm.validate(.city), "City is required.")
        vm.city = "C"
        XCTAssertEqual(vm.validate(.city), "City must be at least 2 characters.")
        vm.city = "Cambridge"
        XCTAssertNil(vm.validate(.city))

        XCTAssertEqual(vm.validate(.state), "State is required.")
        vm.state = "M"
        XCTAssertEqual(vm.validate(.state), "State must be at least 2 characters.")
        vm.state = "MA"
        XCTAssertNil(vm.validate(.state))

        XCTAssertEqual(vm.validate(.zipcode), "ZIP is required.")
        vm.zipcode = "02"
        XCTAssertEqual(vm.validate(.zipcode), "ZIP must be at least 3 characters.")
        vm.zipcode = "02139"
        XCTAssertNil(vm.validate(.zipcode))
    }

    func test_inviteCode_optional() {
        let vm = SignUpViewModel()
        XCTAssertNil(vm.validate(.inviteCode))
    }

    // MARK: - Aggregate validity

    func test_isValid_requires_terms_and_all_fields() {
        let vm = SignUpViewModel()
        XCTAssertFalse(vm.isValid)
        fillValid(vm)
        XCTAssertTrue(vm.isValid)
        vm.agreedToTerms = false
        XCTAssertFalse(vm.isValid, "Terms must be accepted")
    }

    // MARK: - Password strength meter

    func test_passwordStrength_buckets() {
        let vm = SignUpViewModel()
        XCTAssertEqual(vm.passwordStrength, 0)
        vm.password = "short"
        XCTAssertEqual(vm.passwordStrength, 1)
        vm.password = "passw0rd"
        XCTAssertEqual(vm.passwordStrength, 2)
        vm.password = "strongerpass1!"
        XCTAssertEqual(vm.passwordStrength, 3)
    }

    // MARK: - Submit: success path

    func test_submit_calls_AuthManager_signUp_with_right_payload() async {
        let payload = """
        {
          "message": "Registration successful.",
          "requiresEmailVerification": true,
          "user": {
            "id": "u_new",
            "email": "new@example.com",
            "username": "alice_21",
            "name": "Maria Kowalski",
            "firstName": "Maria",
            "middleName": null,
            "lastName": "Kowalski",
            "phoneNumber": null,
            "address": "123 Main St",
            "city": "Cambridge",
            "state": "MA",
            "zipcode": "02139",
            "accountType": "individual",
            "role": "user",
            "verified": false,
            "createdAt": "2026-05-16T00:00:00Z"
          }
        }
        """
        SequencedURLProtocol.routeResponses["/api/users/register"] = [
            .status(201, body: payload)
        ]

        let client = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        let auth = AuthManager(store: InMemorySecureStore(), apiClient: client)
        let vm = SignUpViewModel()
        fillValid(vm)

        await vm.submit(using: auth)

        XCTAssertTrue(vm.didSucceed)
        XCTAssertNil(vm.topLevelError)
        XCTAssertFalse(vm.isSubmitting)

        // Verify outgoing payload reached the network with the right fields.
        let captured = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(captured?.url?.path, "/api/users/register")
        let body = captured?.httpBodyData().flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        XCTAssertEqual(body?["email"] as? String, "alice@example.com")
        XCTAssertEqual(body?["username"] as? String, "alice_21")
        XCTAssertEqual(body?["firstName"] as? String, "Maria")
        XCTAssertEqual(body?["lastName"] as? String, "Kowalski")
        XCTAssertEqual(body?["accountType"] as? String, "individual")
        XCTAssertEqual(body?["address"] as? String, "123 Main St")
    }

    func test_submit_rolls_back_loading_state_on_error() async {
        SequencedURLProtocol.routeResponses["/api/users/register"] = [
            .status(400, body: "{\"error\":\"Email already registered\"}")
        ]
        let client = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        let auth = AuthManager(store: InMemorySecureStore(), apiClient: client)
        let vm = SignUpViewModel()
        fillValid(vm)

        await vm.submit(using: auth)

        XCTAssertFalse(vm.didSucceed)
        XCTAssertEqual(vm.topLevelError, .emailAlreadyExists)
        XCTAssertFalse(vm.isSubmitting, "isSubmitting must reset after failure")
    }

    func test_submit_blocked_when_invalid_does_not_hit_network() async {
        let client = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        let auth = AuthManager(store: InMemorySecureStore(), apiClient: client)
        let vm = SignUpViewModel() // all fields blank

        await vm.submit(using: auth)

        XCTAssertFalse(vm.didSucceed)
        XCTAssertTrue(vm.hasAttemptedSubmit)
        XCTAssertFalse(vm.fieldErrors.isEmpty, "Expected per-field errors after blank submit")
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 0, "Form must not hit the network when invalid")
    }

    // MARK: - Helpers

    /// Fills every required field with valid data so `isValid` returns true.
    private func fillValid(_ vm: SignUpViewModel) {
        vm.email = "alice@example.com"
        vm.password = "strongpass1"
        vm.confirmPassword = "strongpass1"
        vm.username = "alice_21"
        vm.firstName = "Maria"
        vm.lastName = "Kowalski"
        vm.dateOfBirth = Calendar.current.date(byAdding: .year, value: -25, to: Date())
        vm.address = "123 Main St"
        vm.city = "Cambridge"
        vm.state = "MA"
        vm.zipcode = "02139"
        vm.accountType = .personal
        vm.agreedToTerms = true
    }
}

private extension URLRequest {
    /// Pull the body bytes regardless of whether URLSession exposes them on
    /// `httpBody` or `httpBodyStream`.
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
