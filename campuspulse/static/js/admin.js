
"use strict";

// =====================================
// CampusPulse - Admin Dashboard
// =====================================


// =====================================
// DOM Elements
// =====================================

// Sidebar
const adminSidebar = document.getElementById("adminSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

const menuToggle = document.getElementById("menuToggle");
const sidebarClose = document.getElementById("sidebarClose");

// Header
const topbarTitle = document.getElementById("topbarTitle");

// Notifications
const adminNotification = document.getElementById("adminNotification");

// Logout
const adminLogoutButton = document.getElementById("adminLogoutButton");

// Navigation
const navigationButtons = document.querySelectorAll("[data-section]");
const sectionButtons = document.querySelectorAll("[data-go-section]");
const adminSections = document.querySelectorAll(".admin-section");

// Dashboard statistics
const totalStudents = document.getElementById("totalStudents");
const totalOrganizers = document.getElementById("totalOrganizers");
const totalEvents = document.getElementById("totalEvents");
const totalRegistrations = document.getElementById("totalRegistrations");

// User Management
const usersTableBody = document.getElementById("usersTableBody");

const userSearchInput = document.getElementById("userSearchInput");
const userRoleFilter = document.getElementById("userRoleFilter");
const refreshUsersButton = document.getElementById("refreshUsersButton");

const userTotalCount = document.getElementById("userTotalCount");
const userStudentCount = document.getElementById("userStudentCount");
const userOrganizerCount = document.getElementById("userOrganizerCount");

const userResultsMessage = document.getElementById("userResultsMessage");


// =====================================
// Application State
// =====================================

let allUsers = [];
let usersLoaded = false;


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

    // Load users when opening User Management.
    if (sectionName === "users" && !usersLoaded) {
        loadUsers();
    }

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
        totalStudents.textContent =
            data.total_students ?? 0;

        totalOrganizers.textContent =
            data.total_organizers ?? 0;

        totalEvents.textContent =
            data.total_events ?? 0;

        totalRegistrations.textContent =
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
// User Management
// =====================================


// Escape user-provided data before inserting HTML.
function escapeUserHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => {

        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];

    });

}


// Load users from Flask API.
async function loadUsers() {

    usersTableBody.innerHTML = `
        <tr>
            <td colspan="4" class="user-table-message">
                Loading users...
            </td>
        </tr>
    `;

    refreshUsersButton.disabled = true;

    try {

        const response = await fetch("/api/auth/admin/users", {

            method: "GET",

            credentials: "same-origin"

        });

        const data = await response.json();

        if (!response.ok) {

            throw new Error(
                data.error || "Unable to load users."
            );

        }

        allUsers = Array.isArray(data.users)
            ? data.users
            : [];

        usersLoaded = true;

        // Update global user statistics.
        userTotalCount.textContent = allUsers.length;

        userStudentCount.textContent = allUsers.filter(
            user => user.role === "student"
        ).length;

        userOrganizerCount.textContent = allUsers.filter(
            user => user.role === "organizer"
        ).length;

        // Apply current search and role filters.
        filterAndDisplayUsers();

        console.log("Users loaded:", data);

    }

    catch (error) {

        console.error("User loading error:", error);

        usersTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="user-table-message">
                    ${escapeUserHTML(error.message)}
                </td>
            </tr>
        `;

        userResultsMessage.textContent = "Unable to load users.";

        showAdminNotification(
            error.message,
            "error"
        );

    }

    finally {

        refreshUsersButton.disabled = false;

    }

}


// Apply search and role filters locally.
function filterAndDisplayUsers() {

    const search = userSearchInput.value.trim().toLowerCase();

    const role = userRoleFilter.value;

    const filteredUsers = allUsers.filter(user => {

        const name = String(user.full_name ?? "").toLowerCase();

        const email = String(user.email ?? "").toLowerCase();

        const matchesSearch =
            name.includes(search) ||
            email.includes(search);

        const matchesRole =
            role === "all" ||
            user.role === role;

        return matchesSearch && matchesRole;

    });

    displayUsers(filteredUsers);

}


// Display users in the table.
function displayUsers(users) {

    if (users.length === 0) {

        usersTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="user-table-message">
                    No matching users found.
                </td>
            </tr>
        `;

        userResultsMessage.textContent = "0 users found.";

        return;
    }


    usersTableBody.innerHTML = users.map(user => {

        const name = escapeUserHTML(user.full_name);

        const email = escapeUserHTML(user.email);

        const role = escapeUserHTML(user.role);

        const initial = escapeUserHTML(
            (user.full_name || "?").charAt(0).toUpperCase()
        );

        const joinedDate = user.created_at
            ? escapeUserHTML(
                new Date(user.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                })
            )
            : "Not available";


        return `
            <tr>

                <td>
                    <div class="user-name-cell">

                        <div class="user-table-avatar">
                            ${initial}
                        </div>

                        <strong>${name}</strong>

                    </div>
                </td>

                <td>${email}</td>

                <td>
                    <span class="user-role-badge ${role}">
                        ${role}
                    </span>
                </td>

                <td>${joinedDate}</td>

            </tr>
        `;

    }).join("");


    userResultsMessage.textContent =
        `Showing ${users.length} user(s).`;

}


// =====================================
// User Search
// =====================================

userSearchInput.addEventListener("input", function () {

    if (!usersLoaded) {
        return;
    }

    filterAndDisplayUsers();

});


// =====================================
// User Role Filter
// =====================================

userRoleFilter.addEventListener("change", function () {

    if (!usersLoaded) {
        return;
    }

    filterAndDisplayUsers();

});


// =====================================
// Refresh User List
// =====================================

refreshUsersButton.addEventListener("click", function () {

    loadUsers();

});


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

// Load dashboard statistics.
loadAdminStatistics();
