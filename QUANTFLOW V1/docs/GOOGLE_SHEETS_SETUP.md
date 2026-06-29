# Google Sheets Integration Setup

This guide shows how to connect the batch processing results to Google Sheets.

## Overview
The Google Sheets integration automatically uploads processing results to 4 separate sheets:
- **ACCEPT_SIGNALS**: Valid trading signals ready for use
- **REVIEW_QUEUE**: Signals requiring manual review
- **REJECT_LOG**: Rejected messages with reasons
- **STATS**: Processing metrics and summary statistics

## Step 1: Google Cloud Setup

### 1.1 Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "trading-signals-processor")
3. Note your Project ID

### 1.2 Enable Google Sheets API
1. In your project, go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click "Enable"
4. Also enable "Google Drive API" (required for spreadsheet creation)

### 1.3 Create Service Account
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in:
   - **Service account name**: trading-signals-uploader
   - **Service account ID**: trading-signals-uploader@your-project-id.iam.gserviceaccount.com
   - **Description**: Uploads trading signal results to Google Sheets
4. Click "Create and Continue"
5. Skip roles (click "Done")
6. Click on the created service account
7. Go to "Keys" tab > "Add Key" > "Create new key"
8. Select **JSON** format
9. Click "Create" - this will download a JSON file

### 1.4 Rename and Place Credentials
1. Rename the downloaded JSON file to `credentials.json`
2. Place it in the project root directory:
   ```
   /Users/achraf/CascadeProjects/AI Trading Signal Intelligence/credentials.json
   ```

## Step 2: Install Dependencies

```bash
# Install required packages
pip3 install -r requirements.txt
```

## Step 3: Create Google Sheet

### 3.1 Create New Spreadsheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Click "Create" > "Blank spreadsheet"
3. Name it: "Trading Signals Processing Results"
4. Note the spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   ```

### 3.2 Share with Service Account
1. Click "Share" button
2. Add the service account email:
   ```
   trading-signals-uploader@your-project-id.iam.gserviceaccount.com
   ```
3. Give it **Editor** permissions
4. Click "Send"

## Step 4: Run the Integration

### 4.1 Process Your Data First
```bash
# Run batch processing
python3 batch_processor.py --input-file tests/test_dataset.csv
```

### 4.2 Upload to Google Sheets
```bash
# Upload results to Google Sheets
python3 google_sheets_uploader.py --spreadsheet-id YOUR_SPREADSHEET_ID
```

Example:
```bash
python3 google_sheets_uploader.py --spreadsheet-id 1ABC123xyz456DEF789ghi012JKL345MNO
```

## Step 5: Verify Results

### Expected Sheet Structure

**ACCEPT_SIGNALS Sheet:**
| signal_id | message_id | timestamp | source_channel | action | instrument | entry_price | stop_loss | take_profit | confidence_score | message_type | processing_status |
|-----------|------------|-----------|----------------|--------|------------|-------------|-----------|-------------|------------------|--------------|-------------------|

**REVIEW_QUEUE Sheet:**
| review_id | message_id | timestamp | source_channel | raw_message | issue_type | missing_fields | confidence_score | review_status |
|-----------|------------|-----------|----------------|-------------|------------|-----------------|------------------|---------------|

**REJECT_LOG Sheet:**
| reject_id | message_id | timestamp | source_channel | raw_message | rejection_reason | confidence_score |
|-----------|------------|-----------|----------------|-------------|------------------|------------------|

**STATS Sheet:**
| metric | value | percentage | category |
|---------|-------|------------|----------|
| Total Messages Processed | 20 | 100.0% | Overall |
| Filter Pass Count | 13 | 65.0% | Filter |
| VALID Signals | 5 | 25.0% | Classification |
| PARTIAL Signals | 8 | 40.0% | Classification |
| ACCEPT | 5 | 25.0% | Decision |
| REVIEW | 8 | 40.0% | Decision |
| REJECT | 7 | 35.0% | Decision |

## Troubleshooting

### Common Issues

**1. "Authentication failed"**
- Verify `credentials.json` is in the correct location
- Check Google Sheets API is enabled
- Ensure service account email has Editor access

**2. "Failed to open spreadsheet"**
- Verify spreadsheet ID is correct
- Check sharing permissions for service account
- Ensure spreadsheet exists and is accessible

**3. "File not found" errors**
- Run batch processing first to generate CSV files
- Check `data/` directory contains output files

**4. Permission errors**
- Re-check service account has Editor permissions
- Try sharing the spreadsheet again

### Debug Mode
Add print statements to debug:
```python
print(f"Credentials path: {uploader.credentials_path}")
print(f"Spreadsheet ID: {args.spreadsheet_id}")
print(f"Data directory: {args.data_dir}")
```

## Advanced Usage

### Custom Spreadsheet Name
The script works with any existing spreadsheet. Just share it with the service account and provide the ID.

### Multiple Datasets
You can upload different datasets by specifying different data directories:
```bash
python3 google_sheets_uploader.py --spreadsheet-id YOUR_ID --data-dir results_2024_01
```

### Automation
Create a script to run both processing and upload:
```bash
#!/bin/bash
echo "Processing trading signals..."
python3 batch_processor.py --input-file tests/test_dataset.csv

echo "Uploading to Google Sheets..."
python3 google_sheets_uploader.py --spreadsheet-id YOUR_SPREADSHEET_ID

echo "Done! Check your Google Sheet."
```

## Security Notes

- Keep `credentials.json` secure and never commit to version control
- Only give Editor permissions to the service account
- Regularly rotate service account keys
- Use environment variables for credentials in production

## Next Steps

After successful setup:
1. Set up automated runs (cron jobs, GitHub Actions)
2. Create dashboards in Google Sheets
3. Set up email notifications for new signals
4. Integrate with trading platforms
