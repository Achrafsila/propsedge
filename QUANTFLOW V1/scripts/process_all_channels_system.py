#!/usr/bin/env python3
"""
Traiter tous les canaux avec le système existant (ACCEPT/REVIEW/REJECT)
"""

import sys
import os
from pathlib import Path
import json
import asyncio
import csv
from datetime import datetime, date

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from telethon import TelegramClient
from batch_processor import SignalProcessor
from google_sheets_uploader import GoogleSheetsUploader
from image_signal_extractor import ImageSignalExtractor

async def collect_and_process_all_channels():
    """Collecter et traiter tous les messages avec le système existant"""
    print("Collecte et traitement des messages avec système existant...")
    print("=" * 60)
    
    api_id = "38456630"
    api_hash = "4b2a85354b6e6d4103820dc92b522b53"
    phone = "+212688434773"
    
    # Use absolute path for session file
    session_path = str(Path(__file__).parent.parent / 'sessions' / 'telegram_session.session')
    client = TelegramClient(session_path, api_id, api_hash)
    
    # Initialize image signal extractor with OCR and vision enabled
    image_extractor = ImageSignalExtractor(use_ocr=True, ocr_engine='easyocr', use_vision=True)
    temp_images_dir = str(Path(__file__).parent.parent / 'data' / 'temp_images')
    
    try:
        await client.start(phone=phone)
        print("Connecté à Telegram!")
        
        # Charger la liste des canaux
        data_path = str(Path(__file__).parent.parent / 'data' / 'all_channels.json')
        with open(data_path, 'r', encoding='utf-8') as f:
            channels = json.load(f)
        
        # Date du jour et heure actuelle (no time filtering for 5000 messages)
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        target_date = now.date()
        print(f"Date cible: {target_date.strftime('%d/%m/%Y')}")
        print(f"Collecte des 5000 derniers messages (sans filtre temporel)")
        
        # Préparer les données pour le CSV (format du système existant)
        csv_data = []
        total_messages = 0
        
        print(f"\n--- Collecte des messages de {len(channels)} canaux ---\n")
        
        for i, channel in enumerate(channels, 1):
            print(f"[{i}/{len(channels)}] Canal: {channel['title']}")
            
            try:
                # Use username instead of ID for better compatibility
                channel_identifier = channel['username'] if channel['username'] != 'N/A' else channel['id']
                entity = await client.get_entity(channel_identifier)
                
                # Récupérer les 6 derniers messages pour test
                messages = await client.get_messages(entity, limit=6)
                
                for msg in messages:
                        # Format du système existant
                        message_data = {
                            'message_id': f"MSG_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{msg.id}",
                            'timestamp': msg.date.isoformat(),
                            'source_channel': channel['title'],
                            'raw_message': msg.text if msg.text else '',
                            'message_type': 'TELEGRAM',
                            'processing_status': 'PENDING'
                        }
                        
                        # Check if message has images and process them with OCR
                        if msg.media and hasattr(msg.media, 'photo'):
                            try:
                                # Download image
                                image_path = os.path.join(temp_images_dir, f"image_{msg.id}.jpg")
                                Path(temp_images_dir).mkdir(parents=True, exist_ok=True)
                                
                                await client.download_media(msg.media, file=image_path)
                                print(f"  -> Downloaded image: {image_path}")
                                
                                # Extract signal from image using OCR
                                image_signal = image_extractor.extract_signal_from_image(image_path)
                                
                                if image_signal.confidence > 0.3:  # Only use if confidence is reasonable
                                    # Add extracted signal to message
                                    if image_signal.action:
                                        message_data['raw_message'] += f" [IMAGE: {image_signal.action}]"
                                    if image_signal.entry_price:
                                        message_data['raw_message'] += f" ENTRY: {image_signal.entry_price}"
                                    if image_signal.stop_loss:
                                        message_data['raw_message'] += f" SL: {image_signal.stop_loss}"
                                    if image_signal.take_profit:
                                        message_data['raw_message'] += f" TP: {image_signal.take_profit}"
                                    
                                    print(f"  -> Image signal extracted: confidence={image_signal.confidence:.2f}")
                                
                                # Clean up temporary image
                                if os.path.exists(image_path):
                                    os.remove(image_path)
                                    
                            except Exception as e:
                                print(f"  -> Error processing image: {e}")
                        
                        csv_data.append(message_data)
                        total_messages += 1
                
                print(f"  -> {sum(1 for msg in messages if msg.date and msg.date.date() == target_date)} messages trouvés")
                
            except Exception as e:
                print(f"  -> Erreur: {str(e)[:50]}...")
            
            # Petite pause
            await asyncio.sleep(0.3)
        
        print(f"\n--- Sauvegarde des messages au format CSV ---")
        print(f"Total messages: {total_messages}")
        
        # Créer le fichier CSV au format du système existant
        input_csv = Path(__file__).parent.parent / 'data' / 'telegram_messages_all_channels.csv'
        input_csv.parent.mkdir(exist_ok=True)
        
        with open(input_csv, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['message_id', 'timestamp', 'source_channel', 'raw_message', 'message_type', 'processing_status']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(csv_data)
        
        print(f"Fichier CSV créé: {input_csv}")
        
        await client.disconnect()
        
    except Exception as e:
        print(f"Erreur lors de la collecte: {e}")
        return

    # Traitement avec le système existant
    print(f"\n--- Traitement avec le système existant ---")
    
    try:
        # Utiliser le batch_processor existant
        processor = SignalProcessor()
        output_dir = str(Path(__file__).parent.parent / 'data')
        processor.process_csv(str(input_csv), output_dir)
        
        print(f"\n--- Fichiers de sortie générés ---")
        print(f"1. output_signals.csv (ACCEPT)")
        print(f"2. review_queue.csv (REVIEW)")
        print(f"3. reject_log.csv (REJECT)")
        
        # Afficher les résultats
        print(f"\n--- RÉSULTATS DU TRAITEMENT ---")
        print(f"Total messages traités: {processor.total_processed}")
        print(f"ACCEPT: {processor.accepted} ({processor.accepted/processor.total_processed*100:.1f}%)")
        print(f"REVIEW: {processor.reviewed} ({processor.reviewed/processor.total_processed*100:.1f}%)")
        print(f"REJECT: {processor.rejected} ({processor.rejected/processor.total_processed*100:.1f}%)")
        
        # Lire et afficher les détails
        print(f"\n--- DÉTAILS DES SIGNAUX ACCEPTÉS ---")
        output_signals_path = Path(__file__).parent.parent / 'data' / 'output_signals.csv'
        if os.path.exists(output_signals_path):
            with open(output_signals_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for i, row in enumerate(reader, 1):
                    print(f"{i}. {row['source_channel']} - {row['action']} {row['instrument']} @ {row['entry_price']}")
                    if i >= 10:  # Limiter l'affichage
                        print(f"... et {sum(1 for _ in reader)} autres")
                        break
        
        print(f"\n--- DÉTAILS DES SIGNAUX EN REVIEW ---")
        review_queue_path = Path(__file__).parent.parent / 'data' / 'review_queue.csv'
        if os.path.exists(review_queue_path):
            with open(review_queue_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                review_count = 0
                for i, row in enumerate(reader, 1):
                    print(f"{i}. {row['source_channel']} - {row['issue_type']}")
                    review_count += 1
                    if i >= 10:  # Limiter l'affichage
                        print(f"... et {sum(1 for _ in reader)} autres")
                        break
                print(f"Total REVIEW: {review_count}")
        
        # Upload automatique vers Google Sheets
        print(f"\n--- UPLOAD VERS GOOGLE SHEETS ---")
        try:
            credentials_file = str(Path(__file__).parent.parent / 'data' / 'credentials.json')
            if os.path.exists(credentials_file):
                uploader = GoogleSheetsUploader(credentials_file)
                
                if uploader.authenticate():
                    print("Authentification réussie")
                    
                    # Utiliser le spreadsheet ID
                    SPREADSHEET_ID = "1aW3iNaFV_VKG5JwhXfOrPHZnT9Ag1jGnvLw6-Xe8osg"
                    
                    if uploader.open_spreadsheet(SPREADSHEET_ID):
                        success = uploader.upload_all_results(output_dir)
                        if success:
                            print("Upload réussi vers Google Sheets!")
                        else:
                            print("Échec de l'upload")
                else:
                    print("Échec de l'authentification")
            else:
                print("Fichier credentials.json non trouvé")
                print("Veuillez configurer Google Sheets")
        except Exception as e:
            print(f"Erreur lors de l'upload: {e}")
        
    except Exception as e:
        print(f"Erreur lors du traitement: {e}")

if __name__ == '__main__':
    asyncio.run(collect_and_process_all_channels())
