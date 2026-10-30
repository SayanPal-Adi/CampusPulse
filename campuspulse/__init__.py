
import os
from uuid import UUID

from dotenv import load_dotenv
from flask import (
    Flask,
    abort,
    redirect,
    render_template,
    session,
    url_for,
)
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text


# Load environment variables
load_dotenv(override=True)


# Initialize SQLAlchemy
db = SQLAlchemy()


# =====================================
# Authentication Helper
# =====================================

def get_logged_in_user():

    # Import locally to prevent circular imports
    from .models import User

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


# =====================================
# Application Factory
# =====================================

def create_app():

    app = Flask(__name__)

    load_dotenv(override=True)

    # Application configuration
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")

    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL"
    )

    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Validate environment variables
    if not app.config["SECRET_KEY"]:
        raise RuntimeError(
            "SECRET_KEY is missing from .env"
        )

    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        raise RuntimeError(
            "DATABASE_URL is missing from .env"
        )

    # Initialize database
    db.init_app(app)

    # Register blueprints
    from .routes import auth_bp, events_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(events_bp)

    # =====================================
    # Home Page
    # =====================================

    @app.route("/")
    def home():

        return render_template("index.html")

    # =====================================
    # Database Health Check
    # =====================================

    @app.route("/health/db")
    def database_health():

        try:
            db.session.execute(text("SELECT 1"))

            return {
                "database": "connected"
            }, 200

        except Exception:

            app.logger.exception(
                "Database health check failed"
            )

            db.session.rollback()

            return {
                "database": "unavailable"
            }, 503

    # =====================================
    # Student Dashboard
    # =====================================

    @app.route("/student-dashboard")
    def student_dashboard():

        user = get_logged_in_user()

        if user is None:
            return redirect(
                url_for("login_page")
            )

        if user.role != "student":
            abort(403)

        return render_template(
            "student_dashboard.html",
            user=user
        )

    # =====================================
    # Organizer Dashboard
    # =====================================

    @app.route("/organizer-dashboard")
    def organizer_dashboard():

        user = get_logged_in_user()

        if user is None:
            return redirect(
                url_for("login_page")
            )

        if user.role != "organizer":
            abort(403)

        return render_template(
            "organizer_dashboard.html",
            user=user
        )

    # =====================================
    # Admin Dashboard
    # =====================================

    @app.route("/admin-dashboard")
    def admin_dashboard():

        user = get_logged_in_user()

        if user is None:
            return redirect(
                url_for("login_page")
            )

        if user.role != "admin":
            abort(403)

        return render_template(
            "admin_dashboard.html",
            user=user
        )

    # =====================================
    # Login Page
    # =====================================

    @app.route("/login")
    def login_page():

        return render_template("login.html")

    # =====================================
    # Registration Page
    # =====================================

    @app.route("/register")
    def register_page():

        return render_template("register.html")

    return app
