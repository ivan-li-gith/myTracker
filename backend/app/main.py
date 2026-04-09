from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.auth import verify_credentials
from app.routers import tasks, habits, payments, categories, expenses, expense_splits

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", dependencies=[Depends(verify_credentials)])
def get_health():
    return {"status": "ok"}

app.include_router(tasks.router, dependencies=[Depends(verify_credentials)])
app.include_router(habits.router, dependencies=[Depends(verify_credentials)])
app.include_router(payments.router, dependencies=[Depends(verify_credentials)])
app.include_router(categories.router, dependencies=[Depends(verify_credentials)])
app.include_router(expenses.router, dependencies=[Depends(verify_credentials)])
app.include_router(expense_splits.router, dependencies=[Depends(verify_credentials)])