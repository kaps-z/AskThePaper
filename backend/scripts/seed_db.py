import asyncio
import os
import sys

# Add the 'backend' directory to the Python path so we can import 'app'
# This allows running the script from anywhere via `python scripts/seed_db.py`
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def seed_database():
    """
    Seeds the MongoDB database with default system configuration.
    If the configuration already exists, it does nothing.
    """
    print(f"Connecting to MongoDB at {settings.MONGODB_URL}...")
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    
    config_collection = db["system_config"]
    
    # We only want one config document in the system. Use a hardcoded string ID.
    config_id = "global_config"
    
    existing_config = await config_collection.find_one({"_id": config_id})
    if existing_config:
        print("System configuration already exists. Seeding skipped.")
        print(f"Current Config: {existing_config}")
        return

    default_config = {
        "_id": config_id,
        "chunking": {
            "active": "semantic",
            "options": ["semantic", "llm"]
        },
        "embedding": {
            "active": "gemini",
            "options": ["gemini", "openai", "huggingface"]
        },
        "evaluation": {
            "active": "ragas",
            "options": ["ragas", "custom"]
        }
    }
    
    await config_collection.insert_one(default_config)
    print("Successfully seeded the default system configuration!")
    print(f"Seeded Document: {default_config}")

if __name__ == "__main__":
    asyncio.run(seed_database())
