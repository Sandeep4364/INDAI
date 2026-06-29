import re

# Equipment ID patterns common in industrial docs
EQUIPMENT_PATTERNS = [
    r'\b[A-Z]{1,3}-?\d{3,5}\b',        # P-101, C201, HX-1001
    r'\b(Pump|Compressor|Boiler|Motor|Valve|Tank|HX|FAN)\s*[A-Z]?\d+\b',
]

DATE_PATTERN = r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b'

FAILURE_KEYWORDS = [
    "failure", "fault", "breakdown", "vibration", "leak",
    "overheating", "corrosion", "wear", "crack", "trip"
]

def extract_entities(text: str) -> dict:
    equipment_ids = []
    for pattern in EQUIPMENT_PATTERNS:
        found = re.findall(pattern, text, re.IGNORECASE)
        equipment_ids.extend(found)

    dates = re.findall(DATE_PATTERN, text)

    text_lower = text.lower()
    failures = [kw for kw in FAILURE_KEYWORDS if kw in text_lower]

    return {
        "equipment_ids": list(set(equipment_ids)),
        "dates": list(set(dates)),
        "failure_keywords": failures
    }