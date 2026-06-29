# Run Instructions - Trading Signal Processing

## Quick Start

### 1. Place Credentials File
Put your `credentials.json` file in this directory:
```
/Users/achraf/CascadeProjects/AI Trading Signal Intelligence/credentials.json
```

### 2. Run the Pipeline

**Option A: From any directory (recommended)**
```bash
/Users/achraf/CascadeProjects/AI Trading Signal Intelligence/run.sh
```

**Option B: Python script**
```bash
/Users/achraf/CascadeProjects/.venv/bin/python "/Users/achraf/CascadeProjects/AI Trading Signal Intelligence/run_complete_pipeline.py"
```

**Option C: Manual steps**
```bash
cd "/Users/achraf/CascadeProjects/AI Trading Signal Intelligence"

# Process data
python3 batch_processor.py --input-file ../AI-Trading-Signal-Intelligence/tests/test_dataset.csv

# Upload to Google Sheets
python3 google_sheets_uploader.py
```

## What Happens

1. **Batch Processing**: Processes 20 test messages
2. **Google Sheets Upload**: Uploads results to 4 tabs
3. **Results**: View at your Google Sheet link

## Expected Output

```
Trading Signal Processing Pipeline
==================================
Step 1: Processing trading signals...
Processing CSV file: ../AI-Trading-Signal-Intelligence/tests/test_dataset.csv
Output files written to data/
  - output_signals.csv: 5 signals
  - review_queue.csv: 8 signals
  - reject_log.csv: 7 signals

Step 2: Uploading to Google Sheets...
All results uploaded successfully!
```

## Troubleshooting

**"credentials.json not found"**: Place the file in the correct directory

**"Permission denied"**: Share your Google Sheet with the service account email

**"File not found"**: Make sure you're using the correct paths

## Your Google Sheet
https://docs.google.com/spreadsheets/d/1aW3iNaFV_VKG5JwhXfOrPHZnT9Ag1jGnvLw6-Xe8osg
