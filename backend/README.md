# Campaign Messaging App Backend

This is the backend API for the Campaign Messaging App, which allows users to send text messages on behalf of a political campaign.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create and activate a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Set up environment variables:
- Copy `.env.example` to `.env`
- Update the values in `.env` with your configuration

4. Run the database migrations:
```bash
alembic upgrade head
```

5. Start the development server:
```bash
uvicorn main:app --reload
```

## API Endpoints

### Authentication
- POST `/token` - Get JWT token
- POST `/users/register` - Register new user
- POST `/users/login` - Login existing user

### Users
- GET `/users/me` - Get current user info
- GET `/users` - List all users (admin only)
- GET `/users/{user_id}` - Get specific user info

### Contacts
- POST `/contacts/share` - Share contacts
- GET `/contacts/matches` - Get matched contacts
- GET `/contacts/neighbors` - Get neighbor contacts

### Messages
- POST `/messages/send` - Send message
- GET `/messages/templates` - Get message templates
- POST `/messages/templates` - Create new message template

### Admin
- POST `/admin/upload` - Upload campaign contacts CSV
- GET `/admin/stats` - Get campaign statistics

## Database Schema

The database uses SQLAlchemy ORM and includes tables for:
- Users
- Shared Contacts
- Campaign Contacts
- Messages
- Message Templates
- User-Template Associations

## Security

- JWT-based authentication
- Password hashing using bcrypt
- Rate limiting for sensitive endpoints
- Input validation
- CORS configuration

## Development

The project uses FastAPI with SQLAlchemy for the backend. For frontend development, refer to the React Native project in the root directory.
