
import os

from dotenv import load_dotenv
from flask import Flask, app
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

load_dotenv(override=True)

db = SQLAlchemy()



def create_app():
    app = Flask(__name__)

    # Load the project's .env file before reading configuration.
    load_dotenv(override=True)

    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    if not app.config["SECRET_KEY"]:
        raise RuntimeError("SECRET_KEY is missing from .env")

    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        raise RuntimeError("DATABASE_URL is missing from .env")

    db.init_app(app)
    from .routes import auth_bp, events_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(events_bp)

    @app.route("/")
    def home():
        from flask import render_template
        return render_template("index.html")

    @app.route("/health/db")
    def database_health():
        try:
            db.session.execute(text("SELECT 1"))
            return {"database": "connected"}, 200
        except Exception:
            app.logger.exception("Database health check failed")
            db.session.rollback()
            return {"database": "unavailable"}, 503

    return app

