from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

# --------- User Schemas ---------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr

    class Config:
        from_attributes = True   # ✅ for SQLAlchemy -> Pydantic


# --------- Auth Schemas ---------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    email: Optional[str] = None


# --------- Interaction / Chat History ---------
class InteractionCreate(BaseModel):
    type: str   # "qa" or "summary"
    query: Optional[str]
    answer: Optional[str]
    sources: Optional[str] = None

class InteractionResponse(BaseModel):
    id: int
    type: str
    query: Optional[str]
    answer: Optional[str]
    sources: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
