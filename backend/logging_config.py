import logging
import sys
from pathlib import Path

# Create logs directory if it doesn't exist
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

# Configure root logger
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / 'app.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

# Set SQLAlchemy logging
sqlalchemy_logger = logging.getLogger('sqlalchemy.engine')
# Reduce SQLAlchemy logging to WARNING to improve performance
sqlalchemy_logger.setLevel(logging.WARNING)

# Set our app's logging level
app_logger = logging.getLogger('matching')
app_logger.setLevel(logging.DEBUG)
