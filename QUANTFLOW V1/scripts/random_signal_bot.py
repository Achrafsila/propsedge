#!/usr/bin/env python3
"""
Telegram Bot that sends random trading signals every minute
with different statuses: Accepted, To review, Rejected, To test
"""

import random
import asyncio
from datetime import datetime
from telegram import Bot, Update
from telegram.ext import Application, CommandHandler, ContextTypes

# Configuration - Replace with your bot token from @BotFather
BOT_TOKEN = "8574070715:AAEKm1WyYPLRzd-uYtz0skgXripiORN8ljo"
CHAT_ID = "@quantflowtest"  # Can be a user ID, group ID, or channel username

# Trading pairs and actions
FOREX_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD',
               'XAUUSD', 'XAGUSD', 'BTCUSD', 'ETHUSD']
ACTIONS = ['BUY', 'SELL', 'LONG', 'SHORT']

# Fake/hype signals
FAKE_SIGNALS = [
    "🚀 GOLD IS FLYING TO THE MOON! 🚀",
    "💰 GOLD MASSIVE PUMP COMING! 💰",
    "🔥 GOLD BREAKOUT IMMINENT! 🔥",
    "⚡ GOLD EXPLOSIVE MOVE! ⚡",
    "📈 GOLD READY TO SOAR! 📈",
    "🌟 GOLD PARABOLIC MOVE! 🌟",
]

# Signal statuses (for internal use, not shown in messages)
STATUSES = ['Accepted', 'To review', 'Rejected', 'To test']

def generate_quantflow_format():
    """Generate signal in QuantFlow bot format"""
    pair = random.choice(['XAUUSD', 'GOLD', 'USDCAD', 'EURUSD'])
    action = random.choice(['BUY', 'SELL', 'LONG', 'SHORT'])
    
    if 'XAU' in pair or pair == 'GOLD':
        price = round(random.uniform(2300, 2400), 2)
        targets = [round(price + random.uniform(10, 30), 2) for _ in range(random.randint(1, 3))]
        stop_loss = round(price - random.uniform(10, 20), 2)
    else:
        price = round(random.uniform(1.0, 1.5), 5)
        targets = [round(price + random.uniform(0.001, 0.01), 5) for _ in range(random.randint(1, 3))]
        stop_loss = round(price - random.uniform(0.001, 0.005), 5)
    
    timestamp = datetime.now().strftime("%Y %m %d %H:%M:%S")
    
    message = f"""TRADING SIGNAL Pair: {pair} Action: {action} Entry: {price} Targets: """
    for i, target in enumerate(targets, 1):
        message += f"TP{i}: {target} "
    message += f"Stop Loss: {stop_loss} {timestamp}"""
    
    return message

def generate_kingxauusd_format():
    """Generate signal in King XAUUSD format"""
    action = random.choice(['BUY', 'SELL'])
    price = round(random.uniform(2300, 2400), 2)
    stop_loss = round(price + random.uniform(5, 15) if action == 'SELL' else price - random.uniform(5, 15), 2)
    take_profit = round(price - random.uniform(10, 30) if action == 'SELL' else price + random.uniform(10, 30), 2)
    
    message = f"""**XAUUSD {action} NOW {price}****✅****
Sl : {stop_loss} ( {abs(stop_loss - price):.0f} pip )
Tp : {take_profit}"""
    
    return message

def generate_result_message():
    """Generate result/hype message"""
    pips = random.randint(20, 800)
    messages = [
        f"Running {pips} pip ❤️‍🔥🫡⤵️",
        f"Tp Hit , Running {pips} PIP ****✅**",
        f"**Tp Hit , Running {pips} PIP ****✅**",
        f"Running {pips} pip ❤️‍🔥🫡",
        f"Tp Hit , Running {pips} PIP",
    ]
    return random.choice(messages)

def generate_fake_signal():
    """Generate a fake hype signal"""
    fake_msg = random.choice(FAKE_SIGNALS)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    message = f"""{fake_msg}
━━━━━━━━━━━━━━━━━━━━━━
⏰ {timestamp}
"""
    return message

def generate_random_signal():
    """Generate a random trading signal in various formats inspired by collected channels"""
    # Randomly choose message format:
    # 40% QuantFlow format, 30% King XAUUSD format, 15% original format, 10% result messages, 5% hype
    format_choice = random.random()
    
    if format_choice < 0.40:
        return generate_quantflow_format()
    elif format_choice < 0.70:
        return generate_kingxauusd_format()
    elif format_choice < 0.85:
        # Original format (keep for compatibility)
        return generate_original_format()
    elif format_choice < 0.95:
        return generate_result_message()
    else:
        return generate_fake_signal()

def generate_original_format():
    """Generate signal in original bot format (for compatibility)"""
    # 70% chance of Gold signal, 30% other pairs
    if random.random() < 0.7:
        pair = 'XAUUSD'
    else:
        pair = random.choice([p for p in FOREX_PAIRS if p != 'XAUUSD'])
    
    # Generate regular trading signal
    action = random.choice(ACTIONS)
    
    # Generate realistic price based on pair
    if 'XAU' in pair:
        price = round(random.uniform(2300, 2400), 2)
    elif 'BTC' in pair:
        price = round(random.uniform(60000, 70000), 2)
    elif 'ETH' in pair:
        price = round(random.uniform(3000, 4000), 2)
    else:
        price = round(random.uniform(1.0, 1.5), 5)
    
    # Generate targets and stop loss
    # 30% chance of bad signal (to reject/review quality)
    if random.random() < 0.3:
        # Bad signal: unrealistic targets or poor risk/reward
        if 'XAU' in pair:
            targets = [round(price + random.uniform(100, 200), 2) for _ in range(random.randint(2, 4))]
            stop_loss = round(price - random.uniform(50, 100), 2)
        elif 'BTC' in pair:
            targets = [round(price + random.uniform(10000, 20000), 2) for _ in range(random.randint(2, 4))]
            stop_loss = round(price - random.uniform(5000, 10000), 2)
        elif 'ETH' in pair:
            targets = [round(price + random.uniform(2000, 5000), 2) for _ in range(random.randint(2, 4))]
            stop_loss = round(price - random.uniform(1000, 2000), 2)
        else:
            targets = [round(price + random.uniform(0.1, 0.5), 5) for _ in range(random.randint(2, 4))]
            stop_loss = round(price - random.uniform(0.05, 0.1), 5)
    else:
        # Good signal: realistic targets and risk/reward
        if 'XAU' in pair:
            targets = [round(price + random.uniform(10, 30), 2) for _ in range(random.randint(1, 3))]
            stop_loss = round(price - random.uniform(10, 20), 2)
        elif 'BTC' in pair:
            targets = [round(price + random.uniform(1000, 3000), 2) for _ in range(random.randint(1, 3))]
            stop_loss = round(price - random.uniform(500, 1500), 2)
        elif 'ETH' in pair:
            targets = [round(price + random.uniform(100, 300), 2) for _ in range(random.randint(1, 3))]
            stop_loss = round(price - random.uniform(50, 150), 2)
        else:
            targets = [round(price + random.uniform(0.001, 0.01), 5) for _ in range(random.randint(1, 3))]
            stop_loss = round(price - random.uniform(0.001, 0.005), 5)
    
    # Format the signal message
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    message = f"""📊 *TRADING SIGNAL*
━━━━━━━━━━━━━━━━━━━━━━
🔹 *Pair:* {pair}
🔹 *Action:* {action}
🔹 *Entry:* {price}
━━━━━━━━━━━━━━━━━━━━━━
🎯 *Targets:*
"""
    for i, target in enumerate(targets, 1):
        message += f"  TP{i}: {target}\n"
    
    message += f"""🛑 *Stop Loss:* {stop_loss}
━━━━━━━━━━━━━━━━━━━━━━
⏰ {timestamp}
"""
    
    return message

async def send_signal(bot: Bot):
    """Send a random signal"""
    signal = generate_random_signal()
    try:
        await bot.send_message(chat_id=CHAT_ID, text=signal, parse_mode='Markdown')
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Signal sent successfully")
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Error sending signal: {e}")

async def signal_scheduler(bot: Bot):
    """Scheduler that sends a signal every 5 seconds for testing"""
    while True:
        await send_signal(bot)
        await asyncio.sleep(5)  # Wait 5 seconds for testing

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    await update.message.reply_text(
        "🤖 *Random Signal Bot Started*\n\n"
        "I will send random trading signals every 5 seconds (TESTING MODE)\n"
        "without status - for model filtering and classification.\n\n"
        "Use /stop to stop the bot.",
        parse_mode='Markdown'
    )

async def stop_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /stop command"""
    await update.message.reply_text("🛑 Bot stopped. Use /start to restart.")
    # Note: This won't actually stop the scheduler in this simple implementation
    # You would need to implement proper state management for that

async def manual_signal_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /signal command to send a signal immediately"""
    signal = generate_random_signal()
    await update.message.reply_text(signal, parse_mode='Markdown')

async def main():
    """Main function to run the bot"""
    # Create the Application
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Add command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("stop", stop_command))
    application.add_handler(CommandHandler("signal", manual_signal_command))
    
    # Initialize the application first
    await application.initialize()
    
    # Start the signal scheduler
    scheduler_task = asyncio.create_task(signal_scheduler(application.bot))
    
    # Start the bot
    print("🤖 Random Signal Bot starting...")
    print(f"📱 Bot will send signals to chat ID: {CHAT_ID}")
    print("⏰ Signals will be sent every 5 seconds (TESTING MODE)")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    # Start polling
    await application.start()
    await application.updater.start_polling()
    
    # Keep running
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    finally:
        await application.updater.stop()
        await application.stop()
        await application.shutdown()

if __name__ == '__main__':
    asyncio.run(main())
