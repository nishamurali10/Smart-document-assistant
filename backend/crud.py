from sqlalchemy.orm import Session
from backend import models, schemas

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate, hashed_password: str):
    db_user = models.User(email=user.email, name=user.name, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def save_refresh_token(db: Session, user_id: int, token: str):
    db_token = models.RefreshToken(user_id=user_id, token=token)
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token

def get_refresh_token(db: Session, token: str):
    return db.query(models.RefreshToken).filter(models.RefreshToken.token == token).first()

def delete_refresh_token(db: Session, token: str):
    db_token = get_refresh_token(db, token)
    if db_token:
        db.delete(db_token)
        db.commit()
        return True
    return False
