# Test Input Specification

## MVP Input Format

### Recommended Input Format
**File Type:** CSV or JSON
**File Naming:** `test_messages_YYYY-MM-DD.csv` or `test_messages_YYYY-MM-DD.json`
**Encoding:** UTF-8
**Line Endings:** Unix (LF)

### Required Fields

| Field Name | Data Type | Description | Example |
|------------|-----------|-------------|---------|
| message_id | String | Unique message identifier | "MSG_001" |
| source | String | Telegram channel name | "GoldSignalsPro" |
| timestamp | String | Message timestamp (ISO 8601) | "2026-04-10T14:30:00Z" |
| content | String | Full message content | "BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00" |
| author | String | Message author/handle | "@trader_joe" |

### Optional Fields

| Field Name | Data Type | Description | Example |
|------------|-----------|-------------|---------|
| message_type | String | Message type (text/image/forwarded) | "text" |
| media_url | String | URL to image if applicable | "https://example.com/image.jpg" |
| forwarded_from | String | Original source if forwarded | "another_channel" |
| language | String | Message language code | "en" |
| has_links | Boolean | Contains URLs | true |

## CSV Format Example

### File: test_messages_2026-04-10.csv
```csv
message_id,source,timestamp,content,author,message_type
MSG_001,GoldSignalsPro,2026-04-10T14:30:00Z,"BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00",@trader_joe,text
MSG_002,GoldTradingExperts,2026-04-10T14:31:00Z,"SELL GOLD between 2025-2030 SL: 2035.00 TP: 2015.00",@expert_trader,text
MSG_003,GoldSignalsPro,2026-04-10T14:32:00Z,"Check out this chart!",@chart_guy,text
MSG_004,GoldTradingExperts,2026-04-10T14:33:00Z,"Consider buying gold around 2025, stop around 2018",@cautious_trader,text
MSG_005,GoldSignalsPro,2026-04-10T14:34:00Z,"BUY and SELL GOLD at 2025.50 SL: 2018.00 TP: 2035.00",@confused_trader,text
```

## JSON Format Example

### File: test_messages_2026-04-10.json
```json
[
  {
    "message_id": "MSG_001",
    "source": "GoldSignalsPro",
    "timestamp": "2026-04-10T14:30:00Z",
    "content": "BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00",
    "author": "@trader_joe",
    "message_type": "text"
  },
  {
    "message_id": "MSG_002",
    "source": "GoldTradingExperts",
    "timestamp": "2026-04-10T14:31:00Z",
    "content": "SELL GOLD between 2025-2030 SL: 2035.00 TP: 2015.00",
    "author": "@expert_trader",
    "message_type": "text"
  },
  {
    "message_id": "MSG_003",
    "source": "GoldSignalsPro",
    "timestamp": "2026-04-10T14:32:00Z",
    "content": "Check out this chart!",
    "author": "@chart_guy",
    "message_type": "text"
  },
  {
    "message_id": "MSG_004",
    "source": "GoldTradingExperts",
    "timestamp": "2026-04-10T14:33:00Z",
    "content": "Consider buying gold around 2025, stop around 2018",
    "author": "@cautious_trader",
    "message_type": "text"
  },
  {
    "message_id": "MSG_005",
    "source": "GoldSignalsPro",
    "timestamp": "2026-04-10T14:34:00Z",
    "content": "BUY and SELL GOLD at 2025.50 SL: 2018.00 TP: 2035.00",
    "author": "@confused_trader",
    "message_type": "text"
  }
]
```

## Naming Conventions

### File Naming
- **Daily files**: `test_messages_YYYY-MM-DD.csv`
- **Batch files**: `test_batch_001.csv`, `test_batch_002.csv`
- **Category files**: `test_valid_structured.csv`, `test_noise.csv`
- **Source files**: `test_goldsignalspro.csv`, `test_goldtradingexperts.csv`

### Message ID Format
- **Standard**: `MSG_001`, `MSG_002`, etc.
- **Source-specific**: `GSP_001` (GoldSignalsPro), `GTE_001` (GoldTradingExperts)
- **Category-specific**: `VALID_001`, `PARTIAL_001`, `NOISE_001`

### Source Naming
- **Real channels**: Use actual channel names
- **Test channels**: Use descriptive names like "TestChannel01"
- **Consistency**: Use the same source name across all test files

## Content Guidelines

### Message Content
- **Exact quotes**: Include message content exactly as received
- **Unicode support**: Handle special characters and emojis
- **Line breaks**: Preserve original formatting
- **Case sensitivity**: Keep original case (don't normalize)

### Timestamp Format
- **ISO 8601**: `YYYY-MM-DDTHH:MM:SSZ`
- **UTC timezone**: Always use UTC
- **Consistent format**: Don't mix timestamp formats
- **Realistic times**: Use realistic message timestamps

### Author Names
- **Handle format**: Include @ symbol if present
- **Real names**: Use actual author names when possible
- **Consistency**: Use the same author name consistently
- **Anonymization**: Use generic names if privacy needed

## Data Quality Requirements

### Completeness
- **Required fields**: Must be present for all messages
- **No empty strings**: Use null or appropriate default values
- **Valid formats**: All fields must match specified formats
- **Unique IDs**: Message IDs must be unique within file

### Consistency
- **Source names**: Use consistent source naming
- **Timestamp ordering**: Optional, but helpful for testing
- **Author consistency**: Same author should have same handle
- **Content accuracy**: Content should match real message format

### Realism
- **Real messages**: Use actual Telegram message examples
- **Natural language**: Avoid artificial or robotic messages
- **Channel variety**: Include different channel styles
- **Message types**: Include various message formats

## File Size and Limits

### Recommended Limits
- **Messages per file**: 100-1000 messages
- **File size**: Under 10MB per file
- **Batch size**: 50-100 messages for testing
- **Daily volume**: 500-2000 messages for realistic testing

### Performance Considerations
- **Processing time**: Larger files take longer to process
- **Memory usage**: JSON files use more memory than CSV
- **Network transfer**: Smaller files transfer faster
- **Database load**: Consider database insertion rates

## Validation Checklist

### Before Processing
- [ ] All required fields present
- [ ] Valid timestamp format
- [ ] Unique message IDs
- [ ] Proper file encoding
- [ ] Correct file naming
- [ ] Valid JSON/CSV syntax

### Content Validation
- [ ] Realistic message content
- [ ] Appropriate source names
- [ ] Consistent author names
- [ ] No duplicate messages
- [ ] Proper line endings

### Testing Validation
- [ ] Mix of signal types
- [ ] Variety of sources
- [ ] Different message formats
- [ ] Edge cases included
- [ ] Known good/bad examples

## Common Issues and Solutions

### CSV Issues
- **Commas in content**: Quote content field properly
- **Line breaks in content**: Use proper escaping
- **Special characters**: Ensure UTF-8 encoding
- **Header mismatches**: Verify column order

### JSON Issues
- **Syntax errors**: Validate JSON before processing
- **Missing commas**: Check for proper JSON syntax
- **Unicode issues**: Ensure proper encoding
- **Nested objects**: Keep structure flat for simplicity

### Data Issues
- **Missing fields**: Add required fields with null values
- **Invalid timestamps**: Use ISO 8601 format
- **Duplicate IDs**: Generate unique identifiers
- **Empty content**: Include meaningful content or mark as noise
