#!/usr/bin/env python3
"""
Clear Google Sheets tabs but keep headers
"""

import sys
try:
    import gspread
    from google.oauth2.service_account import Credentials
    from config import CREDENTIALS_FILE, SPREADSHEET_ID
except ImportError as e:
    print(f"Missing dependencies: {e}")
    sys.exit(1)

def clear_keep_headers():
    """Clear sheets but keep headers"""
    try:
        print("Clearing Google Sheets tabs (keeping headers)...")
        
        # Authenticate
        scopes = ['https://www.googleapis.com/auth/spreadsheets']
        creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=scopes)
        client = gspread.authorize(creds)
        
        # Open spreadsheet
        spreadsheet = client.open_by_key(SPREADSHEET_ID)
        print(f"Opened spreadsheet: {spreadsheet.title}")
        
        # Define headers for each sheet
        sheet_headers = {
            'ACCEPT_SIGNALS': ['signal_id', 'message_id', 'timestamp', 'source_channel', 'action', 'instrument', 'entry_price', 'stop_loss', 'take_profit', 'confidence_score', 'message_type', 'processing_status'],
            'REVIEW_QUEUE': ['review_id', 'message_id', 'timestamp', 'source_channel', 'raw_message', 'issue_type', 'missing_fields', 'confidence_score', 'review_status'],
            'REJECT_LOG': ['reject_id', 'message_id', 'timestamp', 'source_channel', 'raw_message', 'rejection_reason', 'confidence_score'],
            'STATS': ['metric', 'value', 'timestamp', 'notes']
        }
        
        for sheet_name, headers in sheet_headers.items():
            try:
                worksheet = spreadsheet.worksheet(sheet_name)
                
                # Clear all data first
                worksheet.clear()
                
                # Add headers back
                worksheet.update('A1', [headers])
                
                print(f"  Cleared and restored headers for {sheet_name}")
                
            except gspread.exceptions.WorksheetNotFound:
                print(f"  Worksheet {sheet_name} not found, creating it with headers...")
                worksheet = spreadsheet.add_worksheet(title=sheet_name, rows="100", cols="20")
                worksheet.update('A1', [headers])
                print(f"  Created {sheet_name} with headers")
            except Exception as e:
                print(f"  Error with {sheet_name}: {e}")
        
        print("Clearing with headers completed!")
        
    except Exception as e:
        print(f"Error clearing with headers: {e}")
        sys.exit(1)

if __name__ == '__main__':
    clear_keep_headers()
