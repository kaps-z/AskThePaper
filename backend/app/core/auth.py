"""
Auth — Simple Basic Authentication for the Admin Panel.

In a production app, you would use JWTs or sessions and store hashed
passwords in a database. For this MVP, we use FastAPI's built-in
HTTPBasic to validate against the credentials in our .env file.
"""

import secrets
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.core.config import settings

# This tells FastAPI to look for an Authorization header of type "Basic"
security = HTTPBasic()


def verify_admin(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    """
    Dependency that checks the username and password against our settings.
    
    We use `secrets.compare_digest` instead of `==` to prevent
    timing attacks (where an attacker guesses the password by
    measuring how long the comparison takes).
    """
    is_correct_username = secrets.compare_digest(
        credentials.username.encode("utf8"),
        settings.ADMIN_USERNAME.encode("utf8")
    )
    is_correct_password = secrets.compare_digest(
        credentials.password.encode("utf8"),
        settings.ADMIN_PASSWORD.encode("utf8")
    )

    if not (is_correct_username and is_correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username
