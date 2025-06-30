from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import QueuePool
import os
import time
import logging
from dotenv import load_dotenv
from contextlib import contextmanager

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get the absolute path to the project root
current_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(current_dir, "campaign.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path}"

# Database configuration from environment variables
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "20"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "10"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))  # 30 minutes

# Only log SQL if explicitly enabled
echo = os.getenv("SQL_ECHO", "false").lower() == "true"

# Create engine with optimized connection pooling
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=QueuePool,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_timeout=DB_POOL_TIMEOUT,
    pool_recycle=DB_POOL_RECYCLE,
    pool_pre_ping=True,  # Verify connections before using them
    echo=echo  # Only log SQL if explicitly enabled
)

# Create session factory with thread safety
SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))

# Add performance monitoring to database connections
@event.listens_for(engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    if not hasattr(conn, "query_start_time"):
        conn.query_start_time = {}
    conn.query_start_time[cursor] = time.time()

@event.listens_for(engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    if hasattr(conn, "query_start_time") and cursor in conn.query_start_time:
        total_time = time.time() - conn.query_start_time[cursor]
        # Log slow queries (>100ms)
        if total_time > 0.1:
            logger.warning(f"SLOW QUERY: {total_time:.2f}s - {statement[:100]}...")
        del conn.query_start_time[cursor]

def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

@contextmanager
def get_db_context():
    """Context manager for getting database session"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        logger.error(f"Database error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def init_db():
    """Initialize the database by creating all tables."""
    # Import models to ensure they are registered with SQLAlchemy
    from models import Base
    
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully")
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully")
    except Exception as e:
        print(f"Error initializing database: {e}")
        import traceback
        traceback.print_exc()
        raise
