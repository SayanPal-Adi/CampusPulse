
// =================================
// CampusPulse - Registration Logic
// =================================

const registerForm = document.getElementById("registerForm");

const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirm_password");

// Check whether both passwords match
function validatePasswords() {

    if (passwordInput.value !== confirmPasswordInput.value) {

        confirmPasswordInput.setCustomValidity(
            "Passwords do not match."
        );

    } else {

        confirmPasswordInput.setCustomValidity("");

    }
}

// Validate when the user types
passwordInput.addEventListener("input", validatePasswords);

confirmPasswordInput.addEventListener("input", validatePasswords);

// Validate before submitting the form
registerForm.addEventListener("submit", function (event) {

    validatePasswords();

    if (!registerForm.checkValidity()) {

        event.preventDefault();
        registerForm.reportValidity();

    }

});
