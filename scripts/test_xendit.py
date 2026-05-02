import os
import sys
import base64
import argparse
import requests
from dotenv import load_dotenv

load_dotenv(".env.local")

XENDIT_SECRET_KEY = os.getenv("XENDIT_SECRET_KEY")
if not XENDIT_SECRET_KEY:
    print("Error: XENDIT_SECRET_KEY tidak ditemukan di .env.local")
    sys.exit(1)

auth = base64.b64encode(f"{XENDIT_SECRET_KEY}:".encode()).decode()
headers = {
    "Authorization": f"Basic {auth}",
    "Content-Type": "application/json"
}

def simulate_va(bank_code, account_number, amount):
    url = "https://api.xendit.co/pool_virtual_accounts/simulate_payment"
    payload = {
        "bank_code": bank_code,
        "bank_account_number": account_number,
        "transfer_amount": amount
    }
    print(f"\n[Xendit] Mensimulasikan pembayaran transfer ke {bank_code} {account_number} sejumlah Rp {amount}...")
    res = requests.post(url, json=payload, headers=headers)
    
    if res.status_code == 200:
        print("[Xendit] ✅ Pembayaran berhasil disimulasikan! Webhook pembayaran (SUCCESS) sedang dikirim ke server Anda...")
    else:
        print(f"[Xendit] ❌ Gagal: {res.status_code} - {res.text}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FireCamp Xendit Simulator")
    parser.add_argument("--va", help="Simulate VA. Format: <BankCode> <AccountNumber> <Amount>", nargs=3)
    args = parser.parse_args()

    if args.va:
        simulate_va(args.va[0].upper(), args.va[1], int(args.va[2]))
    else:
        parser.print_help()
