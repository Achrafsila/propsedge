#!/usr/bin/env python3
"""
MVP Batch Processor for Telegram Trading Signal Testing

Processes CSV files containing trading signals through:
1. Filter Engine - Identifies potential trading signals
2. Extraction Engine - Extracts trading parameters  
3. Decision Engine - Routes to appropriate output

Usage: python batch_processor.py [--input-file path/to/input.csv]
"""

import csv
import re
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

class SignalProcessor:
    """Main signal processing class implementing Filter -> Extraction -> Decision pipeline"""
    
    def __init__(self):
        # Initialize counters for metrics
        self.total_processed = 0
        self.accepted = 0
        self.reviewed = 0
        self.rejected = 0
        self.duplicates_removed = 0
        
        # Define keyword patterns for filtering
        self.action_keywords = ['BUY', 'SELL', 'LONG', 'SHORT']
        self.instrument_keywords = ['GOLD', 'XAUUSD', 'XAU/USD']
        self.price_keywords = ['SL', 'TP', 'STOP', 'LOSS', 'TAKE', 'PROFIT']
        
        # Track signals for deduplication
        self.channel_signals = {}
        
        # Deduplication settings
        self.duplicate_price_tolerance = 0.01  # Prix toléré comme doublon (0.01$ = même prix exact)
        self.duplicate_time_window = 86400  # Fenêtre de temps en secondes (24 heures - pour capturer tous les doublons sur même niveau)
    
    def clean_message(self, message: str) -> str:
        """
        Clean message by removing non-ASCII but preserve trading signal content
        
        Args:
            message: Raw message text
            
        Returns:
            Cleaned message text
        """
        import re
        # Remove Arabic and other non-Latin scripts but keep ASCII and emojis
        message = re.sub(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+', '', message)  # Remove Arabic
        # Remove multiple newlines and excessive whitespace
        message = re.sub(r'\n+', ' ', message)
        message = re.sub(r'\s+', ' ', message)
        # Strip leading/trailing spaces
        message = message.strip()
        return message
    
    def filter_signal(self, message: str) -> Tuple[bool, float]:
        """
        Filter Engine: Check if message contains trading signal for GOLD/XAUUSD
        
        Returns:
            Tuple[bool, float]: (is_signal, confidence_score)
        """
        message_upper = message.upper()
        confidence = 0.0
        
        # Check for trading action
        has_action = any(keyword in message_upper for keyword in self.action_keywords)
        if has_action:
            confidence += 0.3
            
        # Check for GOLD instrument
        has_instrument = any(keyword in message_upper for keyword in self.instrument_keywords)
        if has_instrument:
            confidence += 0.3
            
        # Check for price elements
        has_price_elements = any(keyword in message_upper for keyword in self.price_keywords)
        if has_price_elements:
            confidence += 0.2
            
        # Check for numbers (prices)
        has_numbers = bool(re.search(r'\d+\.\d+', message))
        if has_numbers:
            confidence += 0.2
            
        is_signal = confidence >= 0.6  # Minimum threshold for potential signal
        return is_signal, min(confidence, 1.0)
    
    def extract_trading_params(self, message: str) -> Dict[str, Optional[float]]:
        """
        Extraction Engine: Parse trading parameters from message
        
        Returns:
            Dict with keys: action, instrument, entry_price, stop_loss, take_profit
        """
        message_upper = message.upper()
        params = {
            'action': None,
            'instrument': None,
            'entry_price': None,
            'stop_loss': None,
            'take_profit': None
        }
        
        # Extract action
        for keyword in self.action_keywords:
            if keyword in message_upper:
                params['action'] = 'BUY' if keyword in ['BUY', 'LONG'] else 'SELL'
                break
                
        # Extract instrument (standardize to GOLD)
        for keyword in self.instrument_keywords:
            if keyword in message_upper:
                params['instrument'] = 'GOLD'
                break
                
        # Extract prices using regex patterns with priority order (for cleaned messages)
        price_patterns = [
            # Priority 0: XAUUSD Green Pips format (SELL NOW: 4779)
            (r'(?:SELL|BUY|LONG|SHORT)\s*NOW:\s*([\d.]+)', 'entry_price'),
            
            # Priority 1: @kingxauusd1 format (XAUUSD SELL NOW 4779)
            (r'(?:XAUUSD|GOLD)\s*(BUY|SELL|LONG|SHORT)\s*NOW\s*([\d.]+)', 'entry_price'),
            
            # Priority 2: GOLD SELL NOW 4779 (without XAUUSD prefix)
            (r'(?:GOLD)\s*(BUY|SELL|LONG|SHORT)\s*NOW\s*([\d.]+)', 'entry_price'),
            
            # Priority 3: Entry keyword (cleaned format: "Entry: 2385.91")
            (r'(?:Entry|ENTRY):\s*([\d.]+)', 'entry_price'),
            
            # Priority 4: AT keyword
            (r'(?:AT|at|@)\s+([\d.]+)', 'entry_price'),
            
            # Priority 5: DIRECTION + INSTRUMENT + NUMBER
            (r'(BUY|SELL|LONG|SHORT)\s*(?:GOLD|XAU|XAUUSD|XAU/USD)\s+([\d.]+)', 'entry_price'),
            
            # Priority 6: INSTRUMENT + DIRECTION + NUMBER
            (r'(?:GOLD|XAU|XAUUSD|XAU/USD)\s*(BUY|SELL|LONG|SHORT)\s+([\d.]+)', 'entry_price'),
            
            # Priority 7: DIRECTION + NUMBER + INSTRUMENT
            (r'(BUY|SELL|LONG|SHORT)\s+([\d.]+)\s+(?:GOLD|XAU|XAUUSD|XAU/USD)', 'entry_price'),
            
            # Priority 8: XAUUSD Green Pips format (STOP LOSS (SL): 4789)
            (r'(?:STOP LOSS\s*\(?SL\)?):\s*([\d.]+)', 'stop_loss'),
            
            # Priority 9: @kingxauusd1 format (Sl : 4787) - with optional space before colon
            (r'(?:Sl|SL)\s*:\s*([\d.]+)', 'stop_loss'),
            
            # Priority 10: Stop Loss (cleaned format: "Stop Loss: 2366.04" or "SL: 2366.04")
            (r'(?:Stop Loss|STOP LOSS|STOP)\s*:\s*([\d.]+)', 'stop_loss'),
            
            # Priority 11: XAUUSD Green Pips format (TAKE PROFIT (TP): 4769)
            (r'(?:TAKE PROFIT\s*\(?TP\)?):\s*([\d.]+)', 'take_profit'),
            
            # Priority 12: @kingxauusd1 format (Tp : 4769) - with optional space before colon
            (r'(?:Tp|TP)\s*:\s*([\d.]+)', 'take_profit'),
            
            # Priority 13: Take Profit (cleaned format: "TP1: 2415.65")
            (r'(?:TP[1-9])\s*:\s*([\d.]+)', 'take_profit')
        ]
        
        for pattern, param_name in price_patterns:
            match = re.search(pattern, message_upper)
            if match:
                try:
                    # Handle different group counts for different patterns
                    if param_name == 'entry_price':
                        if len(match.groups()) == 2:
                            # Patterns with direction+instrument+number or instrument+direction+number
                            params[param_name] = float(match.group(2))
                        else:
                            # Patterns with single number group
                            params[param_name] = float(match.group(1))
                    else:
                        # For SL/TP patterns, always use group(1)
                        params[param_name] = float(match.group(1))
                except (ValueError, IndexError):
                    continue
                    
        return params
    
    def validate_price_logic(self, params: Dict[str, Optional[float]]) -> bool:
        """
        Validate that stop loss and take profit make sense for the action
        """
        if not all([params['action'], params['entry_price'], params['stop_loss'], params['take_profit']]):
            return False
            
        entry = params['entry_price']
        sl = params['stop_loss']
        tp = params['take_profit']
        
        if params['action'] == 'BUY':
            # For BUY: entry > SL and entry < TP
            return entry > sl and entry < tp
        elif params['action'] == 'SELL':
            # For SELL: entry < SL and entry > TP
            return entry < sl and entry > tp
            
        return False
    
    def make_decision(self, message: str, params: Dict[str, Optional[float]], confidence: float) -> Tuple[str, str]:
        """
        Decision Engine: Route message to appropriate output based on boolean conditions
        
        Returns:
            Tuple[str, str]: (decision, reason)
        """
        message_upper = message.upper()
        
        # Boolean condition 1: Trade direction (BUY OR SELL) - with flexible patterns
        has_direction = bool(re.search(r'(BUY|SELL|LONG|SHORT)', message_upper))
        
        # Boolean condition 2: Instrument (GOLD OR XAU OR XAUUSD) - with hashtag support
        has_instrument = bool(re.search(r'#?(GOLD|XAU|XAUUSD)', message_upper))
        
        # Boolean condition 3: Stop Loss (SL OR "STOP LOSS") - with point support
        has_sl = bool(re.search(r'(SL\.?|STOP\s*LOSS|STOP)', message_upper))
        
        # Boolean condition 4: Take Profit (TP OR TP1 OR TP2 OR TP3 OR TARGET OR "TAKE PROFIT") - with superscript and point support
        has_tp = bool(re.search(r'(TP[¹²³⁴⁵⁶⁷⁸⁹]?|TP[1-9]?\.?|TARGET|TAKE\s*PROFIT)', message_upper))
        
        # Also check extracted params if available (more reliable)
        if params:
            if params.get('action'):
                has_direction = True
            if params.get('instrument'):
                has_instrument = True
            if params.get('stop_loss'):
                has_sl = True
            if params.get('take_profit'):
                has_tp = True
        
        # All 4 conditions must be present for ACCEPT
        if has_direction and has_instrument and has_sl and has_tp:
            return 'ACCEPT', 'VALID_SIGNAL'
        
        # If it has some trading elements but missing one condition -> REVIEW
        trading_elements = sum([has_direction, has_instrument, has_sl, has_tp])
        if trading_elements >= 2:  # At least 2 trading elements
            missing_conditions = []
            if not has_direction:
                missing_conditions.append('DIRECTION')
            if not has_instrument:
                missing_conditions.append('INSTRUMENT')
            if not has_sl:
                missing_conditions.append('STOP_LOSS')
            if not has_tp:
                missing_conditions.append('TAKE_PROFIT')
            
            return 'REVIEW', f'MISSING_{",".join(missing_conditions)}'
        
        # Non-signal messages -> REJECT
        return 'REJECT', 'NO_TRADING_SIGNAL'
    
    def is_duplicate(self, channel: str, action: str, entry_price: float, timestamp: str) -> bool:
        """
        Vérifier si le signal est un doublon d'un signal existant du même canal
        
        Returns:
            bool: True si c'est un doublon, False sinon
        """
        if channel not in self.channel_signals:
            return False
        
        from datetime import datetime
        current_time = datetime.fromisoformat(timestamp)
        
        for signal in self.channel_signals[channel]:
            # Vérifier si même action
            if signal['action'] != action:
                continue
            
            # Vérifier si prix similaire (tolérance de 2$)
            price_diff = abs(signal['entry_price'] - entry_price)
            if price_diff > self.duplicate_price_tolerance:
                continue
            
            # Vérifier si dans la fenêtre de temps (5 minutes)
            signal_time = datetime.fromisoformat(signal['timestamp'])
            time_diff = abs((current_time - signal_time).total_seconds())
            if time_diff <= self.duplicate_time_window:
                return True
        
        return False
    
    def add_signal_to_tracking(self, channel: str, action: str, entry_price: float, timestamp: str):
        """Ajouter un signal au suivi pour déduplication"""
        if channel not in self.channel_signals:
            self.channel_signals[channel] = []
        
        self.channel_signals[channel].append({
            'action': action,
            'entry_price': entry_price,
            'timestamp': timestamp
        })
    
    def process_row(self, row: Dict[str, str]) -> Dict[str, str]:
        """
        Process a single message row through the complete pipeline
        """
        # Handle both old and new column formats
        message = row.get('raw_message', row.get('content', ''))
        source_channel = row.get('source_channel', row.get('source', ''))
        
        # Step 0: Clean message - but skip if message contains XAUUSD trading patterns
        if not re.search(r'XAUUSD\s*(BUY|SELL|LONG|SHORT)\s*NOW', message, re.IGNORECASE):
            message = self.clean_message(message)
        
        # Step 1: Filter Engine
        is_signal, confidence = self.filter_signal(message)
        
        # Step 2: Extraction Engine
        params = self.extract_trading_params(message)
        
        # Step 3: Decision Engine
        decision, reason = self.make_decision(message, params, confidence)
        
        # Step 4: Duplicate check for ACCEPTED signals
        if decision == 'ACCEPT' and params.get('entry_price') and params.get('action'):
            if self.is_duplicate(source_channel, params['action'], params['entry_price'], row['timestamp']):
                # Mark as duplicate instead of accept
                decision = 'DUPLICATE'
                reason = f'DUPLICATE_SIGNAL_{source_channel}'
                self.duplicates_removed += 1
            else:
                # Add to tracking for future duplicate checks
                self.add_signal_to_tracking(source_channel, params['action'], params['entry_price'], row['timestamp'])
        
        # Update counters
        self.total_processed += 1
        if decision == 'ACCEPT':
            self.accepted += 1
        elif decision == 'REVIEW':
            self.reviewed += 1
        elif decision == 'DUPLICATE':
            # Count as rejected for metrics but track separately
            self.rejected += 1
        else:
            self.rejected += 1
            
        # Return processed result
        result = {
            'message_id': row['message_id'],
            'timestamp': row['timestamp'],
            'source_channel': source_channel,
            'raw_message': message,
            'decision': decision,
            'reason': reason,
            'confidence': confidence,
            'extracted_params': params
        }
        
        return result
    
    def remove_duplicates_post_processing(self, accepted_data: List[Dict[str, str]]) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
        """
        Supprimer les doublons après le traitement complet
        """
        from datetime import datetime
        
        # Grouper par canal et action
        channel_action_groups = {}
        for signal in accepted_data:
            key = (signal['source_channel'], signal['action'])
            if key not in channel_action_groups:
                channel_action_groups[key] = []
            channel_action_groups[key].append(signal)
        
        unique_signals = []
        duplicates = []
        
        for key, signals in channel_action_groups.items():
            # Grouper par prix (avec tolérance)
            price_groups = {}
            for signal in signals:
                price = float(signal['entry_price']) if signal['entry_price'] else 0
                found_group = None
                
                for group_price, group_signals in price_groups.items():
                    if abs(price - group_price) <= self.duplicate_price_tolerance:
                        found_group = group_price
                        break
                
                if found_group is not None:
                    price_groups[found_group].append(signal)
                else:
                    price_groups[price] = [signal]
            
            # Pour chaque groupe de prix, garder le premier signal et marquer les autres comme doublons
            for price, price_signals in price_groups.items():
                if len(price_signals) > 1:
                    # Garder le premier signal (le plus ancien)
                    sorted_signals = sorted(price_signals, key=lambda x: x['timestamp'])
                    unique_signals.append(sorted_signals[0])
                    
                    # Marquer les autres comme doublons
                    for dup_signal in sorted_signals[1:]:
                        duplicates.append({
                            'duplicate_id': f"DUPLICATE_{len(duplicates)+1:03d}",
                            'message_id': dup_signal['message_id'],
                            'timestamp': dup_signal['timestamp'],
                            'source_channel': dup_signal['source_channel'],
                            'raw_message': '',  # Pas disponible dans accepted_data
                            'action': dup_signal['action'],
                            'instrument': dup_signal['instrument'],
                            'entry_price': dup_signal['entry_price'],
                            'duplicate_reason': f'DUPLICATE_{dup_signal["source_channel"]}_{dup_signal["action"]}_{dup_signal["entry_price"]}',
                            'confidence_score': dup_signal['confidence_score']
                        })
                        self.duplicates_removed += 1
                else:
                    unique_signals.append(price_signals[0])
        
        return unique_signals, duplicates

    def write_output_files(self, results: List[Dict[str, str]], output_dir: str = 'data'):
        """
        Write processed results to appropriate output CSV files
        """
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        # Prepare output data
        accepted_data = []
        reviewed_data = []
        rejected_data = []
        duplicate_data = []
        
        for i, result in enumerate(results):
            params = result['extracted_params']
            
            if result['decision'] == 'ACCEPT':
                accepted_data.append({
                    'signal_id': f"SIGNAL_{i+1:03d}",
                    'message_id': result['message_id'],
                    'timestamp': result['timestamp'],
                    'source_channel': result['source_channel'],
                    'action': params['action'],
                    'instrument': params['instrument'],
                    'entry_price': params['entry_price'],
                    'stop_loss': params['stop_loss'],
                    'take_profit': params['take_profit'],
                    'confidence_score': result['confidence'],
                    'message_type': 'TYPE_1_STRUCTURED',
                    'processing_status': 'ACCEPT'
                })
                
            elif result['decision'] == 'REVIEW':
                reviewed_data.append({
                    'review_id': f"REVIEW_{i+1:03d}",
                    'message_id': result['message_id'],
                    'timestamp': result['timestamp'],
                    'source_channel': result['source_channel'],
                    'raw_message': result['raw_message'],
                    'issue_type': result['reason'],
                    'missing_fields': 'entry_price' if params['entry_price'] is None else 'other',
                    'confidence_score': result['confidence'],
                    'review_status': 'PENDING'
                })
                
            elif result['decision'] == 'DUPLICATE':
                duplicate_data.append({
                    'duplicate_id': f"DUPLICATE_{i+1:03d}",
                    'message_id': result['message_id'],
                    'timestamp': result['timestamp'],
                    'source_channel': result['source_channel'],
                    'raw_message': result['raw_message'],
                    'action': params['action'],
                    'instrument': params['instrument'],
                    'entry_price': params['entry_price'],
                    'duplicate_reason': result['reason'],
                    'confidence_score': result['confidence']
                })
                
            else:  # REJECT
                rejected_data.append({
                    'reject_id': f"REJECT_{i+1:03d}",
                    'message_id': result['message_id'],
                    'timestamp': result['timestamp'],
                    'source_channel': result['source_channel'],
                    'raw_message': result['raw_message'],
                    'rejection_reason': result['reason'],
                    'confidence_score': result['confidence']
                })
        
        # Appliquer la déduplication post-traitement
        unique_accepted, post_duplicates = self.remove_duplicates_post_processing(accepted_data)
        duplicate_data.extend(post_duplicates)
        
        # Write CSV files
        self._write_csv(output_path / 'output_signals.csv', unique_accepted)
        self._write_csv(output_path / 'review_queue.csv', reviewed_data)
        self._write_csv(output_path / 'reject_log.csv', rejected_data)
        self._write_csv(output_path / 'duplicate_log.csv', duplicate_data)
        
        print(f"Output files written to {output_path}/")
        print(f"  - output_signals.csv: {len(unique_accepted)} signals (after deduplication)")
        print(f"  - review_queue.csv: {len(reviewed_data)} signals")
        print(f"  - duplicate_log.csv: {len(duplicate_data)} duplicates")
        print(f"  - reject_log.csv: {len(rejected_data)} signals")
    
    def _write_csv(self, filepath: Path, data: List[Dict[str, str]]):
        """Helper method to write CSV file"""
        if not data:
            return
            
        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            if data:
                fieldnames = data[0].keys()
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(data)
    
    def print_metrics(self):
        """Print processing metrics"""
        print("\n" + "="*50)
        print("PROCESSING METRICS")
        print("="*50)
        print(f"Total messages processed: {self.total_processed}")
        print(f"Accepted: {self.accepted} ({self.accepted/self.total_processed*100:.1f}%)")
        print(f"Review: {self.reviewed} ({self.reviewed/self.total_processed*100:.1f}%)")
        print(f"Rejected: {self.rejected} ({self.rejected/self.total_processed*100:.1f}%)")
        print(f"Duplicates removed: {self.duplicates_removed}")
        print("="*50)
    
    def process_csv(self, input_file: str, output_dir: str = 'data'):
        """
        Main processing method - read CSV and process all rows
        """
        print(f"Processing CSV file: {input_file}")
        
        results = []
        
        try:
            with open(input_file, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                
                for row in reader:
                    result = self.process_row(row)
                    results.append(result)
                    
        except FileNotFoundError:
            print(f"Error: Input file '{input_file}' not found")
            return
        except Exception as e:
            print(f"Error processing CSV: {e}")
            return
        
        # Write output files
        self.write_output_files(results, output_dir)
        
        # Print metrics
        self.print_metrics()

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Process trading signal CSV files')
    parser.add_argument('--input-file', '-i', 
                       default='tests/test_dataset.csv',
                       help='Input CSV file to process (default: tests/test_dataset.csv)')
    parser.add_argument('--output-dir', '-o',
                       default='data',
                       help='Output directory for results (default: data)')
    
    args = parser.parse_args()
    
    # Create processor and run
    processor = SignalProcessor()
    processor.process_csv(args.input_file, args.output_dir)

if __name__ == '__main__':
    main()
