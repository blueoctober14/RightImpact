import logging

# Set up logging
logger = logging.getLogger(__name__)
logger.debug("Initializing targets module")

# Import submodules
from . import schemas
from . import crud
from . import routes

__all__ = ["schemas", "crud", "routes"]
