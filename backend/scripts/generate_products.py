"""Fills in a plausible `last_product_purchased` for seeded (historical) customers,
picked from their real `prefered_order_cat`. The source training CSV only ever had
category-level data (no per-product purchase history), so these are example products
for that category — not verified purchases — and are clearly flagged as such via
`last_product_purchased_is_generated=True`.

Never touches a customer who already has a value (whether typed by an admin via the
Predict Customer form, or previously generated), and never touches customers created
via that form even if they left the field blank — only rows with a ground-truth
`actual_churn` label (i.e. the seeded training-set customers) are eligible.

Run with: python scripts/generate_products.py [--reset]
"""

import argparse
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.customer import Customer

PRODUCTS_BY_CATEGORY: dict[str, list[str]] = {
    "Mobile Phone": [
        "iPhone 14",
        "Samsung Galaxy S23",
        "OnePlus 11",
        "Xiaomi Redmi Note 12",
        "Google Pixel 7a",
        "Vivo V27",
        "Oppo Reno 8",
    ],
    "Mobile": [
        "Wireless Earbuds",
        "Phone Case & Cover",
        "Tempered Glass Screen Protector",
        "20000mAh Power Bank",
        "Bluetooth Speaker",
        "Car Phone Mount",
        "Fast Charging Cable",
    ],
    "Fashion": [
        "Men's Casual Shirt",
        "Women's Summer Dress",
        "Running Shoes",
        "Denim Jacket",
        "Leather Handbag",
        "Sunglasses",
        "Cotton T-Shirt Pack",
    ],
    "Grocery": [
        "Organic Rice 5kg",
        "Assorted Spice Pack",
        "Cooking Oil 1L",
        "Instant Noodles Pack",
        "Fresh Fruit Basket",
        "Green Tea Box",
        "Breakfast Cereal Combo",
    ],
    "Laptop & Accessory": [
        "Dell Inspiron 15 Laptop",
        "HP Pavilion Laptop",
        "Laptop Backpack",
        "Wireless Mouse",
        "USB-C Hub",
        "Laptop Cooling Pad",
        "27\" Monitor",
    ],
    "Others": [
        "Home Decor Set",
        "Kitchen Utensil Set",
        "Fitness Tracker",
        "Desk Lamp",
        "Yoga Mat",
        "Insulated Water Bottle",
        "Bluetooth Headphones",
    ],
}
FALLBACK_PRODUCTS = ["Store Gift Card", "Best-seller Bundle"]


def generate_products(reset: bool = False) -> int:
    db = SessionLocal()
    try:
        query = db.query(Customer).filter(Customer.actual_churn.isnot(None))
        if not reset:
            query = query.filter(Customer.last_product_purchased.is_(None))

        rows = query.all()
        rng = random.Random(42)  # deterministic — re-running without --reset is a no-op anyway

        count = 0
        for customer in rows:
            options = PRODUCTS_BY_CATEGORY.get(customer.prefered_order_cat, FALLBACK_PRODUCTS)
            customer.last_product_purchased = rng.choice(options)
            customer.last_product_purchased_is_generated = True
            count += 1

            if count % 1000 == 0:
                db.commit()
                print(f"  generated {count} products...")

        db.commit()
        print(f"Done: generated products for {count} customers.")
        return count
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--reset", action="store_true", help="overwrite existing generated products too"
    )
    args = parser.parse_args()
    generate_products(reset=args.reset)
