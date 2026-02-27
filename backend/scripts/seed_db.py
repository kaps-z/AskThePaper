import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.chunking import AVAILABLE_STRATEGIES

CORRECT_CONFIG = {
    "_id": "global_config",
    "chunking": {
        "active_strategies": ["recursive"],
        "options": AVAILABLE_STRATEGIES    # always in sync with chunking.py
    },
    "embedding": {
        "active": "all-MiniLM-L6-v2",
        "options": ["all-MiniLM-L6-v2"]
    },
    "evaluation": {
        "active": "custom",
        "options": ["custom", "ragas"]
    }
}

async def seed_database(force: bool = False):
    """
    Seeds (or force-updates) the MongoDB global config.

    Args:
        force: If True, replaces the existing config even if it exists.
               Run with `python scripts/seed_db.py --force` to fix a stale config.
    """
    print(f"Connecting to MongoDB at {settings.MONGODB_URL}...")
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    existing = await db["system_config"].find_one({"_id": "global_config"})

    if existing and not force:
        # Check if the stored options match the current code
        stored_options = set(existing.get("chunking", {}).get("options", []))
        current_options = set(AVAILABLE_STRATEGIES)
        if stored_options == current_options:
            print("✅ Config is already up-to-date. Seeding skipped.")
            print(f"   Config: {existing}")
        else:
            print(f"⚠️  Stale config detected!")
            print(f"   Stored options:  {sorted(stored_options)}")
            print(f"   Current options: {sorted(current_options)}")
            print("   Re-run with `--force` to update: python scripts/seed_db.py --force")
        client.close()
        return

    if existing:
        await db["system_config"].delete_one({"_id": "global_config"})
        print("🗑️  Removed old config.")

    await db["system_config"].insert_one(CORRECT_CONFIG)
    print("✅ Config seeded successfully!")
    print(f"   Strategies: {AVAILABLE_STRATEGIES}")
    print(f"   Default active: {CORRECT_CONFIG['chunking']['active_strategies']}")
    client.close()


if __name__ == "__main__":
    force = "--force" in sys.argv
    asyncio.run(seed_database(force=force))
