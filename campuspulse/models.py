
import uuid

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID

from . import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    full_name = db.Column(db.Text, nullable=False)
    email = db.Column(db.Text, nullable=False, unique=True)
    password_hash = db.Column(db.Text, nullable=False)
    role = db.Column(
        db.Text,
        nullable=False,
        server_default=text("'student'"),
    )
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    events = db.relationship("Event", back_populates="organizer")
    registrations = db.relationship(
        "Registration",
        back_populates="student",
    )


class Event(db.Model):
    __tablename__ = "events"

    id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    organizer_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey("users.id"),
        nullable=False,
    )
    title = db.Column(db.Text, nullable=False)
    description = db.Column(
        db.Text,
        nullable=False,
        server_default=text("''"),
    )
    category = db.Column(
        db.Text,
        nullable=False,
        server_default=text("'General'"),
    )
    venue = db.Column(db.Text, nullable=False)
    starts_at = db.Column(db.DateTime(timezone=True), nullable=False)
    ends_at = db.Column(db.DateTime(timezone=True), nullable=False)
    registration_deadline = db.Column(db.DateTime(timezone=True))
    capacity = db.Column(db.Integer)
    poster_url = db.Column(db.Text)
    status = db.Column(
        db.Text,
        nullable=False,
        server_default=text("'published'"),
    )
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    organizer = db.relationship("User", back_populates="events")
    registrations = db.relationship(
        "Registration",
        back_populates="event",
    )


class Registration(db.Model):
    __tablename__ = "registrations"

    id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    event_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey("events.id"),
        nullable=False,
    )
    student_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey("users.id"),
        nullable=False,
    )
    status = db.Column(
        db.Text,
        nullable=False,
        server_default=text("'registered'"),
    )
    registered_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    event = db.relationship("Event", back_populates="registrations")
    student = db.relationship("User", back_populates="registrations")
