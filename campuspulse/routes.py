
from datetime import datetime
from uuid import UUID

from flask import Blueprint, jsonify, request, session
from sqlalchemy import select
from werkzeug.security import check_password_hash

from . import db
from .models import Event, User

events_bp = Blueprint("events", __name__, url_prefix="/api/events")
auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


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
            "status": event.status,
        }
        for event in events
    ]), 200


@events_bp.route("/", methods=["POST"])
def create_event():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Please log in first"}), 401

    try:
        user = db.session.get(User, UUID(user_id))
    except (ValueError, TypeError):
        session.clear()
        return jsonify({"error": "Invalid session"}), 401

    if user is None:
        session.clear()
        return jsonify({"error": "User account not found"}), 401

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

        event = Event(
            organizer_id=user.id,
            title=data["title"].strip(),
            description=data.get("description", ""),
            category=data.get("category", "General"),
            venue=data["venue"].strip(),
            starts_at=starts_at,
            ends_at=ends_at,
            capacity=capacity,
            status="draft",
        )

        db.session.add(event)
        db.session.commit()

        return jsonify({
            "message": "Event saved",
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
