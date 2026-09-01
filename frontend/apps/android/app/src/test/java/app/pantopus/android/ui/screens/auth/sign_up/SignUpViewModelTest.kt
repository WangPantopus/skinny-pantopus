@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.auth.sign_up

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.auth.AuthenticatedUser
import app.pantopus.android.data.auth.AccountType
import app.pantopus.android.data.auth.AuthError
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.SignUpResult
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDate

@OptIn(ExperimentalCoroutinesApi::class)
class SignUpViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun buildVm(
        repo: AuthRepository = mockk(relaxed = true),
        inviteCode: String? = null,
    ): SignUpViewModel =
        SignUpViewModel(
            repo,
            SavedStateHandle(
                buildMap { inviteCode?.let { put(SignUpViewModel.INVITE_CODE_KEY, it) } },
            ),
        )

    // MARK: - Invite-code deep link (`pantopus://join/:code`)

    @Test
    fun `invite code nav arg pre-fills the field`() {
        val vm = buildVm(inviteCode = "NB7Q2X")
        assertEquals("NB7Q2X", vm.uiState.value.inviteCode)
        assertTrue(vm.arrivedByInvite)
    }

    @Test
    fun `no invite code nav arg leaves the field empty`() {
        val vm = buildVm()
        assertEquals("", vm.uiState.value.inviteCode)
        assertFalse(vm.arrivedByInvite)
    }

    // MARK: - Validation rules (one test per rule)

    @Test
    fun `email required and format`() {
        val vm = buildVm()
        assertEquals("Email is required.", vm.uiState.value.validate(SignUpField.Email))
        vm.onEmailChange("not-an-email")
        assertEquals("Enter a valid email address.", vm.uiState.value.validate(SignUpField.Email))
        vm.onEmailChange("alice@example.com")
        assertNull(vm.uiState.value.validate(SignUpField.Email))
    }

    @Test
    fun `password required, 8 chars, letter, digit`() {
        val vm = buildVm()
        assertEquals("Password is required.", vm.uiState.value.validate(SignUpField.Password))
        vm.onPasswordChange("short1")
        assertEquals("Password must be at least 8 characters.", vm.uiState.value.validate(SignUpField.Password))
        vm.onPasswordChange("12345678")
        assertEquals(
            "Password must include at least one letter.",
            vm.uiState.value.validate(SignUpField.Password),
        )
        vm.onPasswordChange("abcdefgh")
        assertEquals(
            "Password must include at least one number.",
            vm.uiState.value.validate(SignUpField.Password),
        )
        vm.onPasswordChange("strongpass1")
        assertNull(vm.uiState.value.validate(SignUpField.Password))
    }

    @Test
    fun `confirmPassword must match`() {
        val vm = buildVm()
        vm.onPasswordChange("strongpass1")
        assertEquals("Confirm your password.", vm.uiState.value.validate(SignUpField.ConfirmPassword))
        vm.onConfirmPasswordChange("different1")
        assertEquals("Passwords don't match.", vm.uiState.value.validate(SignUpField.ConfirmPassword))
        vm.onConfirmPasswordChange("strongpass1")
        assertNull(vm.uiState.value.validate(SignUpField.ConfirmPassword))
    }

    @Test
    fun `username lowercase 3 to 20`() {
        val vm = buildVm()
        assertEquals("Username is required.", vm.uiState.value.validate(SignUpField.Username))
        vm.onUsernameChange("ab")
        assertEquals("Username must be at least 3 characters.", vm.uiState.value.validate(SignUpField.Username))
        vm.onUsernameChange("Alice")
        assertEquals(
            "Use lowercase letters, numbers, or underscores only.",
            vm.uiState.value.validate(SignUpField.Username),
        )
        vm.onUsernameChange("alice_21")
        assertNull(vm.uiState.value.validate(SignUpField.Username))
    }

    @Test
    fun `firstName required`() {
        val vm = buildVm()
        assertEquals("First name is required.", vm.uiState.value.validate(SignUpField.FirstName))
        vm.onFirstNameChange("Maria")
        assertNull(vm.uiState.value.validate(SignUpField.FirstName))
    }

    @Test
    fun `lastName required`() {
        val vm = buildVm()
        assertEquals("Last name is required.", vm.uiState.value.validate(SignUpField.LastName))
        vm.onLastNameChange("Kowalski")
        assertNull(vm.uiState.value.validate(SignUpField.LastName))
    }

    @Test
    fun `middleName optional`() {
        val vm = buildVm()
        assertNull(vm.uiState.value.validate(SignUpField.MiddleName))
        vm.onMiddleNameChange("M.")
        assertNull(vm.uiState.value.validate(SignUpField.MiddleName))
    }

    @Test
    fun `dateOfBirth required and 18 plus`() {
        val vm = buildVm()
        assertEquals("Date of birth is required.", vm.uiState.value.validate(SignUpField.DateOfBirth))
        vm.onDateOfBirthChange(LocalDate.now().minusYears(10))
        assertEquals("You must be at least 18 years old.", vm.uiState.value.validate(SignUpField.DateOfBirth))
        vm.onDateOfBirthChange(LocalDate.now().minusYears(25))
        assertNull(vm.uiState.value.validate(SignUpField.DateOfBirth))
    }

    @Test
    fun `phone optional but must be e164`() {
        val vm = buildVm()
        assertNull(vm.uiState.value.validate(SignUpField.PhoneNumber))
        vm.onPhoneChange("555-1234")
        assertEquals(
            "Phone must be in E.164 format, e.g. +15555550123.",
            vm.uiState.value.validate(SignUpField.PhoneNumber),
        )
        vm.onPhoneChange("+15555550123")
        assertNull(vm.uiState.value.validate(SignUpField.PhoneNumber))
    }

    @Test
    fun `address required and min length`() {
        val vm = buildVm()
        assertEquals("Address is required.", vm.uiState.value.validate(SignUpField.Address))
        vm.onAddressChange("12")
        assertEquals("Address must be at least 5 characters.", vm.uiState.value.validate(SignUpField.Address))
        vm.onAddressChange("123 Main")
        assertNull(vm.uiState.value.validate(SignUpField.Address))
    }

    @Test
    fun `isValid requires terms and all fields`() {
        val vm = buildVm()
        assertFalse(vm.uiState.value.isValid)
        fillValid(vm)
        assertTrue(vm.uiState.value.isValid)
        vm.onTermsToggle()
        assertFalse(vm.uiState.value.isValid)
    }

    @Test
    fun `passwordStrength buckets`() {
        val vm = buildVm()
        assertEquals(0, vm.uiState.value.passwordStrength)
        vm.onPasswordChange("short")
        assertEquals(1, vm.uiState.value.passwordStrength)
        vm.onPasswordChange("passw0rd")
        assertEquals(2, vm.uiState.value.passwordStrength)
        vm.onPasswordChange("strongerpass1!")
        assertEquals(3, vm.uiState.value.passwordStrength)
    }

    // MARK: - Submit lifecycle

    @Test
    fun `submit calls AuthRepository_signUp with right payload`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            val emailSlot = slot<String>()
            val usernameSlot = slot<String>()
            val firstNameSlot = slot<String>()
            val lastNameSlot = slot<String>()
            val accountTypeSlot = slot<AccountType>()
            val expectedDateOfBirth = LocalDate.of(1999, 1, 15)
            coEvery {
                repo.signUp(
                    email = capture(emailSlot),
                    password = any(),
                    phoneNumber = any(),
                    username = capture(usernameSlot),
                    firstName = capture(firstNameSlot),
                    middleName = any(),
                    lastName = capture(lastNameSlot),
                    dateOfBirth = expectedDateOfBirth.toString(),
                    address = any(),
                    city = any(),
                    state = any(),
                    zipcode = any(),
                    accountType = capture(accountTypeSlot),
                    inviteCode = any(),
                )
            } returns SignUpResult(user = sampleAuthUser(), requiresEmailVerification = true)

            val vm = buildVm(repo)
            fillValid(vm)
            vm.onDateOfBirthChange(expectedDateOfBirth)
            vm.submit()
            advanceUntilIdle()

            val state = vm.uiState.value
            assertTrue(state.didSucceed)
            assertNull(state.topLevelError)
            assertFalse(state.isSubmitting)
            assertEquals("alice@example.com", emailSlot.captured)
            assertEquals("alice_21", usernameSlot.captured)
            assertEquals("Maria", firstNameSlot.captured)
            assertEquals("Kowalski", lastNameSlot.captured)
            assertEquals(AccountType.Personal, accountTypeSlot.captured)
            coVerify(exactly = 1) {
                repo.signUp(
                    email = any(),
                    password = any(),
                    phoneNumber = any(),
                    username = any(),
                    firstName = any(),
                    middleName = any(),
                    lastName = any(),
                    dateOfBirth = expectedDateOfBirth.toString(),
                    address = any(),
                    city = any(),
                    state = any(),
                    zipcode = any(),
                    accountType = any(),
                    inviteCode = any(),
                )
            }
        }

    @Test
    fun `submit rolls back loading state on error`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            coEvery {
                repo.signUp(
                    email = any(),
                    password = any(),
                    phoneNumber = any(),
                    username = any(),
                    firstName = any(),
                    middleName = any(),
                    lastName = any(),
                    dateOfBirth = any(),
                    address = any(),
                    city = any(),
                    state = any(),
                    zipcode = any(),
                    accountType = any(),
                    inviteCode = any(),
                )
            } throws AuthError.EmailAlreadyExists

            val vm = buildVm(repo)
            fillValid(vm)
            vm.submit()
            advanceUntilIdle()

            val state = vm.uiState.value
            assertFalse(state.didSucceed)
            assertEquals(AuthError.EmailAlreadyExists, state.topLevelError)
            assertFalse(state.isSubmitting)
        }

    @Test
    fun `submit blocked when invalid does not hit network`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            val vm = buildVm(repo) // empty form

            vm.submit()
            advanceUntilIdle()

            assertFalse(vm.uiState.value.didSucceed)
            assertTrue(vm.uiState.value.hasAttemptedSubmit)
            assertFalse(vm.uiState.value.fieldErrors.isEmpty())
            coVerify(exactly = 0) {
                repo.signUp(
                    email = any(),
                    password = any(),
                    phoneNumber = any(),
                    username = any(),
                    firstName = any(),
                    middleName = any(),
                    lastName = any(),
                    dateOfBirth = any(),
                    address = any(),
                    city = any(),
                    state = any(),
                    zipcode = any(),
                    accountType = any(),
                    inviteCode = any(),
                )
            }
        }

    private fun fillValid(vm: SignUpViewModel) {
        vm.onEmailChange("alice@example.com")
        vm.onPasswordChange("strongpass1")
        vm.onConfirmPasswordChange("strongpass1")
        vm.onUsernameChange("alice_21")
        vm.onFirstNameChange("Maria")
        vm.onLastNameChange("Kowalski")
        vm.onDateOfBirthChange(LocalDate.now().minusYears(25))
        vm.onAddressChange("123 Main St")
        vm.onCityChange("Cambridge")
        vm.onStateChange("MA")
        vm.onZipcodeChange("02139")
        if (!vm.uiState.value.agreedToTerms) vm.onTermsToggle()
    }

    private fun sampleAuthUser(): AuthenticatedUser =
        AuthenticatedUser(
            id = "u_new",
            email = "alice@example.com",
            username = "alice_21",
            name = "Maria Kowalski",
            firstName = "Maria",
            middleName = null,
            lastName = "Kowalski",
            phoneNumber = null,
            address = "123 Main St",
            city = "Cambridge",
            state = "MA",
            zipcode = "02139",
            accountType = "individual",
            role = "user",
            verified = false,
            createdAt = "2026-05-16T00:00:00Z",
        )
}
