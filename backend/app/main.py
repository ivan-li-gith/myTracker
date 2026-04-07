from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.auth import verify_credentials

app = FastAPI()

# configures what sites can do what
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", dependencies=[Depends(verify_credentials)])
def get_health():
    return {"status": "ok"}

# from app.routers import tasks, habits
# app.include_router(tasks.router, dependencies=[Depends(verify_credentials)])
# app.include_router(habits.router, dependencies=[Depends(verify_credentials)])