from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship
from backend.db.database import Base

# --------- User Model ---------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)

    # Relationship to interactions
    interactions = relationship("Interaction", back_populates="user", cascade="all, delete-orphan")


# --------- Interaction (Chat History) ---------
class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    type = Column(String, nullable=False)   # "qa" or "summary"
    query = Column(Text, nullable=True)     # question or summarization request
    answer = Column(Text, nullable=True)    # response text
    sources = Column(Text, nullable=True)   # optional, for QA
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Link to user
    user = relationship("User", back_populates="interactions")
