
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

    # =====================================
    # Session Cookie Security
    # =====================================

    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=False,  # Local HTTP development only
    )

    # =====================================
    # Validate Environment Variables
    # =====================================

    if not app.config["SECRET_KEY"]:
        raise RuntimeError(
            "SECRET_KEY is missing from .env"
        )

    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        raise RuntimeError(
            "DATABASE_URL is missing from .env"
        )

    # =====================================
    # Initialize Database
    # =====================================

    db.init_app(app)

    # =====================================
    # Register Blueprints
    # =====================================

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

    # =====================================
    # Custom 404 Error Page
    # =====================================

    @app.errorhandler(404)
    def page_not_found(error):

        return render_template("404.html"), 404

    # =====================================
    # Custom 403 Error Page
    # =====================================

    @app.errorhandler(403)
    def forbidden(error):

        return render_template("403.html"), 403

    # =====================================
    # Custom 500 Error Page
    # =====================================

    @app.errorhandler(500)
    def internal_server_error(error):

        db.session.rollback()

        app.logger.exception(
            "Internal server error"
        )

        return render_template("500.html"), 500

    return app
