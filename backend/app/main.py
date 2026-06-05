from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.auth import verify_credentials
from app.routers import tasks, habits, payments, categories, expenses, expense_splits, jobs, resumes, scan, credit_cards, recurring_charges, money_transfers, banks, people, utility_bills, loans, credit_card_reminders, stocks, reminder_owners, work_log

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
app.include_router(jobs.router, dependencies=[Depends(verify_credentials)])
app.include_router(resumes.router, dependencies=[Depends(verify_credentials)])
app.include_router(scan.router, dependencies=[Depends(verify_credentials)])
app.include_router(credit_cards.router, dependencies=[Depends(verify_credentials)])
app.include_router(recurring_charges.router, dependencies=[Depends(verify_credentials)])
app.include_router(money_transfers.router, dependencies=[Depends(verify_credentials)])
app.include_router(banks.router, dependencies=[Depends(verify_credentials)])
app.include_router(people.router, dependencies=[Depends(verify_credentials)])
app.include_router(utility_bills.router, dependencies=[Depends(verify_credentials)])
app.include_router(loans.router, dependencies=[Depends(verify_credentials)])
app.include_router(credit_card_reminders.router, dependencies=[Depends(verify_credentials)])
app.include_router(stocks.router, dependencies=[Depends(verify_credentials)])
app.include_router(reminder_owners.router, dependencies=[Depends(verify_credentials)])
app.include_router(work_log.router, dependencies=[Depends(verify_credentials)])