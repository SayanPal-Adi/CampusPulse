
"use strict";

// =====================================
// CampusPulse - Admin Dashboard
// =====================================


// =====================================
// DOM ELEMENTS
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

// Event Management
const adminEventsTableBody = document.getElementById("adminEventsTableBody");
const adminEventSearch = document.getElementById("adminEventSearch");
const adminEventStatusFilter = document.getElementById("adminEventStatusFilter");
const refreshEventsButton = document.getElementById("refreshEventsButton");

const adminEventTotal = document.getElementById("adminEventTotal");
const adminEventPublished = document.getElementById("adminEventPublished");
const adminEventDrafts = document.getElementById("adminEventDrafts");
const adminEventResultsMessage = document.getElementById("adminEventResultsMessage");

// Event Details Modal
const adminEventModal = document.getElementById("adminEventModal");
const adminEventModalBackdrop = document.getElementById("adminEventModalBackdrop");

const closeEventModalButton = document.getElementById("closeEventModal");
const closeEventModalFooter = document.getElementById("closeEventModalFooter");

// Registration Management
const registrationsTableBody = document.getElementById("registrationsTableBody");
const registrationSearchInput = document.getElementById("registrationSearchInput");
const registrationStatusFilter = document.getElementById("registrationStatusFilter");
const registrationEventFilter = document.getElementById("registrationEventFilter");
const refreshRegistrationsButton = document.getElementById("refreshRegistrationsButton");

const registrationTotalCount = document.getElementById("registrationTotalCount");
const registrationActiveCount = document.getElementById("registrationActiveCount");
const registrationCancelledCount = document.getElementById("registrationCancelledCount");
const registrationResultsMessage = document.getElementById("registrationResultsMessage");


// =====================================
// APPLICATION STATE
// =====================================

let allUsers = [];
let usersLoaded = false;

let allAdminEvents = [];
let adminEventsLoaded = false;

let allAdminRegistrations = [];
let registrationsLoaded = false;

let registrationSearchTimer = null;
let registrationRequestController = null;


// =====================================
// SECTION NAVIGATION
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

    // Close mobile sidebar.
    closeSidebar();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    // Load sections when first opened.
    if (sectionName === "users" && !usersLoaded) {
        loadUsers();
    }

    if (sectionName === "events" && !adminEventsLoaded) {
        loadAdminEvents();
    }

    if (sectionName === "registrations" && !registrationsLoaded) {
        loadAdminRegistrations();
    }

}


// Sidebar navigation.
navigationButtons.forEach(button => {

    button.addEventListener("click", function () {
        showSection(button.dataset.section);
    });

});


// Quick management buttons.
sectionButtons.forEach(button => {

    button.addEventListener("click", function () {
        showSection(button.dataset.goSection);
    });

});


// =====================================
// MOBILE SIDEBAR
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


// =====================================
// NOTIFICATIONS
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
// HTML ESCAPING
// =====================================

function escapeAdminHTML(value) {

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


// =====================================
// API RESPONSE HANDLING
// =====================================

async function readAdminResponse(response) {

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        throw new Error("Your session has expired. Please log in again.");
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            data.message ||
            `Request failed (${response.status}).`
        );
    }

    return data;

}


// =====================================
// DATE FORMATTING
// =====================================

function formatAdminEventDate(dateValue) {

    if (!dateValue) {
        return "Not available";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Invalid date";
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

}


// =====================================
// LOAD DASHBOARD STATISTICS
// =====================================

async function loadAdminStatistics() {

    try {

        const response = await fetch("/api/auth/admin/stats", {
            method: "GET",
            credentials: "same-origin"
        });

        const data = await readAdminResponse(response);

        totalStudents.textContent = data.total_students ?? 0;
        totalOrganizers.textContent = data.total_organizers ?? 0;
        totalEvents.textContent = data.total_events ?? 0;
        totalRegistrations.textContent = data.total_registrations ?? 0;

        console.log("Admin statistics loaded:", data);

    }

    catch (error) {

        console.error("Admin statistics error:", error);
        showAdminNotification(error.message, "error");

    }

}


// =====================================
// USER MANAGEMENT
// =====================================


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

        const data = await readAdminResponse(response);

        allUsers = Array.isArray(data.users) ? data.users : [];
        usersLoaded = true;

        // Global user counts.
        userTotalCount.textContent = allUsers.length;

        userStudentCount.textContent = allUsers.filter(
            user => user.role === "student"
        ).length;

        userOrganizerCount.textContent = allUsers.filter(
            user => user.role === "organizer"
        ).length;

        filterAndDisplayUsers();

        console.log("Users loaded:", data);

    }

    catch (error) {

        console.error("User loading error:", error);

        usersTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="user-table-message">
                    ${escapeAdminHTML(error.message)}
                </td>
            </tr>
        `;

        userResultsMessage.textContent = "Unable to load users.";

        showAdminNotification(error.message, "error");

    }

    finally {
        refreshUsersButton.disabled = false;
    }

}


// Search and filter users locally.
function filterAndDisplayUsers() {

    const search = userSearchInput.value.trim().toLowerCase();
    const role = userRoleFilter.value;

    const filteredUsers = allUsers.filter(user => {

        const name = String(user.full_name ?? "").toLowerCase();
        const email = String(user.email ?? "").toLowerCase();

        const matchesSearch =
            name.includes(search) || email.includes(search);

        const matchesRole =
            role === "all" || user.role === role;

        return matchesSearch && matchesRole;

    });

    displayUsers(filteredUsers);

}


// Display users.
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

        const name = escapeAdminHTML(user.full_name);
        const email = escapeAdminHTML(user.email);
        const role = escapeAdminHTML(user.role);

        const initial = escapeAdminHTML(
            (user.full_name || "?").charAt(0).toUpperCase()
        );

        const joinedDate = user.created_at
            ? escapeAdminHTML(
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
                        <div class="user-table-avatar">${initial}</div>
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


// User search.
userSearchInput.addEventListener("input", function () {

    if (usersLoaded) {
        filterAndDisplayUsers();
    }

});


// User role filter.
userRoleFilter.addEventListener("change", function () {

    if (usersLoaded) {
        filterAndDisplayUsers();
    }

});


// Refresh users.
refreshUsersButton.addEventListener("click", loadUsers);


// =====================================
// EVENT MANAGEMENT
// =====================================


// Load all events from Flask API.
async function loadAdminEvents() {

    adminEventsTableBody.innerHTML = `
        <tr>
            <td colspan="7" class="event-table-message">
                Loading events...
            </td>
        </tr>
    `;

    refreshEventsButton.disabled = true;

    try {

        const response = await fetch("/api/auth/admin/events", {
            method: "GET",
            credentials: "same-origin"
        });

        const data = await readAdminResponse(response);

        allAdminEvents = Array.isArray(data.events)
            ? data.events
            : [];

        adminEventsLoaded = true;

        adminEventTotal.textContent = allAdminEvents.length;

        adminEventPublished.textContent = allAdminEvents.filter(
            event => event.status === "published"
        ).length;

        adminEventDrafts.textContent = allAdminEvents.filter(
            event => event.status === "draft"
        ).length;

        filterAndDisplayAdminEvents();

        // Keep registration event filter options updated.
        if (registrationEventFilter) {
            populateRegistrationEventFilter();
        }

        console.log("Admin events loaded:", data);

    }

    catch (error) {

        console.error("Admin event loading error:", error);

        adminEventsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="event-table-message">
                    ${escapeAdminHTML(error.message)}
                </td>
            </tr>
        `;

        adminEventResultsMessage.textContent =
            "Unable to load events.";

        showAdminNotification(error.message, "error");

    }

    finally {
        refreshEventsButton.disabled = false;
    }

}


// Apply event search and status filters.
function filterAndDisplayAdminEvents() {

    const search = adminEventSearch.value.trim().toLowerCase();
    const status = adminEventStatusFilter.value;

    const filteredEvents = allAdminEvents.filter(event => {

        const title = String(event.title ?? "").toLowerCase();
        const venue = String(event.venue ?? "").toLowerCase();

        const organizerName = String(
            event.organizer?.name ?? ""
        ).toLowerCase();

        const matchesSearch =
            title.includes(search) ||
            venue.includes(search) ||
            organizerName.includes(search);

        const matchesStatus =
            status === "all" || event.status === status;

        return matchesSearch && matchesStatus;

    });

    displayAdminEvents(filteredEvents);

}


// Display events in the table.
function displayAdminEvents(events) {

    if (events.length === 0) {

        adminEventsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="event-table-message">
                    No matching events found.
                </td>
            </tr>
        `;

        adminEventResultsMessage.textContent = "0 events found.";
        return;
    }

    adminEventsTableBody.innerHTML = events.map(event => {

        const title = escapeAdminHTML(event.title);
        const category = escapeAdminHTML(event.category);
        const venue = escapeAdminHTML(event.venue);

        const organizerName = escapeAdminHTML(
            event.organizer?.name || "Unknown organizer"
        );

        const organizerEmail = escapeAdminHTML(
            event.organizer?.email || "No email available"
        );

        const eventDate = escapeAdminHTML(
            formatAdminEventDate(event.starts_at)
        );

        const capacity = event.capacity == null
            ? "Unlimited"
            : escapeAdminHTML(event.capacity);

        const status = String(event.status ?? "").toLowerCase();

        const statusClass = [
            "published",
            "draft",
            "suspended"
        ].includes(status)
            ? status
            : "other";

        const statusLabel = escapeAdminHTML(status || "Unknown");

        const eventId = escapeAdminHTML(event.id);

        return `
            <tr>

                <td>
                    <div class="event-name-cell">
                        <strong>${title}</strong>
                        <small>${category}</small>
                    </div>
                </td>

                <td>
                    <div class="event-organizer-cell">
                        <strong>${organizerName}</strong>
                        <small>${organizerEmail}</small>
                    </div>
                </td>

                <td>
                    <div class="event-venue-cell">
                        ${venue}
                    </div>
                </td>

                <td>
                    <div class="event-date-cell">
                        ${eventDate}
                    </div>
                </td>

                <td>
                    <div class="event-capacity-cell">
                        ${capacity}
                    </div>
                </td>

                <td>
                    <span class="event-status-badge ${statusClass}">
                        ${statusLabel}
                    </span>
                </td>

                <td>
                    <div class="admin-event-actions">

                        <button
                            type="button"
                            class="event-view-button"
                            data-event-id="${eventId}">
                            View details
                        </button>

                        ${
                            status === "published"
                                ? `
                                    <button
                                        type="button"
                                        class="event-status-action"
                                        data-event-action="draft"
                                        data-event-id="${eventId}">
                                        Unpublish
                                    </button>

                                    <button
                                        type="button"
                                        class="event-status-action danger"
                                        data-event-action="suspended"
                                        data-event-id="${eventId}">
                                        Suspend
                                    </button>
                                `
                                : status === "suspended"
                                    ? `
                                        <button
                                            type="button"
                                            class="event-status-action"
                                            data-event-action="published"
                                            data-event-id="${eventId}">
                                            Republish
                                        </button>

                                        <button
                                            type="button"
                                            class="event-status-action"
                                            data-event-action="draft"
                                            data-event-id="${eventId}">
                                            Unpublish
                                        </button>
                                    `
                                    : status === "draft"
                                        ? `
                                            <button
                                                type="button"
                                                class="event-status-action"
                                                data-event-action="published"
                                                data-event-id="${eventId}">
                                                Publish
                                            </button>
                                        `
                                        : ""
                        }

                    </div>
                </td>

            </tr>
        `;

    }).join("");

    adminEventResultsMessage.textContent =
        `Showing ${events.length} event(s).`;

}


// Event status update.
async function updateAdminEventStatus(eventId, newStatus, button) {

    const actionLabels = {
        published: "Republish",
        draft: "Unpublish",
        suspended: "Suspend"
    };

    // First click asks for confirmation.
    if (button.dataset.confirming !== "true") {

        const actionLabel = actionLabels[newStatus];

        button.dataset.confirming = "true";
        button.textContent = `Confirm ${actionLabel}`;
        button.classList.add("confirming");

        showAdminNotification(
            `Click "Confirm ${actionLabel}" to continue.`,
            "success"
        );

        return;
    }

    // Second click performs the status update.
    button.disabled = true;
    button.textContent = "Updating...";

    try {

        const response = await fetch(
            `/api/auth/admin/events/${encodeURIComponent(eventId)}/status`,
            {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: newStatus
                })
            }
        );

        const data = await readAdminResponse(response);

        showAdminNotification(
            data.message || "Event status updated successfully."
        );

        await loadAdminEvents();
        await loadAdminStatistics();

    } catch (error) {

        console.error("Event status update error:", error);

        showAdminNotification(error.message, "error");

        button.disabled = false;
        button.dataset.confirming = "false";
        button.textContent = actionLabels[newStatus];
        button.classList.remove("confirming");
    }

}


// Event search.
adminEventSearch.addEventListener("input", function () {

    if (adminEventsLoaded) {
        filterAndDisplayAdminEvents();
    }

});


// Event status filter.
adminEventStatusFilter.addEventListener("change", function () {

    if (adminEventsLoaded) {
        filterAndDisplayAdminEvents();
    }

});


// Refresh events.
refreshEventsButton.addEventListener("click", loadAdminEvents);


// =====================================
// EVENT DETAILS MODAL
// =====================================


// Open event details.
function openAdminEventDetails(eventId) {

    const event = allAdminEvents.find(
        item => String(item.id) === String(eventId)
    );

    if (!event) {
        showAdminNotification(
            "Event details could not be found.",
            "error"
        );
        return;
    }

    document.getElementById("eventDetailTitle").textContent =
        event.title || "Untitled event";

    document.getElementById("eventDetailDescription").textContent =
        event.description || "No description provided.";

    document.getElementById("eventDetailCategory").textContent =
        event.category || "General";

    // Event status.
    const statusElement = document.getElementById("eventDetailStatus");

    const status = String(event.status || "unknown").toLowerCase();

    statusElement.textContent = status;
    statusElement.className = "event-status-badge";

    if (["published", "draft", "suspended"].includes(status)) {
        statusElement.classList.add(status);
    } else {
        statusElement.classList.add("other");
    }

    // Organizer details.
    document.getElementById("eventDetailOrganizer").textContent =
        event.organizer?.name || "Unknown organizer";

    document.getElementById("eventDetailEmail").textContent =
        event.organizer?.email || "Not available";

    // Venue and capacity.
    document.getElementById("eventDetailVenue").textContent =
        event.venue || "Not specified";

    document.getElementById("eventDetailCapacity").textContent =
        event.capacity == null ? "Unlimited" : event.capacity;

    // Event schedule.
    document.getElementById("eventDetailStart").textContent =
        formatAdminEventDate(event.starts_at);

    document.getElementById("eventDetailEnd").textContent =
        formatAdminEventDate(event.ends_at);

    document.getElementById("eventDetailDeadline").textContent =
        event.registration_deadline
            ? formatAdminEventDate(event.registration_deadline)
            : "Not specified";

    document.getElementById("eventDetailCreated").textContent =
        formatAdminEventDate(event.created_at);

    // Display modal.
    adminEventModal.hidden = false;
    document.body.style.overflow = "hidden";

    closeEventModalButton.focus();

}


// Close event details.
function closeAdminEventDetails() {

    adminEventModal.hidden = true;
    document.body.style.overflow = "";

}


// Event delegation for dynamically generated buttons.
adminEventsTableBody.addEventListener("click", function (event) {

    const button = event.target.closest("[data-event-id]");

    if (!button) {
        return;
    }

    // Handle event status actions first.
    const newStatus = button.dataset.eventAction;

    if (newStatus) {

        updateAdminEventStatus(
            button.dataset.eventId,
            newStatus,
            button
        );

        return;
    }

    // Otherwise, open event details.
    openAdminEventDetails(button.dataset.eventId);

});


// Modal close buttons.
closeEventModalButton.addEventListener(
    "click",
    closeAdminEventDetails
);

closeEventModalFooter.addEventListener(
    "click",
    closeAdminEventDetails
);


// Close modal by clicking backdrop.
adminEventModalBackdrop.addEventListener(
    "click",
    closeAdminEventDetails
);


// =====================================
// REGISTRATION MANAGEMENT
// =====================================


// Populate the event dropdown using the admin event list.
function populateRegistrationEventFilter() {

    const selectedValue = registrationEventFilter.value;

    const options = [
        `<option value="all">All events</option>`
    ];

    allAdminEvents.forEach(event => {

        const eventId = escapeAdminHTML(event.id);
        const eventTitle = escapeAdminHTML(event.title);

        options.push(`
            <option value="${eventId}">
                ${eventTitle}
            </option>
        `);

    });

    registrationEventFilter.innerHTML = options.join("");

    // Preserve the selected event when refreshing.
    if (
        selectedValue !== "all" &&
        allAdminEvents.some(
            event => String(event.id) === selectedValue
        )
    ) {
        registrationEventFilter.value = selectedValue;
    }

}


// Load registrations from Flask API.
async function loadAdminRegistrations() {

    // Cancel an older request if one is still running.
    if (registrationRequestController) {
        registrationRequestController.abort();
    }

    registrationRequestController = new AbortController();

    const controller = registrationRequestController;

    registrationsTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="registration-table-message">
                Loading registrations...
            </td>
        </tr>
    `;

    refreshRegistrationsButton.disabled = true;

    try {

        // Load the event list for the event filter.
        if (!adminEventsLoaded) {
            await loadAdminEvents();
        }

        populateRegistrationEventFilter();

        const search = registrationSearchInput.value.trim();
        const status = registrationStatusFilter.value;
        const eventId = registrationEventFilter.value;

        const params = new URLSearchParams();

        if (search) {
            params.set("q", search);
        }

        if (status !== "all") {
            params.set("status", status);
        }

        if (eventId !== "all") {
            params.set("event_id", eventId);
        }

        const queryString = params.toString();

        const endpoint = queryString
            ? `/api/auth/admin/registrations?${queryString}`
            : "/api/auth/admin/registrations";

        const response = await fetch(endpoint, {
            method: "GET",
            credentials: "same-origin",
            signal: controller.signal
        });

        const data = await readAdminResponse(response);

        allAdminRegistrations = Array.isArray(data.registrations)
            ? data.registrations
            : [];

        registrationsLoaded = true;

        // Update statistics returned by the backend.
        const counts = data.counts || {};

        registrationTotalCount.textContent =
            counts.total ?? allAdminRegistrations.length;

        registrationActiveCount.textContent =
            counts.active ?? 0;

        registrationCancelledCount.textContent =
            counts.cancelled ?? 0;

        displayAdminRegistrations(allAdminRegistrations);

        console.log("Admin registrations loaded:", data);

    }

    catch (error) {

        if (error.name === "AbortError") {
            return;
        }

        console.error("Registration loading error:", error);

        registrationsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="registration-table-message">
                    ${escapeAdminHTML(error.message)}
                </td>
            </tr>
        `;

        registrationResultsMessage.textContent =
            "Unable to load registrations.";

        showAdminNotification(error.message, "error");

    }

    finally {

        if (registrationRequestController === controller) {
            registrationRequestController = null;
            refreshRegistrationsButton.disabled = false;
        }

    }

}


// Display registrations in the table.
function displayAdminRegistrations(registrations) {

    if (registrations.length === 0) {

        registrationsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="registration-table-message">
                    No matching registrations found.
                </td>
            </tr>
        `;

        registrationResultsMessage.textContent =
            "0 registrations found.";

        return;
    }

    registrationsTableBody.innerHTML = registrations.map(registration => {

        const studentName = escapeAdminHTML(
            registration.student_name || "Unknown student"
        );

        const studentEmail = escapeAdminHTML(
            registration.student_email || "Not available"
        );

        const eventTitle = escapeAdminHTML(
            registration.event_title || "Unknown event"
        );

        const venue = escapeAdminHTML(
            registration.event_venue || "Not specified"
        );

        const registeredDate = escapeAdminHTML(
            formatAdminEventDate(registration.registered_at)
        );

        const status = String(
            registration.status || "unknown"
        ).toLowerCase();

        const allowedStatus = [
            "registered",
            "cancelled"
        ].includes(status);

        const statusClass = allowedStatus
            ? status
            : "unknown";

        const statusLabel = escapeAdminHTML(status);

        return `
            <tr>

                <td>
                    <div class="registration-student-cell">
                        <strong>${studentName}</strong>
                    </div>
                </td>

                <td>${studentEmail}</td>

                <td>
                    <div class="registration-event-cell">
                        <strong>${eventTitle}</strong>
                    </div>
                </td>

                <td>${venue}</td>

                <td>
                    <div class="registration-date-cell">
                        ${registeredDate}
                    </div>
                </td>

                <td>
                    <span class="registration-status-badge ${statusClass}">
                        ${statusLabel}
                    </span>
                </td>

            </tr>
        `;

    }).join("");

    registrationResultsMessage.textContent =
        `Showing ${registrations.length} registration(s).`;

}


// Search registrations with a small debounce.
registrationSearchInput.addEventListener("input", function () {

    if (!registrationsLoaded) {
        return;
    }

    clearTimeout(registrationSearchTimer);

    registrationSearchTimer = setTimeout(() => {
        loadAdminRegistrations();
    }, 350);

});


// Filter registrations by status.
registrationStatusFilter.addEventListener("change", function () {

    if (registrationsLoaded) {
        loadAdminRegistrations();
    }

});


// Filter registrations by event.
registrationEventFilter.addEventListener("change", function () {

    if (registrationsLoaded) {
        loadAdminRegistrations();
    }

});


// Refresh registrations.
refreshRegistrationsButton.addEventListener(
    "click",
    loadAdminRegistrations
);


// =====================================
// ESCAPE KEY HANDLING
// =====================================

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {

        closeSidebar();

        if (!adminEventModal.hidden) {
            closeAdminEventDetails();
        }

    }

});


// =====================================
// ADMIN LOGOUT
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
// INITIAL DASHBOARD SETUP
// =====================================

showSection("overview");

// Load dashboard statistics.
loadAdminStatistics();
