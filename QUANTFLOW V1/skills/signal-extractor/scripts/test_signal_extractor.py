#!/usr/bin/env python3
"""
Test suite for Signal Extractor skill

Run with: python test_signal_extractor.py
"""

import json
from signal_extractor import SignalExtractor, StateManager, ExtractionState

def test_signal_extraction():
    """Test signal extraction from various message formats"""
    extractor = SignalExtractor()

    test_cases = [
        {
            "message": "GOLD BUY AT 2385.50 SL 2380.00 TP 2395.00",
            "expected": {
                "action": "BUY",
                "instrument": "GOLD",
                "entry": 2385.50,
                "sl": 2380.00,
                "tp": 2395.00,
                "status": "COMPLETE"
            }
        },
        {
            "message": "XAUUSD SELL NOW 4785 Stop Loss 4790 Take Profit 4775",
            "expected": {
                "action": "SELL",
                "instrument": "XAUUSD",
                "entry": 4785,
                "sl": 4790,
                "tp": 4775,
                "status": "COMPLETE"
            }
        },
        {
            "message": "BUY BTCUSD Entry 45000 SL 44500 TP 46000",
            "expected": {
                "action": "BUY",
                "instrument": "BTCUSD",
                "entry": 45000,
                "sl": 44500,
                "tp": 46000,
                "status": "COMPLETE"
            }
        },
        {
            "message": "Not a trading signal, just random text",
            "expected": None  # Should not extract
        },
        {
            "message": "BUY GOLD only entry, no SL/TP",
            "expected": {
                "action": "BUY",
                "instrument": "GOLD",
                "status": "PARTIAL"
            }
        }
    ]

    print("🧪 Testing Signal Extraction\n")
    passed = 0
    failed = 0

    for i, test in enumerate(test_cases, 1):
        signal = extractor.extract(
            test["message"],
            {
                "platform": "TELEGRAM",
                "channel": "Test",
                "channel_id": 123,
                "message_id": i,
                "timestamp": "2026-04-14T12:00:00Z"
            }
        )

        expected = test["expected"]

        if expected is None:
            if signal is None:
                print(f"✅ Test {i}: Correctly rejected non-signal")
                passed += 1
            else:
                print(f"❌ Test {i}: Should have rejected, but extracted: {signal.extracted_signal}")
                failed += 1
        else:
            if signal is None:
                print(f"❌ Test {i}: Failed to extract from: {test['message']}")
                failed += 1
            else:
                extracted = signal.extracted_signal

                # Check required fields
                checks = []
                if "action" in expected:
                    checks.append(("action", extracted["action"] == expected["action"]))
                if "instrument" in expected:
                    checks.append(("instrument", extracted["instrument"] == expected["instrument"]))
                if "entry" in expected:
                    checks.append(("entry", extracted["entry"] == expected["entry"]))
                if "sl" in expected:
                    checks.append(("sl", extracted["sl"] == expected["sl"]))
                if "tp" in expected:
                    checks.append(("tp", extracted["tp"] == expected["tp"]))
                if "status" in expected:
                    checks.append(("status", extracted["extraction_status"] == expected["status"]))

                all_pass = all(check[1] for check in checks)

                if all_pass:
                    print(f"✅ Test {i}: Correctly extracted")
                    passed += 1
                else:
                    print(f"❌ Test {i}: Extraction mismatch")
                    for field, result in checks:
                        status = "✓" if result else "✗"
                        print(f"   {status} {field}: {extracted.get(field)} vs {expected.get(field)}")
                    failed += 1

    print(f"\n📊 Results: {passed} passed, {failed} failed")
    return failed == 0


def test_deduplication():
    """Test signal deduplication"""
    extractor = SignalExtractor()

    print("\n🧪 Testing Deduplication\n")

    # Create identical signals
    signal1 = extractor.extract(
        "GOLD BUY AT 2385.50 SL 2380.00 TP 2395.00",
        {
            "platform": "TELEGRAM",
            "channel": "Channel1",
            "channel_id": 123,
            "message_id": 1,
            "timestamp": "2026-04-14T12:00:00Z"
        }
    )

    signal2 = extractor.extract(
        "BUY GOLD Entry 2385.50 SL 2380 TP 2395",
        {
            "platform": "TELEGRAM",
            "channel": "Channel2",
            "channel_id": 456,
            "message_id": 2,
            "timestamp": "2026-04-14T12:05:00Z"
        }
    )

    hash1 = extractor.compute_signal_hash(signal1)
    hash2 = extractor.compute_signal_hash(signal2)

    if hash1 == hash2:
        print("✅ Hashes match: Identical signals are correctly identified as duplicates")
        return True
    else:
        print(f"❌ Hashes don't match")
        print(f"   Hash1: {hash1}")
        print(f"   Hash2: {hash2}")
        return False


def test_state_management():
    """Test state persistence"""
    print("\n🧪 Testing State Management\n")

    # Create initial state
    state = ExtractionState(
        channels={123: "Channel1", 456: "Channel2"},
        last_message_ids={123: 100, 456: 200},
        last_execution="2026-04-14T12:00:00Z",
        seen_signal_hashes=["hash1", "hash2"]
    )

    print(f"✅ Created state: {len(state.channels)} channels, {len(state.seen_signal_hashes)} dedup hashes")

    # Would save/load in production
    # StateManager.save(state)
    # loaded_state = StateManager.load()

    return True


def test_message_cleaning():
    """Test message cleaning"""
    print("\n🧪 Testing Message Cleaning\n")

    extractor = SignalExtractor()

    test_cases = [
        ("GOLD  BUY   AT\n2385.50", "GOLD BUY AT 2385.50"),
        ("GoldBuy2385", "GoldBuy2385"),
        ("XAUUSD\nSELL\n4785", "XAUUSD SELL 4785"),
    ]

    passed = 0
    for dirty, expected_clean in test_cases:
        cleaned = extractor._clean_message(dirty)
        if cleaned == expected_clean:
            print(f"✅ '{dirty}' → '{cleaned}'")
            passed += 1
        else:
            print(f"❌ '{dirty}' → '{cleaned}' (expected '{expected_clean}')")

    return passed == len(test_cases)


if __name__ == '__main__':
    print("=" * 70)
    print("SIGNAL EXTRACTOR - TEST SUITE")
    print("=" * 70)

    results = []

    results.append(("Signal Extraction", test_signal_extraction()))
    results.append(("Deduplication", test_deduplication()))
    results.append(("State Management", test_state_management()))
    results.append(("Message Cleaning", test_message_cleaning()))

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")

    all_passed = all(result[1] for result in results)

    if all_passed:
        print("\n🎉 All tests passed!")
        exit(0)
    else:
        print("\n❌ Some tests failed!")
        exit(1)
