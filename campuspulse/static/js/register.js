/**
 * CampusPulse — account registration
 * Keeps the password confirmation check native to the browser so the
 * existing Flask form submission and validation flow remain unchanged.
 */
"use strict";

(() => {
  const form = document.getElementById("registerForm");
  const password = document.getElementById("password");
  const confirmation = document.getElementById("confirm_password");

  // The script may be included on pages that do not contain the form.
  if (!form || !password || !confirmation) return;

  function validatePasswordMatch() {
    const matches = password.value === confirmation.value;
    confirmation.setCustomValidity(
      matches ? "" : "Passwords do not match."
    );
    return matches;
  }

  password.addEventListener("input", validatePasswordMatch);
  confirmation.addEventListener("input", validatePasswordMatch);

  form.addEventListener("submit", (event) => {
    validatePasswordMatch();

    if (!form.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
    }
  });
})();
