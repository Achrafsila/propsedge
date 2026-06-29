# Google Sheets Integration - Quick Setup

## 1. Place Credentials File

Download your Google Service Account credentials and rename it to `credentials.json`:

```
/Users/achraf/CascadeProjects/AI Trading Signal Intelligence/credentials.json
```

## 2. Set Google Sheet ID

Edit `config.py` and update your spreadsheet ID:

```python
SPREADSHEET_ID = "1ABC123xyz456DEF789ghi012JKL345MNO"  # Your actual ID
```

Get the ID from your Google Sheet URL:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

## 3. Create Sheet Tabs

Make sure your Google Sheet has these 4 tabs exactly:
- `ACCEPT_SIGNALS`
- `REVIEW_QUEUE`
- `REJECT_LOG`
- `STATS`

## 4. Install Dependencies

```bash
pip3 install -r requirements.txt
```

## 5. Run the Upload

### Option A: Complete Pipeline (Process + Upload)
```bash
python3 run_complete_pipeline.py --spreadsheet-id YOUR_SPREADSHEET_ID
```

### Option B: Upload Only (after processing)
```bash
# First process data
python3 batch_processor.py

# Then upload
python3 google_sheets_uploader.py --spreadsheet-id YOUR_SPREADSHEET_ID
```

## 6. Share Google Sheet

Share your Google Sheet with the service account email from your credentials:
```
trading-signals-uploader@your-project-id.iam.gserviceaccount.com
```

Give it **Editor** permissions.

## Troubleshooting

**"Spreadsheet ID not set"**: Update config.py with your actual spreadsheet ID

**"Authentication failed"**: Check credentials.json file location and permissions

**"Sheet not found"**: Create the 4 required tabs in your Google Sheet

**"Permission denied"**: Share the sheet with your service account email

## What Gets Uploaded

- **ACCEPT_SIGNALS**: Valid trading signals with all parameters
- **REVIEW_QUEUE**: Partial signals needing manual review
- **REJECT_LOG**: Rejected messages with reasons
- **STATS**: Processing metrics and percentages

The uploader clears old data before uploading new results each time.
