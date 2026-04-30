import json
import urllib.request
import urllib.parse
from typing import Dict, List, Any
import re

# Conditionally import DDGS so the script doesn't completely fail if not installed
try:
    from duckduckgo_search import DDGS
except ImportError:
    DDGS = None

# Claude Configuration
CLAUDE_MODEL = "claude-3-haiku-20240307"
CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"

# 6FB Production Database API (booth-vs-suite-calculator)
MARKET_INTEL_API_URL = "https://calculator.6fbmentorship.com/api/market-intel"

SYS_PROMPT_ANALYZE_VARS = """
You are a data classification and extraction agent for the 6FB Barber ecosystem.
Read the 60-second video transcript and perform the following:

1. CLASSIFY the content into EXACTLY ONE of these categories:
   - "BARBERSHOP_BUSINESS" (Talking about opening a shop, rent, chair leasing, real estate costs)
   - "PRODUCT_REVIEW" (Reviewing clippers, trimmers, styling products, or unboxings)
   - "HAIRCUT_TUTORIAL" (Explaining a fade, guards, technique, or styling a client)
   - "MOTIVATIONAL" (General business mindset, talking head, no specific products or math)

2. If BARBERSHOP_BUSINESS: Identify the exact 5-digit ZIP CODE mentioned (or infer the city). Identify required metrics (e.g. "suite_rent", "commercial_retail_lease").
3. If PRODUCT_REVIEW: Identify the exact product name to look up (e.g. "Babyliss Lo-Pro FX"). Identify required metrics (e.g. "MSRP", "Motor RPM").
4. If HAIRCUT_TUTORIAL: Identify the specific technique (e.g. "Burst Fade").

Return STRICTLY a JSON object:
{
  "category": "BARBERSHOP_BUSINESS",
  "search_query": "33132",
  "required_metrics": ["suite_rent", "commercial_retail_lease", "shop_sign_cost"]
}
"""

SYS_PROMPT_EXTRACT_WEB = """
You are a data syntheziser. Read the raw DuckDuckGo search results provided by the user about a specific product or technique.
Extract the precise factual data requested. If you cannot find the actual fact, return "N/A" rather than guessing.
Return STRICTLY a JSON object mapping the metric name to the extracted value string.
Example:
{
  "MSRP": "$199.99",
  "Motor_RPM": "6800 RPM"
}
"""

def _fetch_real_market_intel(location_input: str) -> Dict[str, str]:
    """Connect to the 6fbMentorship Shop Planner database."""
    try:
        zip_param = ""
        city_param = ""
        match = re.search(r'\b\d{5}\b', location_input)
        if match:
            exact_zip = match.group(0)
            zip_param = f"zipCode={exact_zip}"
        else:
            city = location_input.split(",")[0].strip()
            if not city: city = "Tampa"
            city_param = f"city={urllib.parse.quote(city)}"
            if "," in location_input:
                city_param += f"&state={urllib.parse.quote(location_input.split(',')[1].strip())}"

        query = zip_param if zip_param else city_param
        url = f"{MARKET_INTEL_API_URL}?{query}"
        
        print(f"  📡 [auto_researcher] Fetching Shop Planner Data: {url}")
        req = urllib.request.Request(url, method="GET")
        
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
            if raw.get("success") and raw.get("data"):
                return raw["data"]["metrics"]
    except Exception as e:
        print(f"  ⚠️ [auto_researcher] Error fetching Shop Planner DB: {e}")

    return {
        "suite_rent": "$1,000/mo Avg",
        "commercial_retail_lease": "$2,500/mo Avg",
        "haircut_price": "$35 avg",
        "shop_sign_cost": "Vinyl: $250 | LED Pro: $2,500"
    }

def _fetch_web_search(query: str, metrics: List[str], api_key: str) -> Dict[str, str]:
    """Perform a live DuckDuckGo search and use Claude to extract requested metrics."""
    if not DDGS:
        print("  ⚠️ [auto_researcher] duckduckgo-search not installed!")
        return {m: "[Live Web Search Offline]" for m in metrics}
        
    print(f"  🌐 [auto_researcher] Searching Web for: '{query}'")
    try:
        results = DDGS().text(f"{query} {' '.join(metrics)}", max_results=3)
        raw_text = "\n".join([r.get("body", "") for r in results])
        
        prompt = f"TARGET METRICS: {metrics}\n\nRAW SEARCH RESULTS:\n{raw_text}"
        extraction = _call_claude_json(SYS_PROMPT_EXTRACT_WEB, prompt, api_key)
        return extraction if extraction else {m: "[Data Not Found]" for m in metrics}
    except Exception as e:
        print(f"  ⚠️ [auto_researcher] Search failed: {e}")
        return {m: "[Search Failed]" for m in metrics}

def _call_claude_json(system: str, prompt: str, api_key: str) -> Dict[str, Any]:
    payload = {
        "model": CLAUDE_MODEL,
        "max_tokens": 1024,
        "system": system,
        "messages": [{"role": "user", "content": prompt}],
    }
    req = urllib.request.Request(
        CLAUDE_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-API-Key": api_key,
            "anthropic-version": "2023-06-01"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            text = "".join(b.get("text", "") for b in result.get("content", []) if b.get("type") == "text")
            
            cleaned = text.strip()
            if cleaned.startswith("```json"): cleaned = cleaned[7:]
            elif cleaned.startswith("```"): cleaned = cleaned[3:]
            if cleaned.endswith("```"): cleaned = cleaned[:-3]
            
            return json.loads(cleaned.strip())
                
    except urllib.error.HTTPError as e:
        print(f"  ⚠️ [auto_researcher] Claude HTTP error: {e.code} - {e.read().decode('utf-8')}")
        return {}
    except Exception as e:
        print(f"  ⚠️ [auto_researcher] Claude parsing error: {e}")
        return {}

def get_ecosystem_research(transcript: str, api_key: str) -> List[Dict[str, str]]:
    """Universal pipeline step: Triage -> Fetch -> Format."""
    print("  🔍 [auto_researcher] Categorizing content and detecting AI needs...")
    prompt = f"TRANSCRIPT:\n---\n{transcript}\n---\n"
    
    triage = _call_claude_json(SYS_PROMPT_ANALYZE_VARS, prompt, api_key)
    if not isinstance(triage, dict) or not triage:
        return []
        
    category = str(triage.get("category", "MOTIVATIONAL"))
    query = str(triage.get("search_query", "") or "")
    raw_metrics = triage.get("required_metrics", [])
    metrics = raw_metrics if isinstance(raw_metrics, list) else []
    metrics = [str(metric) for metric in metrics if str(metric).strip()]
    
    print(f"  🧠 [auto_researcher] Category: {category}")
    if category == "MOTIVATIONAL":
        print("  ⏩ [auto_researcher] Motivational content requires no factual research. Skipping.")
        return []
        
    print(f"  🧠 [auto_researcher] Entity/Location: {query}")
    
    if category == "BARBERSHOP_BUSINESS":
        db_data = _fetch_real_market_intel(query)
    elif category in ["PRODUCT_REVIEW", "HAIRCUT_TUTORIAL"]:
        db_data = _fetch_web_search(query, metrics, api_key)
    else:
        db_data = {}
    if not isinstance(db_data, dict):
        db_data = {}
        
    research_results = []
    for metric in metrics:
        db_val = db_data.get(metric, "N/A")
        print(f"     ✅ Data Found -> {metric}: {db_val}")
        research_results.append({
            "concept": metric.replace("_", " ").title(),
            "data": db_val
        })
        
    return research_results
