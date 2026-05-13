# backend/log_config.py
import logging
import logging.config
from pathlib import Path

LOG_FILE = Path("logs/app.log")
LOG_FILE.parent.mkdir(exist_ok=True)  # create logs folder if missing

def setup_logging():
    """Configure logging for the whole project."""
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
                "level": "INFO",
            },
            "file": {
                "class": "logging.FileHandler",
                "formatter": "default",
                "filename": LOG_FILE,
                "level": "DEBUG",
            },
        },
        "root": {
            "handlers": ["console", "file"],
            "level": "DEBUG",
        },
    }

    logging.config.dictConfig(logging_config)


# ✅ run setup on import
setup_logging()

# ✅ expose a shared logger for imports
logger = logging.getLogger("SmartDocAssistant")
