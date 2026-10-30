
"use strict";

// =====================================
// CampusPulse - Admin Dashboard
// =====================================


// =====================================
// DOM Elements
// =====================================

const adminSidebar = document.getElementById("adminSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

const menuToggle = document.getElementById("menuToggle");
const sidebarClose = document.getElementById("sidebarClose");

const topbarTitle = document.getElementById("topbarTitle");

const adminNotification = document.getElementById("adminNotification");
const adminLogoutButton = document.getElementById("adminLogoutButton");

const navigationButtons = document.querySelectorAll("[data-section]");
const sectionButtons = document.querySelectorAll("[data-go-section]");
const adminSections = document.querySelectorAll(".admin-section");


// =====================================
// Section Navigation
// =====================================

const sectionTitles = {
    overview: "Overview",
    users: "User Management",
    events: "Event Management",
    registrations: "Registrations",
    reports: "Reports"
};


function showSection(sectionName) {

    const selectedSection = document.getElementById(
        `${sectionName}Section`
    );

    if (!selectedSection) {
        return;
    }

    // Hide all sections.
    adminSections.forEach(section => {
        section.classList.remove("active");
    });

    // Show selected section.
    selectedSection.classList.add("active");

    // Update sidebar navigation.
    navigationButtons.forEach(button => {

        const isActive = button.dataset.section === sectionName;

        button.classList.toggle("active", isActive);

        if (isActive) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }

    });

    // Update page heading.
    topbarTitle.textContent =
        sectionTitles[sectionName] || "Admin Dashboard";

    // Close mobile sidebar after navigation.
    closeSidebar();

    // Return to the top of the page.
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// Sidebar navigation listeners.
navigationButtons.forEach(button => {

    button.addEventListener("click", function () {

        const sectionName = button.dataset.section;

        showSection(sectionName);

    });

});


// Quick management buttons.
sectionButtons.forEach(button => {

    button.addEventListener("click", function () {

        const sectionName = button.dataset.goSection;

        showSection(sectionName);

    });

});


// =====================================
// Mobile Sidebar
// =====================================

function openSidebar() {

    adminSidebar.classList.add("open");
    sidebarOverlay.classList.add("show");

    document.body.style.overflow = "hidden";

}


function closeSidebar() {

    adminSidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");

    document.body.style.overflow = "";

}


menuToggle.addEventListener("click", openSidebar);

sidebarClose.addEventListener("click", closeSidebar);

sidebarOverlay.addEventListener("click", closeSidebar);


// Close sidebar using Escape key.
document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {
        closeSidebar();
    }

});


// =====================================
// Notifications
// =====================================

function showAdminNotification(message, type = "success") {

    adminNotification.textContent = message;

    adminNotification.className = "admin-notification";

    if (type === "error") {
        adminNotification.classList.add("error");
    }

    adminNotification.hidden = false;

}


function hideAdminNotification() {

    adminNotification.hidden = true;
    adminNotification.textContent = "";

}


// =====================================
// Load Admin Dashboard Statistics
// =====================================

async function loadAdminStatistics() {

    const statisticElements = {
        students: document.getElementById("totalStudents"),
        organizers: document.getElementById("totalOrganizers"),
        events: document.getElementById("totalEvents"),
        registrations: document.getElementById("totalRegistrations")
    };

    try {

        const response = await fetch("/api/auth/admin/stats", {

            method: "GET",

            credentials: "same-origin"

        });

        const data = await response.json();

        if (!response.ok) {

            throw new Error(
                data.error || "Unable to load dashboard statistics."
            );

        }

        // Display actual database counts.
        statisticElements.students.textContent =
            data.total_students ?? 0;

        statisticElements.organizers.textContent =
            data.total_organizers ?? 0;

        statisticElements.events.textContent =
            data.total_events ?? 0;

        statisticElements.registrations.textContent =
            data.total_registrations ?? 0;

        console.log("Admin statistics loaded:", data);

    }

    catch (error) {

        console.error("Admin statistics error:", error);

        showAdminNotification(
            error.message,
            "error"
        );

    }

}


// =====================================
// Admin Logout
// =====================================

adminLogoutButton.addEventListener("click", async function () {

    hideAdminNotification();

    adminLogoutButton.disabled = true;

    adminLogoutButton.innerHTML = `
        <span class="nav-icon">↪</span>
        <span>Logging out...</span>
    `;

    try {

        const response = await fetch("/api/auth/logout", {

            method: "POST",

            credentials: "same-origin"

        });


        if (!response.ok) {

            throw new Error(
                "Logout failed. Please try again."
            );

        }


        // Redirect after successful logout.
        window.location.href = "/login";

    }

    catch (error) {

        showAdminNotification(error.message, "error");

        adminLogoutButton.disabled = false;

        adminLogoutButton.innerHTML = `
            <span class="nav-icon">↪</span>
            <span>Log out</span>
        `;

    }

});


// =====================================
// Initial Dashboard Setup
// =====================================

showSection("overview");

// Load statistics from the Flask backend.
loadAdminStatistics();
