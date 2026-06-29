# Google Sheets Schema

## Recommended Google Sheets Structure

### Sheet Overview
- **Total Sheets**: 6 tabs
- **Purpose**: Complete tracking of MVP testing process
- **Access**: Edit permissions for team, view for stakeholders
- **Naming**: `AI Trading Signal Intelligence Test Results`

## Tab 1: Input Messages
**Purpose:** Track all input messages and basic processing
**Sheet Name:** `01_Input_Messages`

### Column Structure
| Column | Header | Data Type | Description | Example |
|--------|--------|-----------|-------------|---------|
| A | message_id | String | Unique message identifier | MSG_001 |
| B | source | String | Telegram channel name | GoldSignalsPro |
| C | timestamp | DateTime | Message timestamp (UTC) | 2026-04-10 14:30:00 |
| D | content | Text | Full message content | BUY GOLD at 2025.50... |
| E | author | String | Message author | @trader_joe |
| F | input_status | String | Processing status | Processed/Error |
| G | processing_time_ms | Number | Processing time in milliseconds | 1200 |
| H | filter_result | String | Signal filter result | TYPE_1_STRUCTURED |
| I | extraction_status | String | Extraction result | VALID |
| J | decision | String | Final decision | ACCEPT/REVIEW/REJECT |

### Data Flow
- **Input**: From test input files
- **Population**: Automated during processing
- **Updates**: Status updates as processing progresses
- **Purpose**: Complete audit trail of all messages

## Tab 2: ACCEPT Signals
**Purpose:** Track all accepted signals ready for trading
**Sheet Name:** `02_ACCEPT_Signals`

### Column Structure
| Column | Header | Data Type | Description | Example |
|--------|--------|-----------|-------------|---------|
| A | signal_id | String | Generated signal ID | SIGNAL_001 |
| B | message_id | String | Original message ID | MSG_001 |
| C | source | String | Telegram channel name | GoldSignalsPro |
| D | timestamp | DateTime | Signal timestamp | 2026-04-10 14:30:00 |
| E | action | String | Trading action | BUY |
| F | instrument | String | Trading instrument | GOLD |
| G | entry_price | Number | Entry price | 2025.50 |
| H | stop_loss | Number | Stop loss price | 2018.00 |
| I | take_profit | Number | Take profit price | 2035.00 |
| J | decision_score | Number | Decision score (0-100) | 95 |
| K | extraction_confidence | Number | Extraction confidence (0-1) | 0.95 |
| L | processing_time_ms | Number | Total processing time | 1200 |
| M | status | String | Signal status | Active/Processed |
| N | notes | Text | Additional notes | High confidence signal |

### Data Flow
- **Input**: From final output (ACCEPT signals only)
- **Population**: Automated from output generation
- **Updates**: Status updates during trading execution
- **Purpose**: Ready-to-trade signal tracking

## Tab 3: REVIEW Signals
**Purpose:** Track signals requiring manual review
**Sheet Name:** `03_REVIEW_Signals`

### Column Structure
| Column | Header | Data Type | Description | Example |
|--------|--------|-----------|-------------|---------|
| A | signal_id | String | Generated signal ID | SIGNAL_002 |
| B | message_id | String | Original message ID | MSG_002 |
| C | source | String | Telegram channel name | GoldTradingExperts |
| D | timestamp | DateTime | Signal timestamp | 2026-04-10 14:31:00 |
| E | action | String | Trading action | BUY |
| F | instrument | String | Trading instrument | GOLD |
| G | entry_price | Text | Entry price (may be conditional) | above 2030 |
| H | stop_loss | Number | Stop loss price | 2020.00 |
| I | take_profit | Number | Take profit price | 2050.00 |
| J | decision_score | Number | Decision score (0-100) | 72 |
| K | extraction_confidence | Number | Extraction confidence (0-1) | 0.88 |
| L | concerns | Text | List of concerns | conditional_entry |
| M | review_status | String | Review status | Pending/Reviewed |
| N | reviewer | String | Reviewer name/handle | reviewer_01 |
| O | review_decision | String | Final review decision | ACCEPT/REJECT |
| P | review_timestamp | DateTime | Review completion time | 2026-04-10 14:35:00 |
| Q | review_notes | Text | Review reasoning | Conditional acceptable |
| R | final_decision | String | Final system decision | ACCEPT/REJECT |

### Data Flow
- **Input**: From final output (REVIEW signals only)
- **Population**: Automated from output generation
- **Updates**: Manual review updates
- **Purpose**: Manual review tracking and final decisions

## Tab 4: REJECT Signals
**Purpose:** Track all rejected signals with reasons
**Sheet Name:** `04_REJECT_Signals`

### Column Structure
| Column | Header | Data Type | Description | Example |
|--------|--------|-----------|-------------|---------|
| A | signal_id | String | Generated signal ID | SIGNAL_003 |
| B | message_id | String | Original message ID | MSG_003 |
| C | source | String | Telegram channel name | GoldSignalsPro |
| D | timestamp | DateTime | Signal timestamp | 2026-04-10 14:32:00 |
| E | filter_result | String | Signal filter result | TYPE_3_NOISE |
| F | extraction_status | String | Extraction result | REJECTED |
| G | decision_score | Number | Decision score (0-100) | 0 |
| H | rejection_reasons | Text | List of rejection reasons | price_logic_error |
| I | hard_gates | String | Hard gate status | FAILED |
| J | processing_time_ms | Number | Processing time | 800 |
| K | reject_category | String | Rejection category | Safety/Quality/Noise |
| L | notes | Text | Additional notes | Dangerous signal |

### Data Flow
- **Input**: From final output (REJECT signals only)
- **Population**: Automated from output generation
- **Updates**: Category updates and analysis
- **Purpose**: Rejection tracking and analysis

## Tab 5: Performance Metrics
**Purpose:** Track system performance and quality metrics
**Sheet Name:** `05_Performance_Metrics`

### Column Structure
| Column | Header | Data Type | Description | Example |
|--------|--------|-----------|-------------|---------|
| A | date | Date | Metric date | 2026-04-10 |
| B | total_messages | Number | Total messages processed | 250 |
| C | processed_successfully | Number | Successfully processed | 238 |
| D | accept_count | Number | ACCEPT signals | 45 |
| E | review_count | Number | REVIEW signals | 38 |
| F | reject_count | Number | REJECT signals | 167 |
| G | avg_processing_time_ms | Number | Average processing time | 1100 |
| H | extraction_accuracy | Percentage | Extraction accuracy | 92% |
| I | decision_accuracy | Percentage | Decision accuracy | 95% |
| J | false_positive_rate | Percentage | False positive rate | 3% |
| K | false_negative_rate | Percentage | False negative rate | 8% |
| L | review_completion_rate | Percentage | Review completion rate | 100% |
| M | avg_review_time_minutes | Number | Average review time | 4.2 |

### Data Flow
- **Input**: Aggregated from processing results
- **Population**: Automated calculations
- **Updates**: Daily/weekly updates
- **Purpose**: Performance tracking and analysis

## Tab 6: Source Analysis
**Purpose:** Track performance by source/channel
**Sheet Name:** `06_Source_Analysis`

### Column Structure
| Column | Header | Data Type | Description | Example |
|--------|--------|-----------|-------------|---------|
| A | source | String | Telegram channel name | GoldSignalsPro |
| B | total_messages | Number | Total messages from source | 120 |
| C | accept_rate | Percentage | Percentage accepted | 45% |
| D | review_rate | Percentage | Percentage sent to review | 25% |
| E | reject_rate | Percentage | Percentage rejected | 30% |
| F | avg_decision_score | Number | Average decision score | 78 |
| G | extraction_accuracy | Percentage | Extraction accuracy | 94% |
| D | signal_quality_score | Number | Overall quality score (0-100) | 82 |
| E | reliability_score | Number | Reliability score (0-100) | 88 |
| F | last_signal_timestamp | DateTime | Last signal received | 2026-04-10 14:30:00 |
| G | status | String | Source status | Active/Monitoring/Disabled |

### Data Flow
- **Input**: Aggregated from signal results
- **Population**: Automated calculations
- **Updates**: Continuous updates
- **Purpose**: Source quality assessment

## Output Mapping

### ACCEPT Signals Flow
```
Final Output (ACCEPT) 
    |
    v
Google Sheets: 02_ACCEPT_Signals
    |
    v
Trading System (when live)
```

### REVIEW Signals Flow
```
Final Output (REVIEW)
    |
    v
Google Sheets: 03_REVIEW_Signals
    |
    v
Manual Review Process
    |
    v
Updated Decision (ACCEPT/REJECT)
    |
    v
Final Status Update
```

### REJECT Signals Flow
```
Final Output (REJECT)
    |
    v
Google Sheets: 04_REJECT_Signals
    |
    v
Analysis and Learning
```

## Sheet Configuration

### Formatting Rules
- **Dates**: YYYY-MM-DD HH:MM:SS format
- **Numbers**: No commas, 2 decimal places for prices
- **Percentages**: XX% format with 1 decimal place
- **Text**: Left-aligned, wrap text for long content
- **Headers**: Bold, centered, background color

### Conditional Formatting
- **ACCEPT signals**: Green background
- **REVIEW signals**: Yellow background
- **REJECT signals**: Red background
- **High scores**: Green text (80+)
- **Low scores**: Red text (<60)
- **Processing time**: Yellow if >5000ms

### Data Validation
- **Decision column**: Dropdown (ACCEPT/REVIEW/REJECT)
- **Status columns**: Dropdown (Active/Processed/Pending)
- **Source column**: Dropdown of known sources
- **Reviewer column**: Dropdown of authorized reviewers

### Protection Rules
- **Input data**: Read-only after processing
- **Automated columns**: Read-only (formula-based)
- **Manual review columns**: Editable by reviewers only
- **Metrics sheets**: Read-only for most users

## Data Population Process

### Automated Population
1. **Input Messages**: Populated during processing
2. **Signal Sheets**: Populated from final output
3. **Performance Metrics**: Calculated from signal data
4. **Source Analysis**: Aggregated from signal data

### Manual Updates
1. **Review Signals**: Manual review completion
2. **Status Updates**: Signal execution status
3. **Notes**: Additional context and observations
4. **Source Management**: Source status changes

### Data Refresh Schedule
- **Real-time**: Input Messages, Signal Sheets
- **Hourly**: Performance Metrics
- **Daily**: Source Analysis
- **Weekly**: Summary reports

## Access and Permissions

### Permission Levels
- **Admin**: Full access to all sheets
- **Reviewer**: Edit access to REVIEW sheet, view others
- **Analyst**: View access to all sheets, edit metrics
- **Stakeholder**: View-only access to summary sheets

### Sharing Settings
- **Organization**: View access to domain
- **Specific users**: Edit access as needed
- **Public**: Disabled (confidential data)
- **Comments**: Enabled for collaboration

### Backup and Version Control
- **Daily backups**: Automated export
- **Version history**: Enabled for all sheets
- **Change tracking**: Monitor important changes
- **Recovery plan**: Restore procedures documented

## Quality Assurance

### Data Validation Checks
- **Required fields**: All required fields populated
- **Data types**: Correct data types in each column
- **Referential integrity**: Message IDs match across sheets
- **Logical consistency**: Decisions match scores and reasoning

### Automated Monitoring
- **Error alerts**: Email notifications for errors
- **Quality metrics**: Daily quality reports
- **Performance alerts**: Notifications for slow processing
- **Data completeness**: Missing data alerts

### Manual Review Process
- **Daily review**: Check for data anomalies
- **Weekly audit**: Verify data integrity
- **Monthly assessment**: Review overall quality
- **Quarterly review**: Process improvement assessment

## Usage Guidelines

### For Team Members
- **Update promptly**: Process updates in timely manner
- **Document changes**: Note important changes
- **Follow conventions**: Use established formats
- **Communicate issues**: Report problems quickly

### For Reviewers
- **Review thoroughly**: Complete all required fields
- **Provide context**: Add helpful notes
- **Be consistent**: Apply consistent criteria
- **Track time**: Monitor review efficiency

### For Analysts
- **Verify data**: Check data quality regularly
- **Update metrics**: Keep performance metrics current
- **Analyze trends**: Look for patterns and insights
- **Report findings**: Share important discoveries

### For Stakeholders
- **Monitor summaries**: Review key metrics
- **Provide feedback**: Share observations
- **Support improvements**: Enable process changes
- **Track progress**: Monitor MVP development
