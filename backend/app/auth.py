import secrets
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from app.config import settings

security = HTTPBasic()

def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)):
    """
    Verifies the username and password w/ env vars

    If valid returns the username to the route else triggers login prompt or 401 unauthorized
    """
    
    is_username_correct = secrets.compare_digest(credentials.username, settings.API_USER)
    is_password_correct = secrets.compare_digest(credentials.password, settings.API_PASS)

    if not (is_username_correct and is_password_correct):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Basic"}
        )
    
    return credentials.username