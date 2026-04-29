from __future__ import annotations

import logging

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Validates the Supabase JWT token against Supabase /auth/v1/user endpoint.
    Returns the user_id (UUID string) if valid.
    Raises 401 Unauthorized if invalid.
    """
    token = credentials.credentials
    base_url = settings.NEXT_PUBLIC_SUPABASE_URL.rstrip("/")
    url = f"{base_url}/auth/v1/user"

    headers = {
        "apikey": settings.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}"
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=headers)
            
            if resp.status_code != 200:
                logger.warning(f"[auth] Token invalid: HTTP {resp.status_code}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            data = resp.json()
            user_id = data.get("id")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User ID not found in token response",
                    headers={"WWW-Authenticate": "Bearer"},
                )
                
            return user_id

    except httpx.RequestError as exc:
        logger.error(f"[auth] Supabase request error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to communicate with auth server",
        )
