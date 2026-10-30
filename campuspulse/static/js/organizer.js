
"use strict";

// =====================================
// CampusPulse - Organizer Dashboard
// =====================================


// DOM Elements
const eventsContainer = document.getElementById("eventsContainer");

const totalEvents = document.getElementById("totalEvents");
const publishedEvents = document.getElementById("publishedEvents");
const draftEvents = document.getElementById("draftEvents");

const eventModal = document.getElementById("eventModal");
const eventForm = document.getElementById("eventForm");

const notification = document.getElementById("notification");

const createEventButton = document.getElementById("createEventButton");
const closeModalButton = document.getElementById("closeModalButton");
const cancelEventButton = document.getElementById("cancelEventButton");
const modalBackdrop = document.getElementById("modalBackdrop");

const refreshButton = document.getElementById("refreshButton");
const logoutButton = document.getElementById("logoutButton");
const submitEventButton = document.getElementById("submitEventButton");

const eventModalTitle = document.getElementById("eventModalTitle");
const eventModalEyebrow = document.getElementById("eventModalEyebrow");


// Currently selected event being edited.
// null means that the form is in Create mode.
let editingEventId = null;

let organizerEvents = [];


// =====================================
// Utility Functions
// =====================================

function escapeHTML(value) {
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


function formatDate(dateValue) {
    if (!dateValue) {
        return "Not specified";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Invalid date";
    }

    return date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}


// Convert an API date into the format required by datetime-local.
// The input expects local time without a timezone suffix.
function toDateTimeLocal(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
    );

    return localDate.toISOString().slice(0, 16);
}


// Display inline notifications.
function showNotification(message, type = "success") {
    notification.textContent = message;

    notification.className = "notification";

    if (type === "error") {
        notification.classList.add("error");
    }

    notification.hidden = false;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// Hide notification.
function hideNotification() {
    notification.hidden = true;
    notification.textContent = "";
}


// =====================================
// Modal Controls
// =====================================

function openCreateModal() {
    editingEventId = null;

    eventForm.reset();

    eventModalTitle.textContent = "Create an event";
    eventModalEyebrow.textContent = "NEW CAMPUS EVENT";
    submitEventButton.textContent = "Save as draft";

    hideNotification();

    eventModal.hidden = false;
    document.body.style.overflow = "hidden";

    document.getElementById("eventTitle").focus();
}


function openEditModal(eventId) {
    const selectedEvent = organizerEvents.find(
        event => String(event.id) === String(eventId)
    );

    if (!selectedEvent) {
        showNotification("Unable to find this event.", "error");
        return;
    }

    if (selectedEvent.status !== "draft") {
        showNotification("Only draft events can be edited.", "error");
        return;
    }

    editingEventId = selectedEvent.id;

    // Fill the form with existing event details.
    document.getElementById("eventTitle").value =
        selectedEvent.title || "";

    document.getElementById("eventDescription").value =
        selectedEvent.description || "";

    document.getElementById("eventCategory").value =
        selectedEvent.category || "General";

    document.getElementById("eventVenue").value =
        selectedEvent.venue || "";

    document.getElementById("eventStart").value =
        toDateTimeLocal(selectedEvent.starts_at);

    document.getElementById("eventEnd").value =
        toDateTimeLocal(selectedEvent.ends_at);

    document.getElementById("eventCapacity").value =
        selectedEvent.capacity ?? "";

    eventModalTitle.textContent = "Edit event";
    eventModalEyebrow.textContent = "UPDATE CAMPUS EVENT";
    submitEventButton.textContent = "Save changes";

    hideNotification();

    eventModal.hidden = false;
    document.body.style.overflow = "hidden";

    document.getElementById("eventTitle").focus();
}


function closeModal() {
    eventModal.hidden = true;

    document.body.style.overflow = "";

    eventForm.reset();

    // Reset modal back to Create mode.
    editingEventId = null;

    eventModalTitle.textContent = "Create an event";
    eventModalEyebrow.textContent = "NEW CAMPUS EVENT";
    submitEventButton.textContent = "Save as draft";

    submitEventButton.disabled = false;
}


createEventButton.addEventListener("click", openCreateModal);

closeModalButton.addEventListener("click", closeModal);

cancelEventButton.addEventListener("click", closeModal);

modalBackdrop.addEventListener("click", closeModal);


// Close modal using Escape key.
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !eventModal.hidden) {
        closeModal();
    }
});


// =====================================
// Fetch Organizer Events
// =====================================

async function loadEvents() {
    eventsContainer.innerHTML = `
        <div class="loading-message">
            Loading your events...
        </div>
    `;

    refreshButton.disabled = true;

    try {
        const response = await fetch("/api/events/mine", {
            method: "GET",
            credentials: "same-origin"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Unable to load events."
            );
        }

        if (!Array.isArray(data.events)) {
            throw new Error("Invalid event data received.");
        }

        organizerEvents = data.events;

        displayEvents(organizerEvents);
    }

    catch (error) {
        eventsContainer.innerHTML = `
            <div class="empty-message">
                ${escapeHTML(error.message)}
            </div>
        `;

        showNotification(error.message, "error");
    }

    finally {
        refreshButton.disabled = false;
    }
}


// =====================================
// Display Event Cards
// =====================================

function displayEvents(events) {
    const total = events.length;

    const published = events.filter(
        event => event.status === "published"
    ).length;

    const drafts = events.filter(
        event => event.status === "draft"
    ).length;


    // Update statistics.
    totalEvents.textContent = total;
    publishedEvents.textContent = published;
    draftEvents.textContent = drafts;


    // Empty state.
    if (events.length === 0) {
        eventsContainer.innerHTML = `
            <div class="empty-message">
                You haven't created any events yet.
                Click "Create event" to get started.
            </div>
        `;

        return;
    }


    // Generate event cards.
    eventsContainer.innerHTML = events.map(event => {
        const status = escapeHTML(event.status);

        const category = escapeHTML(event.category);

        const title = escapeHTML(event.title);

        const description = escapeHTML(
            event.description || "No description provided."
        );

        const venue = escapeHTML(event.venue);

        const start = escapeHTML(
            formatDate(event.starts_at)
        );

        const end = escapeHTML(
            formatDate(event.ends_at)
        );

        const capacity = escapeHTML(
            event.capacity ?? "Unlimited"
        );


        // Edit and Publish buttons are available only for drafts.
        const draftActions = event.status === "draft"
            ? `
                <button
                    type="button"
                    class="edit-button"
                    data-edit-id="${escapeHTML(event.id)}"
                >
                    Edit event
                </button>

                <button
                    type="button"
                    class="publish-button"
                    data-publish-id="${escapeHTML(event.id)}"
                >
                    Publish event
                </button>
            `
            : `
                <span class="event-detail">
                    This event is published.
                </span>
            `;


        return `
            <article class="event-card">

                <div class="event-card-top">

                    <span class="event-category">
                        ${category}
                    </span>

                    <span class="event-status ${status}">
                        ${status}
                    </span>

                </div>

                <h3>${title}</h3>

                <p class="event-description">
                    ${description}
                </p>

                <div class="event-details">

                    <div class="event-detail">
                        <strong>Venue:</strong> ${venue}
                    </div>

                    <div class="event-detail">
                        <strong>Starts:</strong> ${start}
                    </div>

                    <div class="event-detail">
                        <strong>Ends:</strong> ${end}
                    </div>

                    <div class="event-detail">
                        <strong>Capacity:</strong> ${capacity}
                    </div>

                </div>

                <div class="event-actions">
                    ${draftActions}
                </div>

            </article>
        `;
    }).join("");


    // Attach Edit event listeners.
    document.querySelectorAll("[data-edit-id]")
        .forEach(button => {
            button.addEventListener("click", function () {
                openEditModal(button.dataset.editId);
            });
        });


    // Attach Publish event listeners.
    document.querySelectorAll("[data-publish-id]")
        .forEach(button => {
            button.addEventListener("click", function () {
                const eventId = button.dataset.publishId;

                publishEvent(eventId, button);
            });
        });
}


// =====================================
// Create / Update Event
// =====================================

eventForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    hideNotification();

    submitEventButton.disabled = true;

    submitEventButton.textContent = editingEventId
        ? "Saving changes..."
        : "Saving...";


    try {
        const formData = new FormData(eventForm);


        // Convert date values.
        const startsAt = new Date(
            formData.get("starts_at")
        );

        const endsAt = new Date(
            formData.get("ends_at")
        );


        if (
            Number.isNaN(startsAt.getTime()) ||
            Number.isNaN(endsAt.getTime())
        ) {
            throw new Error(
                "Please enter valid event dates."
            );
        }


        // Validate event timing.
        if (endsAt <= startsAt) {
            throw new Error(
                "Event end time must be after its start time."
            );
        }


        // Prepare event data.
        const capacityValue = formData.get("capacity");

        const eventData = {
            title: formData.get("title").trim(),

            description: formData.get("description").trim(),

            category: formData.get("category"),

            venue: formData.get("venue").trim(),

            starts_at: startsAt.toISOString(),

            ends_at: endsAt.toISOString(),

            capacity: capacityValue
                ? Number(capacityValue)
                : null
        };


        // Decide whether this is Create or Update.
        const isEditing = editingEventId !== null;

        const url = isEditing
            ? `/api/events/${encodeURIComponent(editingEventId)}`
            : "/api/events/";

        const method = isEditing ? "PATCH" : "POST";


        // Send request to Flask.
        const response = await fetch(url, {
            method: method,

            credentials: "same-origin",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(eventData)
        });


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.error ||
                (isEditing
                    ? "Unable to update event."
                    : "Unable to create event.")
            );
        }


        // Close modal after success.
        closeModal();


        showNotification(
            isEditing
                ? "Event updated successfully."
                : "Event created successfully and saved as a draft."
        );


        // Refresh event list.
        await loadEvents();

    }

    catch (error) {
        showNotification(error.message, "error");
    }

    finally {
        submitEventButton.disabled = false;

        if (editingEventId === null) {
            submitEventButton.textContent = "Save as draft";
        } else {
            submitEventButton.textContent = "Save changes";
        }
    }
});


// =====================================
// Publish Event
// =====================================

async function publishEvent(eventId, button) {
    hideNotification();

    button.disabled = true;

    button.textContent = "Publishing...";


    try {
        const response = await fetch(
            `/api/events/${encodeURIComponent(eventId)}/publish`,
            {
                method: "POST",

                credentials: "same-origin"
            }
        );


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.error || "Unable to publish event."
            );
        }


        showNotification(
            "Event published successfully!"
        );


        // Reload event list and statistics.
        await loadEvents();

    }

    catch (error) {
        showNotification(error.message, "error");

        button.disabled = false;

        button.textContent = "Publish event";
    }
}


// =====================================
// Refresh Dashboard
// =====================================

refreshButton.addEventListener("click", function () {
    hideNotification();

    loadEvents();
});


// =====================================
// Organizer Logout
// =====================================

logoutButton.addEventListener("click", async function () {
    hideNotification();

    logoutButton.disabled = true;

    logoutButton.textContent = "Logging out...";


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
        showNotification(error.message, "error");

        logoutButton.disabled = false;

        logoutButton.textContent = "Log out";
    }
});


// =====================================
// Initial Dashboard Load
// =====================================

loadEvents();
