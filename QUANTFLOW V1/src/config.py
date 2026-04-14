"""
Configuration file for AI Trading Signal Intelligence

Update these values with your specific setup
"""

import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
SESSIONS_DIR = BASE_DIR / "sessions"

# Google Sheets Configuration
SPREADSHEET_ID = "1aW3iNaFV_VKG5JwhXfOrPHZnT9Ag1jGnvLw6-Xe8osg"
CREDENTIALS_FILE = str(DATA_DIR / "credentials.json")
INPUT_DIR = str(DATA_DIR / "input")
OUTPUT_DIR = str(DATA_DIR / "output")

# Sheet Names
SHEET_NAMES = {
    'accept': 'ACCEPT_SIGNALS',
    'review': 'REVIEW_QUEUE', 
    'reject': 'REJECT_LOG',
    'stats': 'STATS'
}

# Telegram Configuration
API_ID = "38456630"
API_HASH = "4b2a85354b6e6d4103820dc92b522b53"
PHONE = "+212688434773"
SESSION_FILE = str(SESSIONS_DIR / "telegram_session.session")
