
from datetime import datetime
from uuid import UUID

from flask import (
    Blueprint,
    jsonify,
    request,
    session,
    render_template,
    redirect,
    url_for,
    current_app,
)

from sqlalchemy import func, select, or_
from sqlalchemy.exc import IntegrityError

from werkzeug.security import (
    check_password_hash,
    generate_password_hash,
)

from . import db
from .models import Event, Registration, User


events_bp = Blueprint("events", __name__, url_prefix="/api/events")
auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def get_current_user():
    """Return the logged-in user, or None if the session is invalid."""
    user_id = session.get("user_id")

    if not user_id:
        return None

    try:
        user = db.session.get(User, UUID(user_id))
    except (ValueError, TypeError):
        session.clear()
        return None

    if user is None:
        session.clear()

    return user


# -------------------------
# Admin Dashboard Statistics
# -------------------------

@auth_bp.route("/admin/stats", methods=["GET"])
def admin_statistics():

    user = get_current_user()

    if user is None:
        return jsonify({
            "error": "Please log in first."
        }), 401

    if user.role != "admin":
        return jsonify({
            "error": "Administrator permission required."
        }), 403

    try:
        total_students = db.session.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role == "student")
        )

        total_organizers = db.session.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role == "organizer")
        )

        total_events = db.session.scalar(
            select(func.count())
            .select_from(Event)
        )

        total_registrations = db.session.scalar(
            select(func.count())
            .select_from(Registration)
        )

        return jsonify({
            "total_students": total_students,
            "total_organizers": total_organizers,
            "total_events": total_events,
            "total_registrations": total_registrations
        }), 200

    except Exception:
        current_app.logger.exception(
            "Unable to fetch admin dashboard statistics"
        )

        return jsonify({
            "error": "Unable to load dashboard statistics."
        }), 500


# -------------------------
# Admin: User Management
# -------------------------

@auth_bp.route("/admin/users", methods=["GET"])
def admin_list_users():

    user = get_current_user()

    if user is None:
        return jsonify({
            "error": "Please log in first."
        }), 401

    if user.role != "admin":
        return jsonify({
            "error": "Administrator permission required."
        }), 403

    try:
        search_query = request.args.get("search", "").strip()
        role_filter = request.args.get("role", "all").strip().lower()

        query = select(User).where(
            User.role.in_(["student", "organizer"])
        )

        if role_filter in ("student", "organizer"):
            query = query.where(User.role == role_filter)

        elif role_filter != "all":
            return jsonify({
                "error": "Invalid role filter."
            }), 400

        if search_query:
            search_pattern = f"%{search_query}%"

            query = query.where(
                or_(
                    User.full_name.ilike(search_pattern),
                    User.email.ilike(search_pattern)
                )
            )

        query = query.order_by(User.created_at.desc())

        users = db.session.execute(query).scalars().all()

        user_list = []

        for account in users:
            user_list.append({
                "id": str(account.id),
                "full_name": account.full_name,
                "email": account.email,
                "role": account.role,
                "created_at": (
                    account.created_at.isoformat()
                    if account.created_at
                    else None
                )
            })

        return jsonify({
            "total": len(user_list),
            "users": user_list
        }), 200

    except Exception:
        current_app.logger.exception(
            "Unable to fetch admin user list"
        )

        return jsonify({
            "error": "Unable to load users."
        }), 500


# -------------------------
# Admin: Event Management
# -------------------------

@auth_bp.route("/admin/events", methods=["GET"])
def admin_list_events():

    user = get_current_user()

    if user is None:
        return jsonify({
            "error": "Please log in first."
        }), 401

    if user.role != "admin":
        return jsonify({
            "error": "Administrator permission required."
        }), 403

    try:
        search_query = request.args.get("search", "").strip()
        status_filter = request.args.get("status", "all").strip().lower()

        allowed_statuses = [
            "all",
            "draft",
            "published",
            "suspended"
        ]

        if status_filter not in allowed_statuses:
            return jsonify({
                "error": "Invalid event status filter."
            }), 400

        query = (
            select(Event, User)
            .join(User, Event.organizer_id == User.id)
        )

        if status_filter != "all":
            query = query.where(Event.status == status_filter)

        if search_query:
            search_pattern = f"%{search_query}%"

            query = query.where(
                or_(
                    Event.title.ilike(search_pattern),
                    Event.venue.ilike(search_pattern),
                    User.full_name.ilike(search_pattern)
                )
            )

        query = query.order_by(Event.created_at.desc())

        results = db.session.execute(query).all()

        events = []

        for event, organizer in results:
            events.append({
                "id": str(event.id),
                "title": event.title,
                "description": event.description,
                "category": event.category,
                "venue": event.venue,
                "starts_at": (
                    event.starts_at.isoformat()
                    if event.starts_at else None
                ),
                "ends_at": (
                    event.ends_at.isoformat()
                    if event.ends_at else None
                ),
                "registration_deadline": (
                    event.registration_deadline.isoformat()
                    if event.registration_deadline else None
                ),
                "capacity": event.capacity,
                "status": event.status,
                "created_at": (
                    event.created_at.isoformat()
                    if event.created_at else None
                ),
                "organizer": {
                    "id": str(organizer.id),
                    "name": organizer.full_name,
                    "email": organizer.email
                }
            })

        return jsonify({
            "total": len(events),
            "events": events
        }), 200

    except Exception:
        current_app.logger.exception(
            "Unable to fetch admin event list"
        )

        return jsonify({
            "error": "Unable to load events."
        }), 500


# -------------------------
# Admin: Update Event Status
# -------------------------

@auth_bp.route("/admin/events/<event_id>/status", methods=["POST"])
def admin_update_event_status(event_id):

    user = get_current_user()

    if user is None:
        return jsonify({
            "error": "Please log in first."
        }), 401

    if user.role != "admin":
        return jsonify({
            "error": "Administrator permission required."
        }), 403

    try:
        event_uuid = UUID(event_id)
    except (ValueError, TypeError):
        return jsonify({
            "error": "Invalid event ID."
        }), 400

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Invalid request data."
        }), 400

    new_status = data.get("status")

    allowed_statuses = {"draft", "published", "suspended"}

    if new_status not in allowed_statuses:
        return jsonify({
            "error": "Invalid event status."
        }), 400

    try:
        event = db.session.get(Event, event_uuid)

        if event is None:
            return jsonify({
                "error": "Event not found."
            }), 404

        if new_status == "published":

            if event.starts_at is None:
                return jsonify({
                    "error": "This event has no valid start time."
                }), 400

            now = datetime.now(event.starts_at.tzinfo)

            if event.starts_at <= now:
                return jsonify({
                    "error": "Only future events can be published."
                }), 409

        old_status = event.status

        if old_status == new_status:
            return jsonify({
                "message": "The event already has this status.",
                "id": str(event.id),
                "status": event.status
            }), 200

        event.status = new_status

        db.session.commit()

        return jsonify({
            "message": "Event status updated successfully.",
            "id": str(event.id),
            "old_status": old_status,
            "status": event.status
        }), 200

    except Exception:
        db.session.rollback()

        current_app.logger.exception(
            "Admin event status update failed"
        )

        return jsonify({
            "error": "Unable to update event status."
        }), 500


# -------------------------
# Admin: Registration Management
# -------------------------

@auth_bp.get("/admin/registrations")
def admin_list_registrations():

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    user = get_current_user()

    if not user or user.role != "admin":
        return jsonify({
            "success": False,
            "message": "Admin access required."
        }), 403

    search = request.args.get("q", "").strip()
    status = request.args.get("status", "all").strip().lower()
    event_id = request.args.get("event_id", "").strip()

    allowed_statuses = ["all", "registered", "cancelled"]

    if status not in allowed_statuses:
        return jsonify({
            "success": False,
            "message": "Invalid registration status."
        }), 400

    query = (
        select(Registration, User, Event)
        .join(User, Registration.student_id == User.id)
        .join(Event, Registration.event_id == Event.id)
    )

    if search:
        query = query.where(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                Event.title.ilike(f"%{search}%")
            )
        )

    if status != "all":
        query = query.where(Registration.status == status)

    if event_id:
        try:
            parsed_event_id = UUID(event_id)
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "message": "Invalid event ID."
            }), 400

        query = query.where(Event.id == parsed_event_id)

    query = query.order_by(Registration.registered_at.desc())

    results = db.session.execute(query).all()

    registrations = []

    for registration, student, event in results:
        registrations.append({
            "registration_id": str(registration.id),
            "student_id": str(student.id),
            "student_name": student.full_name,
            "student_email": student.email,
            "event_id": str(event.id),
            "event_title": event.title,
            "event_venue": event.venue,
            "event_starts_at": (
                event.starts_at.isoformat()
                if event.starts_at else None
            ),
            "status": registration.status,
            "registered_at": (
                registration.registered_at.isoformat()
                if registration.registered_at else None
            )
        })

    total = len(registrations)

    active = sum(
        1 for item in registrations
        if item["status"] == "registered"
    )

    cancelled = sum(
        1 for item in registrations
        if item["status"] == "cancelled"
    )

    return jsonify({
        "success": True,
        "registrations": registrations,
        "counts": {
            "total": total,
            "active": active,
            "cancelled": cancelled
        }
    }), 200


# -------------------------
# Authentication
# -------------------------

@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json(silent=True) or {}

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({
            "error": "Email and password are required"
        }), 400

    user = db.session.execute(
        select(User).where(User.email == email.strip().lower())
    ).scalar_one_or_none()

    if user is None or not check_password_hash(
        user.password_hash, password
    ):
        return jsonify({
            "error": "Invalid email or password"
        }), 401

    session.clear()
    session["user_id"] = str(user.id)

    return jsonify({
        "message": "Login successful",
        "user": {
            "id": str(user.id),
            "name": user.full_name,
            "role": user.role,
        },
    }), 200


@auth_bp.route("/register", methods=["POST"])
def register():

    full_name = request.form.get("full_name", "").strip()
    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "")
    confirm_password = request.form.get("confirm_password", "")
    role = request.form.get("role", "").strip().lower()

    if not all([full_name, email, password, confirm_password, role]):
        return render_template(
            "register.html",
            error="Please fill in all fields."
        ), 400

    if len(full_name) > 150:
        return render_template(
            "register.html",
            error="Full name is too long."
        ), 400

    if (
        len(email) > 254
        or "@" not in email
        or "." not in email.rsplit("@", 1)[-1]
    ):
        return render_template(
            "register.html",
            error="Please enter a valid email address."
        ), 400

    if len(password) < 8:
        return render_template(
            "register.html",
            error="Password must contain at least 8 characters."
        ), 400

    if len(password.encode("utf-8")) > 1024:
        return render_template(
            "register.html",
            error="Password is too long."
        ), 400

    if password != confirm_password:
        return render_template(
            "register.html",
            error="Passwords do not match."
        ), 400

    if role not in ("student", "organizer"):
        return render_template(
            "register.html",
            error="Please select a valid account type."
        ), 400

    existing_user = db.session.execute(
        select(User).where(User.email == email)
    ).scalar_one_or_none()

    if existing_user:
        return render_template(
            "register.html",
            error="An account with this email already exists."
        ), 409

    new_user = User(
        full_name=full_name,
        email=email,
        password_hash=generate_password_hash(password),
        role=role,
    )

    try:
        db.session.add(new_user)
        db.session.commit()

    except IntegrityError:
        db.session.rollback()

        return render_template(
            "register.html",
            error="An account with this email already exists."
        ), 409

    except Exception:
        db.session.rollback()
        current_app.logger.exception("User registration failed")

        return render_template(
            "register.html",
            error="Registration failed. Please try again."
        ), 500

    return redirect(url_for("login_page"))


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200


# -------------------------
# List published events
# -------------------------

@events_bp.route("/", methods=["GET"])
def list_events():

    events = db.session.execute(
        select(Event)
        .where(Event.status == "published")
        .order_by(Event.starts_at.asc())
    ).scalars().all()

    return jsonify([
        {
            "id": str(event.id),
            "title": event.title,
            "description": event.description,
            "category": event.category,
            "venue": event.venue,
            "starts_at": event.starts_at.isoformat(),
            "ends_at": event.ends_at.isoformat(),
            "capacity": event.capacity,
            "status": event.status,
        }
        for event in events
    ]), 200


# -------------------------
# Organizer: List Own Events
# -------------------------

@events_bp.route("/mine", methods=["GET"])
def my_events():

    user = get_current_user()

    if user is None:
        return jsonify({
            "error": "Please log in first"
        }), 401

    if user.role != "organizer":
        return jsonify({
            "error": "Organizer permission required"
        }), 403

    events = db.session.execute(
        select(Event)
        .where(Event.organizer_id == user.id)
        .order_by(Event.created_at.desc())
    ).scalars().all()

    return jsonify({
        "total": len(events),
        "events": [
            {
                "id": str(event.id),
                "title": event.title,
                "description": event.description,
                "category": event.category,
                "venue": event.venue,
                "starts_at": event.starts_at.isoformat(),
                "ends_at": event.ends_at.isoformat(),
                "registration_deadline": (
                    event.registration_deadline.isoformat()
                    if event.registration_deadline else None
                ),
                "capacity": event.capacity,
                "status": event.status,
                "created_at": event.created_at.isoformat()
            }
            for event in events
        ]
    }), 200


# -------------------------
# Create a Draft Event
# -------------------------

@events_bp.route("/", methods=["POST"])
def create_event():

    user = get_current_user()

    if user is None:
        return jsonify({
            "error": "Please log in first"
        }), 401

    if user.role not in ("organizer", "admin"):
        return jsonify({
            "error": "Organizer permission required"
        }), 403

    data = request.get_json(silent=True) or {}

    required = ["title", "venue", "starts_at", "ends_at"]

    missing = [
        field for field in required
        if not isinstance(data.get(field), str)
        or not data[field].strip()
    ]

    if missing:
        return jsonify({
            "error": "Missing required fields",
            "fields": missing,
        }), 400

    try:
        starts_at = datetime.fromisoformat(
            data["starts_at"].replace("Z", "+00:00")
        )

        ends_at = datetime.fromisoformat(
            data["ends_at"].replace("Z", "+00:00")
        )

        if starts_at.tzinfo is None or ends_at.tzinfo is None:
            return jsonify({
                "error": "Timestamps must include a timezone"
            }), 400

        # NEW: Reject past event start dates.
        now = datetime.now(starts_at.tzinfo)

        if starts_at <= now:
            return jsonify({
                "error": "Event start date must be in the future."
            }), 400

        if ends_at <= starts_at:
            return jsonify({
                "error": "ends_at must be after starts_at"
            }), 400

        capacity = data.get("capacity")

        if capacity is not None:
            if type(capacity) is not int or capacity <= 0:
                return jsonify({
                    "error": "capacity must be a positive integer"
                }), 400

        description = data.get("description", "")
        category = data.get("category", "General")

        if not isinstance(description, str) or not isinstance(category, str):
            return jsonify({
                "error": "Description and category must be text"
            }), 400

        event = Event(
            organizer_id=user.id,
            title=data["title"].strip(),
            description=description.strip(),
            category=category.strip() or "General",
            venue=data["venue"].strip(),
            starts_at=starts_at,
            ends_at=ends_at,
            capacity=capacity,
            status="draft",
        )

        db.session.add(event)
        db.session.commit()

        return jsonify({
            "message": "Event saved as draft",
            "id": str(event.id),
            "title": event.title,
            "status": event.status,
        }), 201

    except ValueError:
        db.session.rollback()
        return jsonify({
            "error": "Invalid date or event data"
        }), 400

    except Exception:
        db.session.rollback()
        current_app.logger.exception("Event creation failed")
        return jsonify({
            "error": "Unable to create event"
        }), 500


# -------------------------
# Edit an Existing Event
# -------------------------

@events_bp.route("/<event_id>", methods=["PATCH"])
def update_event(event_id):

    user = get_current_user()

    if user is None:
        return jsonify({
            "error": "Please log in first"
        }), 401

    if user.role != "organizer":
        return jsonify({
            "error": "Organizer permission required"
        }), 403

    try:
        event_uuid = UUID(event_id)
    except (ValueError, TypeError):
        return jsonify({
            "error": "Invalid event ID"
        }), 400

    event = db.session.get(Event, event_uuid)

    if event is None:
        return jsonify({
            "error": "Event not found"
        }), 404

    if event.organizer_id != user.id:
        return jsonify({
            "error": "You can only edit your own events"
        }), 403

    # Only draft events can be edited.
    if event.status != "draft":
        return jsonify({
            "error": "Only draft events can be edited"
        }), 409

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Invalid request data"
        }), 400

    required_fields = [
        "title",
        "venue",
        "starts_at",
        "ends_at"
    ]

    missing = [
        field for field in required_fields
        if not isinstance(data.get(field), str)
        or not data[field].strip()
    ]

    if missing:
        return jsonify({
            "error": "Missing required fields",
            "fields": missing
        }), 400

    title = data["title"].strip()
    venue = data["venue"].strip()
    description = data.get("description", "")
    category = data.get("category", "General")

    if len(title) > 200 or len(venue) > 255:
        return jsonify({
            "error": "Title or venue is too long"
        }), 400

    if not isinstance(description, str) or not isinstance(category, str):
        return jsonify({
            "error": "Description and category must be text"
        }), 400

    try:
        starts_at = datetime.fromisoformat(
            data["starts_at"].replace("Z", "+00:00")
        )

        ends_at = datetime.fromisoformat(
            data["ends_at"].replace("Z", "+00:00")
        )

        if starts_at.tzinfo is None or ends_at.tzinfo is None:
            return jsonify({
                "error": "Dates must include timezone information"
            }), 400

        # NEW: Reject past event start dates.
        now = datetime.now(starts_at.tzinfo)

        if starts_at <= now:
            return jsonify({
                "error": "Event start date must be in the future."
            }), 400

        if ends_at <= starts_at:
            return jsonify({
                "error": "End time must be after start time"
            }), 400

        capacity = data.get("capacity")

        if capacity is not None:
            if type(capacity) is not int or capacity <= 0:
                return jsonify({
                    "error": "Capacity must be a positive integer"
                }), 400

        # Update only after all validations pass.
        event.title = title
        event.description = description.strip()
        event.category = category.strip() or "General"
        event.venue = venue
        event.starts_at = starts_at
        event.ends_at = ends_at
        event.capacity = capacity

        db.session.commit()

        return jsonify({
            "message": "Event updated successfully",
            "event": {
                "id": str(event.id),
                "title": event.title,
                "description": event.description,
                "category": event.category,
                "venue": event.venue,
                "starts_at": event.starts_at.isoformat(),
                "ends_at": event.ends_at.isoformat(),
                "capacity": event.capacity,
                "status": event.status
            }
        }), 200

    except ValueError:
        db.session.rollback()
        return jsonify({
            "error": "Invalid date or event data"
        }), 400

    except Exception:
        db.session.rollback()
        current_app.logger.exception("Event update failed")
        return jsonify({
            "error": "Unable to update event"
        }), 500


# -------------------------
# Publish Your Own Event
# -------------------------

@events_bp.route("/<event_id>/publish", methods=["POST"])
def publish_event(event_id):

    user = get_current_user()

    if user is None:
        return jsonify({
            "error": "Please log in first"
        }), 401

    if user.role not in ("organizer", "admin"):
        return jsonify({
            "error": "Organizer permission required"
        }), 403

    try:
        event_uuid = UUID(event_id)
    except (ValueError, TypeError):
        return jsonify({
            "error": "Invalid event ID"
        }), 400

    event = db.session.get(Event, event_uuid)

    if event is None:
        return jsonify({
            "error": "Event not found"
        }), 404

    if user.role != "admin" and event.organizer_id != user.id:
        return jsonify({
            "error": "You can only publish your own events"
        }), 403

    if event.status != "draft":
        return jsonify({
            "error": "Only draft events can be published"
        }), 409

    if event.starts_at is None:
        return jsonify({
            "error": "Event has no valid start time"
        }), 400

    if event.starts_at <= datetime.now(event.starts_at.tzinfo):
        return jsonify({
            "error": "Only future events can be published"
        }), 400

    event.status = "published"

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Event publishing failed")
        return jsonify({
            "error": "Unable to publish event"
        }), 500

    return jsonify({
        "message": "Event published successfully",
        "id": str(event.id),
        "status": event.status,
    }), 200


# -------------------------
# Organizer: View Event Registrations
# -------------------------

@events_bp.route("/<event_id>/registrations", methods=["GET"])
def event_registrations(event_id):

    user = get_current_user()

    if user is None:
        return jsonify({
            "error": "Please log in first"
        }), 401

    if user.role != "organizer":
        return jsonify({
            "error": "Organizer permission required"
        }), 403

    try:
        event_uuid = UUID(event_id)
    except (ValueError, TypeError):
        return jsonify({
            "error": "Invalid event ID"
        }), 400

    event = db.session.get(Event, event_uuid)

    if event is None:
        return jsonify({
            "error": "Event not found"
        }), 404

    if event.organizer_id != user.id:
        return jsonify({
            "error": "You can only view registrations for your own events"
        }), 403

    results = db.session.execute(
        select(Registration, User)
        .join(User, Registration.student_id == User.id)
        .where(Registration.event_id == event.id)
        .order_by(Registration.registered_at.desc())
    ).all()

    registrations = []

    for registration, student in results:
        registrations.append({
            "registration_id": str(registration.id),
            "student_id": str(student.id),
            "student_name": student.full_name,
            "student_email": student.email,
            "status": registration.status,
            "registered_at": (
                registration.registered_at.isoformat()
                if registration.registered_at else None
            )
        })

    active_count = sum(
        1 for registration in registrations
        if registration["status"] == "registered"
    )

    return jsonify({
        "event": {
            "id": str(event.id),
            "title": event.title,
            "status": event.status,
            "capacity": event.capacity
        },
        "total_registrations": len(registrations),
        "active_registrations": active_count,
        "cancelled_registrations": (
            len(registrations) - active_count
        ),
        "registrations": registrations
    }), 200


# -------------------------
# Student Event Registration
# -------------------------

@events_bp.route("/<event_id>/register", methods=["POST"])
def register_for_event(event_id):

    user = get_current_user()

    if user is None:
        return jsonify({
            "error": "Please log in first"
        }), 401

    if user.role != "student":
        return jsonify({
            "error": "Student account required"
        }), 403

    try:
        event_uuid = UUID(event_id)
    except (ValueError, TypeError):
        return jsonify({
            "error": "Invalid event ID"
        }), 400

    event = db.session.get(Event, event_uuid)

    if event is None or event.status != "published":
        return jsonify({
            "error": "Published event not found"
        }), 404

    now = datetime.now(event.starts_at.tzinfo)

    if event.starts_at <= now:
        return jsonify({
            "error": "Registration is closed for this event"
        }), 409

    if (
        event.registration_deadline is not None
        and now >= event.registration_deadline
    ):
        return jsonify({
            "error": "Registration deadline has passed"
        }), 409

    existing = db.session.execute(
        select(Registration).where(
            Registration.event_id == event.id,
            Registration.student_id == user.id,
        )
    ).scalar_one_or_none()

    if existing and existing.status == "registered":
        return jsonify({
            "error": "Already registered for this event"
        }), 409

    if event.capacity is not None:
        registered_count = db.session.execute(
            select(func.count(Registration.id)).where(
                Registration.event_id == event.id,
                Registration.status == "registered",
            )
        ).scalar_one()

        if registered_count >= event.capacity:
            return jsonify({
                "error": "Event is full"
            }), 409

    if existing:
        existing.status = "registered"
    else:
        existing = Registration(
            event_id=event.id,
            student_id=user.id,
            status="registered",
        )
        db.session.add(existing)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "error": "Registration already exists or conflicts with another request"
        }), 409
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Student event registration failed")
        return jsonify({
            "error": "Unable to complete registration"
        }), 500

    return jsonify({
        "message": "Registration successful",
        "registration_id": str(existing.id),
        "event_id": str(event.id),
        "status": existing.status,
    }), 201


# -------------------------
# Cancel a Student Registration
# -------------------------

@events_bp.route("/<event_id>/cancel", methods=["POST"])
def cancel_registration(event_id):

    user = get_current_user()

    if user is None:
        return jsonify({
            "error": "Please log in first"
        }), 401

    if user.role != "student":
        return jsonify({
            "error": "Student account required"
        }), 403

    try:
        event_uuid = UUID(event_id)
    except (ValueError, TypeError):
        return jsonify({
            "error": "Invalid event ID"
        }), 400

    registration = db.session.execute(
        select(Registration).where(
            Registration.event_id == event_uuid,
            Registration.student_id == user.id,
            Registration.status == "registered",
        )
    ).scalar_one_or_none()

    if registration is None:
        return jsonify({
            "error": "Active registration not found"
        }), 404

    registration.status = "cancelled"

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Registration cancellation failed")
        return jsonify({
            "error": "Unable to cancel registration"
        }), 500

    return jsonify({
        "message": "Registration cancelled",
        "registration_id": str(registration.id),
        "status": registration.status,
    }), 200


# -------------------------
# Student Dashboard: My Registrations
# -------------------------

@events_bp.route("/my-registrations", methods=["GET"])
def my_registrations():

    user = get_current_user()

    if user is None:
        return jsonify({
            "error": "Please log in first"
        }), 401

    if user.role != "student":
        return jsonify({
            "error": "Student account required"
        }), 403

    results = db.session.execute(
        select(Registration, Event)
        .join(Event, Registration.event_id == Event.id)
        .where(Registration.student_id == user.id)
        .order_by(Event.starts_at.asc())
    ).all()

    registrations = []

    for registration, event in results:
        registrations.append({
            "registration_id": str(registration.id),
            "registration_status": registration.status,
            "registered_at": (
                registration.registered_at.isoformat()
                if registration.registered_at else None
            ),
            "event": {
                "id": str(event.id),
                "title": event.title,
                "description": event.description,
                "category": event.category,
                "venue": event.venue,
                "starts_at": (
                    event.starts_at.isoformat()
                    if event.starts_at else None
                ),
                "ends_at": (
                    event.ends_at.isoformat()
                    if event.ends_at else None
                ),
                "status": event.status,
            },
        })

    return jsonify({
        "student": {
            "id": str(user.id),
            "name": user.full_name,
        },
        "total": len(registrations),
        "registrations": registrations,
    }), 200
