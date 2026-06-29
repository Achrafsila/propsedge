# Test Protocol

## Step-by-Step MVP Test Process

### Phase 1: Preparation (Day 1)

#### Step 1.1: Environment Setup
**Objective:** Prepare testing environment
**Time:** 2-4 hours
**Tasks:**
- Create test input directory
- Set up output directory
- Prepare Google Sheets with schema
- Verify all required files are present
- Test file access permissions

**Deliverables:**
- Ready test environment
- Configured Google Sheets
- File access verified

#### Step 1.2: Test Dataset Preparation
**Objective:** Create comprehensive test dataset
**Time:** 4-8 hours
**Tasks:**
- Select 3-5 Telegram channels
- Collect 200-500 messages
- Classify messages into 5 categories
- Create input files (CSV/JSON)
- Validate dataset quality

**Deliverables:**
- Test dataset files
- Classification documentation
- Quality validation report

### Phase 2: System Testing (Day 2)

#### Step 2.1: Input Processing Test
**Objective:** Test message intake and filtering
**Time:** 1-2 hours
**Tasks:**
- Load test dataset into system
- Run Message Intake module
- Run Signal Filter module
- Verify classification results
- Log processing times

**Measurements:**
- Processing time per message
- Classification accuracy
- Error rates
- Memory usage

**Success Criteria:**
- 95%+ messages processed successfully
- <5 second average processing time
- Proper classification of message types

#### Step 2.2: Extraction Test
**Objective:** Test signal extraction engine
**Time:** 2-3 hours
**Tasks:**
- Run Signal Extraction on filtered messages
- Verify extraction accuracy
- Check normalization results
- Test edge cases
- Document extraction failures

**Measurements:**
- Extraction success rate by category
- Field completeness rates
- Normalization accuracy
- Error patterns

**Success Criteria:**
- 90%+ extraction accuracy for valid messages
- 95%+ field completeness for structured messages
- Proper handling of edge cases

#### Step 2.3: Decision Engine Test
**Objective:** Test decision rules and safety gates
**Time:** 2-3 hours
**Tasks:**
- Run Decision Engine on extracted signals
- Verify hard reject gates
- Check accept gate logic
- Test scoring system
- Validate decision consistency

**Measurements:**
- Decision distribution (ACCEPT/REVIEW/REJECT)
- Hard reject gate effectiveness
- Scoring consistency
- Decision accuracy vs expected

**Success Criteria:**
- 100% hard reject gate effectiveness
- Consistent scoring for similar signals
- Proper decision distribution

### Phase 3: Output Validation (Day 3)

#### Step 3.1: Output Generation Test
**Objective:** Test final output generation
**Time:** 1-2 hours
**Tasks:**
- Generate final JSON outputs
- Verify schema compliance
- Check required fields
- Validate data types
- Test output formatting

**Measurements:**
- Output generation success rate
- Schema compliance rate
- Field completeness
- Formatting accuracy

**Success Criteria:**
- 100% output generation success
- 100% schema compliance
- All required fields present

#### Step 3.2: Google Sheets Integration Test
**Objective:** Test Google Sheets output
**Time:** 1-2 hours
**Tasks:**
- Export outputs to Google Sheets
- Verify tab population
- Check column mapping
- Test data formatting
- Validate sheet structure

**Measurements:**
- Export success rate
- Data mapping accuracy
- Sheet population correctness
- Formatting consistency

**Success Criteria:**
- 100% export success
- Correct tab and column mapping
- Proper data formatting

### Phase 4: Review Process (Day 4)

#### Step 4.1: Manual Review Setup
**Objective:** Prepare manual review process
**Time:** 1-2 hours
**Tasks:**
- Set up review interface
- Prepare review guidelines
- Create review templates
- Train reviewers
- Test review workflow

**Deliverables:**
- Review interface ready
- Review guidelines documented
- Reviewers trained

#### Step 4.2: Manual Review Execution
**Objective:** Review REVIEW signals
**Time:** 4-6 hours
**Tasks:**
- Review all REVIEW signals
- Document review decisions
- Provide feedback on system
- Update signal statuses
- Measure review efficiency

**Measurements:**
- Review completion rate
- Review accuracy
- Average review time
- Feedback quality

**Success Criteria:**
- 100% REVIEW signals processed
- <5 minute average review time
- Consistent review decisions

## What to Measure

### Performance Metrics

#### Processing Speed
- **End-to-end time**: From input to output
- **Module processing time**: Time per module
- **Message processing time**: Time per message
- **Batch processing time**: Time for full dataset

#### Accuracy Metrics
- **Classification accuracy**: Correct message type classification
- **Extraction accuracy**: Correct field extraction
- **Decision accuracy**: Correct final decisions
- **Schema compliance**: Correct output format

#### Quality Metrics
- **False positive rate**: Noise classified as signals
- **False negative rate**: Signals classified as noise
- **Partial detection rate**: Partial signals identified
- **Safety rejection rate**: Dangerous signals rejected

### System Metrics

#### Reliability
- **Processing success rate**: Messages processed successfully
- **Error rate**: System errors encountered
- **Recovery rate**: Error recovery success
- **Uptime**: System availability during testing

#### Scalability
- **Memory usage**: Peak memory consumption
- **CPU usage**: Processing resource consumption
- **Storage usage**: Disk space requirements
- **Network usage**: Data transfer requirements

## Success Criteria

### Functional Success
- **Processing**: 95%+ messages processed end-to-end
- **Extraction**: 90%+ accurate extraction for valid signals
- **Decision**: 100% safety gate effectiveness
- **Output**: 100% schema compliance

### Performance Success
- **Speed**: <5 second average processing time
- **Throughput**: 100+ messages per hour capability
- **Latency**: <2 second decision time
- **Resource**: Reasonable resource consumption

### Quality Success
- **False positives**: <5% noise classified as signals
- **False negatives**: <10% signals classified as noise
- **Safety**: 0% dangerous signals accepted
- **Consistency**: Consistent decisions for similar inputs

### Operational Success
- **Review**: 100% REVIEW signals processed manually
- **Feedback**: Actionable feedback generated
- **Documentation**: Complete test documentation
- **Reproducibility**: Test results reproducible

## False Positive / False Negative Checks

### False Positive Checks
**Definition:** Noise or invalid content classified as valid signals

#### Test Cases
1. **Market commentary**: "Gold looks strong today" should be REJECTED
2. **Questions**: "What do you think about gold?" should be REJECTED
3. **General chat**: "Thanks for sharing" should be REJECTED
4. **Non-trading content**: News, weather, politics should be REJECTED

#### Verification Steps
- Review all ACCEPT signals
- Verify each contains actual trading parameters
- Check for false signal detection
- Document any false positives found

#### Acceptance Criteria
- <5% false positive rate
- No obvious noise in ACCEPT category
- Clear trading parameters in all ACCEPT signals

### False Negative Checks
**Definition:** Valid trading signals classified as noise or rejected

#### Test Cases
1. **Standard signals**: "BUY GOLD at 2025.50 SL: 2018.00 TP: 2035.00" should be ACCEPTED
2. **Alternative formats**: "BUY GOLD entry 2025.50 stop 2018.00 target 2035.00" should be ACCEPTED
3. **Semi-structured**: "BUY GOLD if price above 2030 SL: 2020.00 TP: 2050.00" should be REVIEWED
4. **Partial signals**: "Consider buying gold around 2025, stop around 2018" should be REVIEWED

#### Verification Steps
- Review all REJECT signals
- Check for missed trading signals
- Verify partial signal handling
- Document any false negatives found

#### Acceptance Criteria
- <10% false negative rate
- Valid signals properly classified
- Partial signals sent to REVIEW

## Review Process for Borderline Cases

### Borderline Case Definition
**Signals that fall between clear categories and require careful consideration**

#### Common Borderline Cases
1. **Ambiguous entry**: "BUY GOLD around 2025"
2. **Partial risk management**: "BUY GOLD at 2025.50 SL: 2018.00"
3. **Conditional language**: "Looking to buy gold if price breaks 2030"
4. **Verbose signals**: Long messages with embedded signals
5. **Mixed content**: Analysis plus signal

### Review Guidelines

#### Step 1: Signal Assessment
**Questions to ask:**
- Is there a clear trading intention?
- Are the essential parameters present?
- Is the signal actionable?
- Is the risk management adequate?

#### Step 2: Context Evaluation
**Factors to consider:**
- Source quality and history
- Market conditions at time
- Signal complexity
- Risk level involved

#### Step 3: Decision Making
**Decision criteria:**
- **ACCEPT**: Clear, complete, safe signal
- **REVIEW**: Usable but needs human evaluation
- **REJECT**: Unclear, incomplete, or unsafe

#### Step 4: Documentation
**Required documentation:**
- Reasoning for decision
- Concerns identified
- Additional context needed
- Recommendations for improvement

### Review Template

#### Signal Information
- Signal ID: [ID]
- Source: [Channel name]
- Timestamp: [Date/time]
- Original message: [Full content]

#### System Analysis
- Classification: [TYPE_1/TYPE_2/TYPE_3]
- Extraction status: [VALID/PARTIAL/REJECTED]
- Decision: [ACCEPT/REVIEW/REJECT]
- Score: [0-100]

#### Review Assessment
- **Trading intention**: [Clear/Unclear/Absent]
- **Parameter completeness**: [Complete/Partial/Missing]
- **Actionability**: [Actionable/Conditional/Not actionable]
- **Safety**: [Safe/Risky/Unsafe]

#### Final Decision
- **Decision**: [ACCEPT/REVIEW/REJECT]
- **Reasoning**: [Detailed explanation]
- **Concerns**: [List of concerns]
- **Recommendations**: [Improvement suggestions]

### Review Quality Metrics

#### Consistency Metrics
- **Inter-reviewer agreement**: Consistency between reviewers
- **Intra-reviewer consistency**: Consistency over time
- **Decision stability**: Same decision for similar signals

#### Efficiency Metrics
- **Review time**: Average time per signal
- **Review throughput**: Signals reviewed per hour
- **Queue management**: Review queue processing time

#### Quality Metrics
- **Review accuracy**: Correctness of review decisions
- **Feedback quality**: Usefulness of review feedback
- **Improvement impact**: System improvements from feedback

## Test Reporting

### Daily Reports
#### Day 1 Report
- Environment setup status
- Dataset preparation progress
- Issues encountered
- Next day preparation

#### Day 2 Report
- System testing results
- Performance metrics
- Accuracy measurements
- Issues and resolutions

#### Day 3 Report
- Output validation results
- Google Sheets integration status
- Schema compliance
- Formatting verification

#### Day 4 Report
- Manual review results
- Review quality metrics
- Feedback summary
- Final assessment

### Final Test Report
#### Executive Summary
- Overall test success
- Key achievements
- Critical issues
- Recommendations

#### Detailed Results
- Performance metrics
- Accuracy measurements
- Quality assessments
- Comparison to criteria

#### Issues and Resolutions
- Issues encountered
- Resolution steps
- Remaining concerns
- Future improvements

#### Appendices
- Raw test data
- Detailed measurements
- Review documentation
- System logs
