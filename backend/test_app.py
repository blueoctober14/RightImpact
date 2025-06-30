from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class User(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str

@app.post("/register")
async def register(user: User):
    return {"message": "User registered successfully", "user": user.dict()}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
