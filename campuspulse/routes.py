
from datetime import datetime
from uuid import UUID

from flask import Blueprint, jsonify, request, session
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash

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
# Authentication
# -------------------------

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email and password are required"}), 400

    user = db.session.execute(
        select(User).where(User.email == email.strip().lower())
    ).scalar_one_or_none()

    if user is None or not check_password_hash(
        user.password_hash, password
    ):
        return jsonify({"error": "Invalid email or password"}), 401

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
# Create a draft event
# -------------------------

@events_bp.route("/", methods=["POST"])
def create_event():
    user = get_current_user()

    if user is None:
        return jsonify({"error": "Please log in first"}), 401

    if user.role not in ("organizer", "admin"):
        return jsonify({"error": "Organizer permission required"}), 403

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
        return jsonify({"error": "Invalid date or event data"}), 400

    except Exception:
        db.session.rollback()
        raise


# -------------------------
# Publish your own event
# -------------------------

@events_bp.route("/<event_id>/publish", methods=["POST"])
def publish_event(event_id):
    user = get_current_user()

    if user is None:
        return jsonify({"error": "Please log in first"}), 401

    if user.role not in ("organizer", "admin"):
        return jsonify({"error": "Organizer permission required"}), 403

    try:
        event_uuid = UUID(event_id)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid event ID"}), 400

    event = db.session.get(Event, event_uuid)

    if event is None:
        return jsonify({"error": "Event not found"}), 404

    if user.role != "admin" and event.organizer_id != user.id:
        return jsonify({
            "error": "You can only publish your own events"
        }), 403

    if event.status != "draft":
        return jsonify({
            "error": "Only draft events can be published"
        }), 409

    if event.starts_at <= datetime.now(event.starts_at.tzinfo):
        return jsonify({
            "error": "Only future events can be published"
        }), 400

    event.status = "published"

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return jsonify({
        "message": "Event published successfully",
        "id": str(event.id),
        "status": event.status,
    }), 200


# -------------------------
# Student event registration
# -------------------------

@events_bp.route("/<event_id>/register", methods=["POST"])
def register_for_event(event_id):
    user = get_current_user()

    if user is None:
        return jsonify({"error": "Please log in first"}), 401

    if user.role != "student":
        return jsonify({"error": "Student account required"}), 403

    try:
        event_uuid = UUID(event_id)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid event ID"}), 400

    event = db.session.get(Event, event_uuid)

    if event is None or event.status != "published":
        return jsonify({"error": "Published event not found"}), 404

    now = datetime.now(event.starts_at.tzinfo)

    if event.starts_at <= now:
        return jsonify({"error": "Registration is closed for this event"}), 409

    if (
        event.registration_deadline is not None
        and now >= event.registration_deadline
    ):
        return jsonify({"error": "Registration deadline has passed"}), 409

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
            return jsonify({"error": "Event is full"}), 409

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
        raise

    return jsonify({
        "message": "Registration successful",
        "registration_id": str(existing.id),
        "event_id": str(event.id),
        "status": existing.status,
    }), 201


# -------------------------
# Cancel a student registration
# -------------------------

@events_bp.route("/<event_id>/cancel", methods=["POST"])
def cancel_registration(event_id):
    user = get_current_user()

    if user is None:
        return jsonify({"error": "Please log in first"}), 401

    if user.role != "student":
        return jsonify({"error": "Student account required"}), 403

    try:
        event_uuid = UUID(event_id)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid event ID"}), 400

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
        raise

    return jsonify({
        "message": "Registration cancelled",
        "registration_id": str(registration.id),
        "status": registration.status,
    }), 200

# -------------------------
# Student dashboard: my registrations
# -------------------------

@events_bp.route("/my-registrations", methods=["GET"])
def my_registrations():
    user = get_current_user()

    if user is None:
        return jsonify({"error": "Please log in first"}), 401

    if user.role != "student":
        return jsonify({"error": "Student account required"}), 403

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
            "registered_at": registration.registered_at.isoformat(),
            "event": {
                "id": str(event.id),
                "title": event.title,
                "description": event.description,
                "category": event.category,
                "venue": event.venue,
                "starts_at": event.starts_at.isoformat(),
                "ends_at": event.ends_at.isoformat(),
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
