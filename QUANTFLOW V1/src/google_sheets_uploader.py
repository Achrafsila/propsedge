#!/usr/bin/env python3
"""
Google Sheets Integration for Trading Signal Processing Results

Uploads batch processing results to Google Sheets with 4 separate sheets:
- ACCEPT_SIGNALS: Valid trading signals
- REVIEW_QUEUE: Signals needing manual review  
- REJECT_LOG: Rejected messages with reasons
- STATS: Processing metrics and summary

Usage: python google_sheets_uploader.py [--spreadsheet-id YOUR_SPREADSHEET_ID]
"""

import csv
import argparse
from pathlib import Path
from typing import List, Dict, Any
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime

# Import configuration
try:
    from config import SPREADSHEET_ID, CREDENTIALS_FILE, DATA_DIR, SHEET_NAMES
except ImportError:
    # Fallback defaults if config.py doesn't exist
    SPREADSHEET_ID = ""
    CREDENTIALS_FILE = "data/credentials.json"
    DATA_DIR = "data"
    SHEET_NAMES = {
        'accept': 'ACCEPT_SIGNALS',
        'review': 'REVIEW_QUEUE', 
        'reject': 'REJECT_LOG',
        'stats': 'STATS'
    }

class GoogleSheetsUploader:
    """Handles uploading batch processing results to Google Sheets"""
    
    def __init__(self, credentials_path: str = 'credentials.json'):
        """
        Initialize Google Sheets connection
        
        Args:
            credentials_path: Path to Google Service Account credentials file
        """
        self.credentials_path = credentials_path
        self.gc = None
        self.spreadsheet = None
        
    def authenticate(self) -> bool:
        """
        Authenticate with Google Sheets API
        
        Returns:
            bool: True if authentication successful
        """
        try:
            # Define the scope
            scopes = [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]
            
            # Load credentials
            creds = Credentials.from_service_account_file(
                self.credentials_path, scopes=scopes
            )
            
            # Authenticate with gspread
            self.gc = gspread.authorize(creds)
            
            print("✅ Google Sheets authentication successful")
            return True
            
        except Exception as e:
            print(f"❌ Authentication failed: {e}")
            print("Please check your credentials.json file and Google Sheets API access")
            return False
    
    def open_spreadsheet(self, spreadsheet_id: str) -> bool:
        """
        Open or create spreadsheet
        
        Args:
            spreadsheet_id: Google Sheets spreadsheet ID
            
        Returns:
            bool: True if spreadsheet opened successfully
        """
        try:
            self.spreadsheet = self.gc.open_by_key(spreadsheet_id)
            print(f"✅ Opened spreadsheet: {self.spreadsheet.title}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to open spreadsheet: {e}")
            return False
    
    def read_csv_data(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Read data from CSV file
        
        Args:
            file_path: Path to CSV file
            
        Returns:
            List of dictionaries with CSV data
        """
        data = []
        try:
            with open(file_path, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    data.append(row)
            print(f"📖 Read {len(data)} rows from {file_path}")
            return data
            
        except FileNotFoundError:
            print(f"⚠️  File not found: {file_path}")
            return []
        except Exception as e:
            print(f"❌ Error reading {file_path}: {e}")
            return []
    
    def upload_to_sheet(self, sheet_name: str, data: List[Dict[str, Any]], 
                      clear_first: bool = True) -> bool:
        """
        Upload data to a specific sheet
        
        Args:
            sheet_name: Name of the worksheet
            data: List of dictionaries to upload
            clear_first: Whether to clear existing data first
            
        Returns:
            bool: True if upload successful
        """
        if not data:
            print(f"   No data to upload to {sheet_name}")
            return True
            
        try:
            # Get existing worksheet or create if it doesn't exist
            try:
                worksheet = self.spreadsheet.worksheet(sheet_name)
            except gspread.WorksheetNotFound:
                print(f"   Sheet '{sheet_name}' not found. Creating it...")
                worksheet = self.spreadsheet.add_worksheet(sheet_name, 100, 20)
                print(f"   Created sheet '{sheet_name}'")
            
            # Clear existing data if requested
            if clear_first:
                worksheet.clear()
                print(f"   Cleared existing data in {sheet_name}")
            
            # Prepare headers and rows
            if data:
                headers = list(data[0].keys())
                rows = [headers]
                
                for row_dict in data:
                    row = [row_dict.get(header, '') for header in headers]
                    rows.append(row)
                
                # Upload data
                worksheet.update(rows, 'A1')
                print(f"   Uploaded {len(data)} rows to {sheet_name}")
                
            return True
            
        except Exception as e:
            print(f"   Error uploading to {sheet_name}: {e}")
            return False
    
    def calculate_stats(self, accept_data: List[Dict], review_data: List[Dict], 
                       reject_data: List[Dict]) -> List[Dict[str, Any]]:
        """
        Calculate processing statistics
        
        Args:
            accept_data: Data from output_signals.csv
            review_data: Data from review_queue.csv
            reject_data: Data from reject_log.csv
            
        Returns:
            List of dictionaries with stats data
        """
        total_messages = len(accept_data) + len(review_data) + len(reject_data)
        filter_pass_count = len(accept_data) + len(review_data)
        
        # Classify signals based on extraction
        valid_count = len(accept_data)  # Complete valid signals
        partial_count = len(review_data)  # Partial signals
        
        stats = [
            {
                'metric': 'Total Messages Processed',
                'value': total_messages,
                'percentage': '100.0%',
                'category': 'Overall'
            },
            {
                'metric': 'Filter Pass Count',
                'value': filter_pass_count,
                'percentage': f'{(filter_pass_count/total_messages*100):.1f}%' if total_messages > 0 else '0.0%',
                'category': 'Filter'
            },
            {
                'metric': 'VALID Signals',
                'value': valid_count,
                'percentage': f'{(valid_count/total_messages*100):.1f}%' if total_messages > 0 else '0.0%',
                'category': 'Classification'
            },
            {
                'metric': 'PARTIAL Signals',
                'value': partial_count,
                'percentage': f'{(partial_count/total_messages*100):.1f}%' if total_messages > 0 else '0.0%',
                'category': 'Classification'
            },
            {
                'metric': 'ACCEPT',
                'value': len(accept_data),
                'percentage': f'{(len(accept_data)/total_messages*100):.1f}%' if total_messages > 0 else '0.0%',
                'category': 'Decision'
            },
            {
                'metric': 'REVIEW',
                'value': len(review_data),
                'percentage': f'{(len(review_data)/total_messages*100):.1f}%' if total_messages > 0 else '0.0%',
                'category': 'Decision'
            },
            {
                'metric': 'REJECT',
                'value': len(reject_data),
                'percentage': f'{(len(reject_data)/total_messages*100):.1f}%' if total_messages > 0 else '0.0%',
                'category': 'Decision'
            },
            {
                'metric': 'Processing Timestamp',
                'value': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'percentage': 'N/A',
                'category': 'Metadata'
            }
        ]
        
        return stats
    
    def upload_all_results(self, data_dir: str = None) -> bool:
        """
        Upload all processing results to Google Sheets
        
        Args:
            data_dir: Directory containing CSV output files
            
        Returns:
            bool: True if all uploads successful
        """
        if data_dir is None:
            data_dir = DATA_DIR
            
        data_path = Path(data_dir)
        
        print(" Reading CSV files...")
        # Read all CSV files
        accept_data = self.read_csv_data(str(data_path / 'output_signals.csv'))
        review_data = self.read_csv_data(str(data_path / 'review_queue.csv'))
        reject_data = self.read_csv_data(str(data_path / 'reject_log.csv'))
        
        # Calculate and prepare stats
        stats_data = self.calculate_stats(accept_data, review_data, reject_data)
        
        print(" Uploading to Google Sheets...")
        # Upload to each sheet
        success = True
        
        success &= self.upload_to_sheet(SHEET_NAMES['accept'], accept_data)
        success &= self.upload_to_sheet(SHEET_NAMES['review'], review_data)
        success &= self.upload_to_sheet(SHEET_NAMES['reject'], reject_data)
        success &= self.upload_to_sheet(SHEET_NAMES['stats'], stats_data)
        
        if success:
            print("\n All results uploaded successfully to Google Sheets!")
            print(f" View your spreadsheet at: https://docs.google.com/spreadsheets/d/{self.spreadsheet.id}")
        else:
            print("\n Some uploads failed. Check the errors above.")
        
        return success

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Upload trading signal results to Google Sheets')
    parser.add_argument('--spreadsheet-id', '-s', 
                       default=SPREADSHEET_ID,
                       help='Google Sheets spreadsheet ID')
    parser.add_argument('--credentials', '-c',
                       default=CREDENTIALS_FILE,
                       help='Path to Google Service Account credentials file')
    parser.add_argument('--data-dir', '-d',
                       default=DATA_DIR,
                       help='Directory containing CSV output files')
    
    args = parser.parse_args()
    
    # Validate spreadsheet ID
    if not args.spreadsheet_id or args.spreadsheet_id == "YOUR_SPREADSHEET_ID_HERE":
        print("Error: Please set your spreadsheet ID in config.py or use --spreadsheet-id")
        print("Example: python google_sheets_uploader.py --spreadsheet-id 1ABC123xyz456DEF789ghi012JKL345MNO")
        return
    
    # Create uploader
    uploader = GoogleSheetsUploader(args.credentials)
    
    # Authenticate
    if not uploader.authenticate():
        return
    
    # Open spreadsheet
    if not uploader.open_spreadsheet(args.spreadsheet_id):
        return
    
    # Upload results
    uploader.upload_all_results(args.data_dir)

if __name__ == '__main__':
    main()
