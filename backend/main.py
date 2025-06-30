import logging
import sys
from pathlib import Path
from fastapi import FastAPI, Depends, Request, HTTPException, status, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional, Dict, Any
import uvicorn
import os
import json
import logging
import time
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

# Add the parent directory to the Python path
sys.path.append(str(Path(__file__).parent))

# Configure logging
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / 'app.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)
logger.info("Application starting...")

# Import database and models first to ensure all models are registered
from database import engine, SessionLocal, init_db
from models import Base, User  # Import Base and User from models

# Import routers
from auth.auth import router as auth_router
from auth.dependencies import get_current_user
from contacts.routes import router as contacts_router
from export.export import router as export_router
from targets.routes import router as targets_router
from users.routes import router as users_router
from messages.routes import router as messages_router
from groups.routes import router as groups_router
from sent_messages.routes import router as sent_messages_router
from identification.routes import router as identification_router
from shared_contacts.routes import router as shared_contacts_router

# Load environment variables
load_dotenv()

# Initialize the database (create tables, etc.)
init_db()

app = FastAPI(
    title="RightImpact API",
    description="API for RightImpact",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
    # Ensure consistent handling of trailing slashes
    redirect_slashes=True
)

# Update allowed origins to include frontend development server
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.86.37:3000",
    "http://localhost:8000",
]

# Debug CORS configuration
print("\n=== CORS MIDDLEWARE CONFIGURATION ===")
print(f"Allowed origins: {ALLOWED_ORIGINS}")

# Enable CORS for all routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Debug: Log all registered routes before adding new ones
print("\n=== BEFORE ADDING ROUTES ===")
for route in app.routes:
    print(f"Route: {route.path} - Methods: {getattr(route, 'methods', 'N/A')}")

# Include routers with proper API versioning
app.include_router(auth_router, tags=["auth"])
app.include_router(contacts_router, prefix="/api/contacts", tags=["contacts"])
app.include_router(targets_router, prefix="/api/targets", tags=["targets"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
# Include message templates router with /api prefix to match frontend expectations
app.include_router(messages_router, prefix="/api/message-templates", tags=["message-templates"])

# Register identification router
app.include_router(identification_router)

# Register sent messages router
app.include_router(sent_messages_router, prefix="/api/sent_messages", tags=["sent-messages"])

# Debug: Log before adding groups router
print("\n=== ADDING GROUPS ROUTER ===")
app.include_router(
    groups_router,
    prefix="/api/groups",
    tags=["groups"]
)

app.include_router(shared_contacts_router)

# Debug: Log all registered routes after adding all routes
print("\n=== ALL REGISTERED ROUTES ===")
for route in app.routes:
    methods = getattr(route, 'methods', None)
    if hasattr(route, 'endpoint'):
        print(f"Route: {route.path} - Methods: {methods} - Endpoint: {route.endpoint.__name__ if route.endpoint else 'N/A'}")
    else:
        print(f"Route: {route.path} - Methods: {methods}")

# Debug: Print CORS configuration
print("\n=== CORS CONFIGURATION ===")
print(f"Allowed Origins: {ALLOWED_ORIGINS}")
print("Allowed Methods: ['*']")
print("Allowed Headers: ['*']")

# Configure OAuth2 for Swagger UI
app.openapi_schema = None  # Clear the schema cache

# Add security scheme

# Update OpenAPI schema
from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="Campaign Messaging App API",
        version="1.0.0",
        description="Backend API for RightImpact",
        routes=app.routes,
    )
    
    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "OAuth2PasswordBearer": {
            "type": "oauth2",
            "flows": {
                "password": {
                    "tokenUrl": "/auth/token",
                    "scopes": {}
                }
            }
        }
    }
    
    # Add security to all endpoints
    for path in openapi_schema["paths"].values():
        for method in path.values():
            if "security" not in method:
                method["security"] = [{"OAuth2PasswordBearer": []}]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

@app.get("/")
async def root():
    return {"message": "Welcome to the Campaign Messaging App API. Visit /docs for API documentation."}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    return {"message": "This is a protected route", "user": current_user.email}
