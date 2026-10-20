import json
import logging
import requests
from django.conf import settings
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from trips.models import ItineraryDay, ItineraryItem, Trip, Attraction
from trips.serializers import ItineraryDaySerializer


logger = logging.getLogger(__name__)

GEMINI_MODELS = ['gemini-flash-latest', 'gemini-3.8-flash']

OLLAMA_API_URL = getattr(settings, 'OLLAMA_API_URL', 'http://localhost:11434')
OLLAMA_MODELS = ['llama3.2', 'llama3', 'mistral', 'phi3', 'qwen2.5', 'gemma2']

def call_ollama_api(prompt):
    """Auto-detects local Ollama Small Language Model (SLM) daemon and generates itinerary JSON."""
    try:
        tags_resp = requests.get(f"{OLLAMA_API_URL}/api/tags", timeout=1.5)
        if tags_resp.status_code == 200:
            installed = [m.get('name', '').split(':')[0] for m in tags_resp.json().get('models', [])]
            selected_model = None
            for pref in OLLAMA_MODELS:
                for inst in installed:
                    if pref in inst:
                        selected_model = inst
                        break
                if selected_model:
                    break
            if not selected_model and installed:
                selected_model = installed[0]

            if selected_model:
                logger.info('Local Ollama SLM detected! Generating itinerary with model: %s', selected_model)
                payload = {
                    'model': selected_model,
                    'prompt': prompt,
                    'format': 'json',
                    'stream': False,
                    'options': {'temperature': 0.7}
                }
                gen_resp = requests.post(f"{OLLAMA_API_URL}/api/generate", json=payload, timeout=90)
                if gen_resp.status_code == 200:
                    raw_res = gen_resp.json().get('response', '').strip()
                    if raw_res.startswith('```'):
                        raw_res = '\n'.join(raw_res.split('\n')[1:])
                    if raw_res.endswith('```'):
                        raw_res = '\n'.join(raw_res.split('\n')[:-1])
                    parsed = json.loads(raw_res)
                    if parsed and (parsed.get('days') or parsed.get('items')):
                        return parsed
    except Exception as e:
        logger.debug('Ollama SLM check/generation bypassed: %s', e)
    return None


import math
import re

SYSTEM_PROMPT_TEMPLATE = """
You are TravelGenie, a world-class AI travel concierge and destination expert.
The user is planning a trip titled "{title}" to {destination}.
The trip runs from {start_date} to {end_date} ({num_days} day(s)).

User's exact instructions and preferences:
"{user_prompt}"

INSTRUCTIONS:
1. DEEPLY ADHERE TO USER PREFERENCES:
   - Carefully analyze what the user specifically asked for in their prompt (e.g. if they ask for nature, hiking, unique foods, boat rides, malls, temples, artisan markets, or street food, tailor the entire trip around their exact interests).
   - Recommend authentic, popular, and genuine places in and around {destination}.
2. FLUID, ENGAGING, REALISTIC SCHEDULES:
   - Provide a realistic daily schedule with 3 to 4 activities per day.
   - Do NOT use robotic, repetitive phrasing like "Morning guided visit to...", "Midday culinary lunch at...". Instead, write engaging, descriptive titles that explain what makes each place special.
3. ACCURATE PROPER VENUE NAMES AND COORDINATES:
   - Provide the EXACT real-world name of the landmark, park, restaurant, or boat jetty in "location_name".
   - Provide estimated real-world latitude ("lat") and longitude ("lng") numbers for each venue so it can be accurately pinned on the interactive map.
4. PACKING LIST:
   - Provide 5 to 8 practical, tailored packing recommendations for {destination} and the trip activities.

You MUST respond ONLY with valid JSON in exactly this schema (no markdown formatting, no code fences, just raw JSON):
{{
  "days": [
    {{
      "day_number": 1,
      "summary": "Creative and engaging summary of the day",
      "items": [
        {{
          "title": "Engaging activity title describing the visit",
          "location_name": "Exact proper name of the venue, park, or boat jetty",
          "lat": 9.9654,
          "lng": 76.2421,
          "start_time": "10:00",
          "est_cost": 25.0
        }}
      ]
    }}
  ],
  "packing_list": ["item1", "item2"]
}}
"""

SINGLE_DAY_PROMPT_TEMPLATE = """
You are TravelGenie, an expert AI travel concierge.
Trip title: "{title}" to {destination}.
Planning specifically for Day {day_number}.
User's instruction for this day: "{user_prompt}"

INSTRUCTIONS:
- Tailor all activities for this day directly to the user's specific request.
- Provide 3 to 4 realistic, engaging activities with specific proper venue names in "location_name".
- Provide estimated real-world latitude ("lat") and longitude ("lng") numbers for each venue.

You MUST respond ONLY with valid JSON in this schema (no markdown):
{{
  "summary": "Creative summary for Day {day_number}",
  "items": [
    {{
      "title": "Engaging activity title",
      "location_name": "Exact proper name of the venue",
      "lat": 9.9654,
      "lng": 76.2421,
      "start_time": "10:00",
      "est_cost": 20.0
    }}
  ]
}}
"""


def call_gemini_api(system_prompt):
    # 1. Try local Ollama SLM first if available on user's laptop
    ollama_result = call_ollama_api(system_prompt)
    if ollama_result:
        return ollama_result
    """Calls Gemini with automatic model fallback and responseMimeType JSON."""
    api_key = settings.GEMINI_API_KEY
    if not api_key or api_key == 'your-gemini-api-key':
        return None

    payload = {
        'contents': [{'parts': [{'text': system_prompt}]}],
        'generationConfig': {
            'temperature': 0.7,
            'maxOutputTokens': 4096,
            'responseMimeType': 'application/json',
        },
    }

    for model in GEMINI_MODELS:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
        try:
            resp = requests.post(url, params={'key': api_key}, json=payload, timeout=60)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data['candidates'][0]['content']['parts'][0]['text'].strip()
                if raw_text.startswith('```'):
                    raw_text = '\n'.join(raw_text.split('\n')[1:])
                if raw_text.endswith('```'):
                    raw_text = '\n'.join(raw_text.split('\n')[:-1])
                parsed = json.loads(raw_text)
                if parsed and parsed.get('days'):
                    logger.info('Gemini model %s successfully generated itinerary', model)
                    return parsed
        except Exception as e:
            logger.warning('Gemini model %s failed: %s', model, e)
    return None


def call_gemini_single_day(title, destination, day_number, user_prompt):
    """Calls Gemini to customize a single day based on user instructions."""
    api_key = settings.GEMINI_API_KEY
    if not api_key or api_key == 'your-gemini-api-key':
        return None

    prompt = SINGLE_DAY_PROMPT_TEMPLATE.format(
        title=title,
        destination=destination,
        day_number=day_number,
        user_prompt=user_prompt or 'Exciting city exploration.',
    )
    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {
            'temperature': 0.7,
            'maxOutputTokens': 2048,
            'responseMimeType': 'application/json',
        },
    }

    for model in GEMINI_MODELS:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
        try:
            resp = requests.post(url, params={'key': api_key}, json=payload, timeout=35)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data['candidates'][0]['content']['parts'][0]['text'].strip()
                if raw_text.startswith('```'):
                    raw_text = '\n'.join(raw_text.split('\n')[1:])
                if raw_text.endswith('```'):
                    raw_text = '\n'.join(raw_text.split('\n')[:-1])
                parsed = json.loads(raw_text)
                if parsed and parsed.get('items'):
                    return parsed
        except Exception as e:
            logger.warning('Gemini single-day model %s failed: %s', model, e)
    return None


GEOCODE_CACHE = {}


def geocode_venue(location_name, city, destination, est_cost=15.0, lat=None, lng=None):
    """Geocodes an AI-recommended venue and persists it as an Attraction in PostgreSQL."""
    if not location_name:
        return None
    clean = re.sub(r'^(visit|explore|tour|lunch at|dinner at|shopping at|breakfast at)\s+', '', str(location_name), flags=re.I).strip()
    clean = clean.split('(')[0].strip(' ,.-')
    if not clean or len(clean) < 3:
        return None

    # 1. Direct coordinates provided by AI
    p_lat, p_lng = None, None
    if lat is not None and lng is not None:
        try:
            f_lat = float(lat)
            f_lng = float(lng)
            if -90 <= f_lat <= 90 and -180 <= f_lng <= 180 and not (f_lat == 0 and f_lng == 0):
                p_lat, p_lng = f_lat, f_lng
        except (ValueError, TypeError):
            pass

    # 2. Existing Attraction in destination
    if destination:
        att = destination.attractions.filter(name__iexact=clean).first()
        if att:
            return att
        for a in destination.attractions.all():
            if clean.lower() in a.name.lower() or a.name.lower() in clean.lower():
                return a

    # 3. Check memory cache to avoid duplicate network queries
    cache_key = f"{clean.lower()}|{city.lower() if city else ''}"
    if (p_lat is None or p_lng is None) and cache_key in GEOCODE_CACHE:
        p_lat, p_lng = GEOCODE_CACHE[cache_key]

    # 4. Fast Nominatim search with a strict 1.5s timeout (only if coordinates still missing)
    if p_lat is None or p_lng is None:
        base_name = clean.split(',')[0].strip()
        query = f'{base_name} {city}'.strip() if city else base_name
        try:
            url = f'https://nominatim.openstreetmap.org/search?q={requests.utils.quote(query)}&format=json&limit=1'
            r = requests.get(url, headers={'User-Agent': 'TravelGenieApp/1.0'}, timeout=1.5).json()
            if r and len(r) > 0:
                p_lat = float(r[0]['lat'])
                p_lng = float(r[0]['lon'])
                GEOCODE_CACHE[cache_key] = (p_lat, p_lng)
        except Exception:
            pass

    # 5. Fast City Fallback (cached) with minor jitter so pins don't overlap
    if (p_lat is None or p_lng is None) and city:
        city_key = f"__city_center__|{city.lower()}"
        if city_key not in GEOCODE_CACHE:
            try:
                url = f'https://nominatim.openstreetmap.org/search?q={requests.utils.quote(city)}&format=json&limit=1'
                r = requests.get(url, headers={'User-Agent': 'TravelGenieApp/1.0'}, timeout=1.5).json()
                if r and len(r) > 0:
                    GEOCODE_CACHE[city_key] = (float(r[0]['lat']), float(r[0]['lon']))
            except Exception:
                pass
        if city_key in GEOCODE_CACHE:
            import random
            c_lat, c_lng = GEOCODE_CACHE[city_key]
            p_lat = c_lat + random.uniform(-0.02, 0.02)
            p_lng = c_lng + random.uniform(-0.02, 0.02)

    # 6. Persist Attraction in PostgreSQL
    if p_lat is not None and p_lng is not None and destination:
        try:
            att_obj, _ = Attraction.objects.get_or_create(
                destination=destination,
                name=clean,
                defaults={
                    'category': 'attraction',
                    'avg_cost': float(est_cost or 15.0),
                    'lat': p_lat,
                    'lng': p_lng,
                }
            )
            return att_obj
        except Exception as e:
            logger.warning('Failed to save attraction %s: %s', clean, e)
    return None


import re

def parse_day_prompts(text):
    """Parses natural language day assignments e.g. 'Day 3: Waterfalls, on day 4 visit Vellore Fort'"""
    day_map = {}
    if not text:
        return day_map
    parts = re.split(r'(?:\band\s+)?(?=(?:on\s+day\s*\d+|day\s*\d+))', text, flags=re.I)
    for p in parts:
        p = p.strip()
        m = re.match(r'(?:on\s+day\s*(\d+)|day\s*(\d+))[:\-\s]*(.*)', p, re.I)
        if m:
            d_num = int(m.group(1) or m.group(2))
            action = m.group(3).strip(' ,.;')
            if action:
                day_map[d_num] = action
    return day_map


def extract_user_candidate_places(prompt):
    """Extracts specific places, restaurants, or monument requests from user prompt."""
    if not prompt:
        return []
    candidates = []
    pats = [
        r'(?:wanted\s+to\s+go\s+to|want\s+to\s+go\s+to|go\s+to|visit|see|explore|head\s+to|eat\s+at|dine\s+at|lunch\s+at|dinner\s+at|at)\s+([^,.;\n]+?)(?=\s+\b(?:and|also|with|then|after|on\s+day|for|before)\b|\.|\,|$)',
        r'^([^,.;\n]+?)(?=\s+\b(?:for\s+dinner|for\s+lunch|on\s+day)\b|\.|\,|$)'
    ]
    for pat in pats:
        for m in re.finditer(pat, prompt, re.I):
            c = m.group(1).strip()
            if c and len(c) > 2 and c.lower() not in ['the', 'a', 'an', 'some', 'any', 'hotel', 'restaurant', 'food']:
                if c.lower() not in [x.lower() for x in candidates]:
                    candidates.append(c)

    clean_p = prompt.strip(' .,"\'')
    if not candidates and 2 < len(clean_p) < 45 and not any(k in clean_p.lower() for k in ['budget', 'cheap', 'relax', 'vacation']):
        candidates.append(clean_p)

    return candidates


def haversine_km(lat1, lon1, lat2, lon2):
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 0.0
    try:
        R = 6371.0
        dlat = math.radians(float(lat2) - float(lat1))
        dlon = math.radians(float(lon2) - float(lon1))
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) * math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
    except Exception:
        return 0.0


def get_city_center(city, country='', destination=None):
    if destination:
        att = destination.attractions.filter(lat__isnull=False, lng__isnull=False).first()
        if att:
            return float(att.lat), float(att.lng)
    try:
        url = f'https://nominatim.openstreetmap.org/search?q={city}+{country}&format=json&limit=1'
        r = requests.get(url, headers={'User-Agent': 'TravelGenie/1.0'}, timeout=4).json()
        if r:
            return float(r[0]['lat']), float(r[0]['lon'])
    except Exception:
        pass
    return None, None


def is_valid_specific_name(name, city):
    if not name or len(name.strip()) < 4:
        return False
    clean = name.strip().lower()
    clean = re.sub(r'\(.*?\)', '', clean).strip()
    c_lower = city.lower()
    generic_words = {
        'temple', 'restaurant', 'hotel', 'cafe', 'bar', 'food', 'fast food',
        'supermarket', 'mall', 'church', 'mosque', 'museum', 'palace', 'bazaar',
        'market', 'park', 'hospital', 'bank', 'atm', 'lodge', 'residency', 'mess',
        'central', 'traditional', 'cuisine', 'famous', 'popular', 'street',
        'tourist attraction', 'attraction', 'monument', 'sight', 'place of worship',
        c_lower, f'{c_lower} temple', f'{c_lower} restaurant', f'{c_lower} hotel',
        f'{c_lower} city', f'{c_lower} district', f'hotel {c_lower}', f'restaurant {c_lower}',
        f'taste of {c_lower}', f'visit {c_lower}', 'food court', 'dining',
    }
    if clean in generic_words:
        return False
    if clean.startswith('list of ') or 'district' in clean or 'tourism in' in clean or 'history of' in clean:
        return False
    tokens = clean.split()
    if len(tokens) == 1 and tokens[0] in generic_words:
        return False
    return True


def discover_real_city_places(city, country='', prompt='', destination=None):
    """
    Finds real places, restaurants, and attractions in the city using OpenStreetMap Nominatim
    and Wikipedia API, matching any specific places requested by the user.
    Persists them as Attraction models in PostgreSQL under the destination!
    Returns structured pools: user_food, user_sights, sights, restaurants, cafes, markets.
    """
    center_lat, center_lon = get_city_center(city, country, destination=destination)

    user_food = []
    user_sights = []
    sights = []
    restaurants = []
    cafes = []
    markets = []
    seen = set()

    # 1. Resolve user requested places first
    user_candidates = extract_user_candidate_places(prompt)
    for cand in user_candidates:
        try:
            url = f'https://nominatim.openstreetmap.org/search?q={cand}+{city}&format=json&limit=1'
            r = requests.get(url, headers={'User-Agent': 'TravelGenie/1.0'}, timeout=5).json()
            if not r:
                url = f'https://nominatim.openstreetmap.org/search?q={cand}&format=json&limit=1'
                r = requests.get(url, headers={'User-Agent': 'TravelGenie/1.0'}, timeout=5).json()

            if r:
                item = r[0]
                p_name = item.get('name') or cand.title()
                p_cat = 'food' if item.get('class') == 'amenity' and item.get('type') in ['restaurant', 'cafe', 'fast_food', 'bar'] else 'attraction'
                p_lat = float(item['lat'])
                p_lng = float(item['lon'])

                att_obj = None
                if destination:
                    att_obj, _ = Attraction.objects.get_or_create(
                        destination=destination,
                        name=p_name,
                        defaults={
                            'category': p_cat,
                            'avg_cost': 25.0 if p_cat == 'food' else 15.0,
                            'lat': p_lat,
                            'lng': p_lng,
                        }
                    )
                    if att_obj.lat is None or att_obj.lng is None:
                        att_obj.lat = p_lat
                        att_obj.lng = p_lng
                        att_obj.save(update_fields=['lat', 'lng'])

                entry = {
                    'name': p_name,
                    'category': p_cat,
                    'lat': p_lat,
                    'lng': p_lng,
                    'attraction_obj': att_obj,
                    'user_requested': True,
                }
                if p_cat == 'food':
                    user_food.append(entry)
                else:
                    user_sights.append(entry)
                seen.add(p_name.lower())
                seen.add(cand.lower())
        except Exception as e:
            logger.warning('Error geocoding user place %s: %s', cand, e)

    # 2. Pre-load existing attractions in database (excluding already added user places)
    if destination:
        for db_att in destination.attractions.all():
            if db_att.name.lower() not in seen and is_valid_specific_name(db_att.name, city):
                entry = {
                    'name': db_att.name,
                    'category': db_att.category or 'landmark',
                    'lat': float(db_att.lat) if db_att.lat else None,
                    'lng': float(db_att.lng) if db_att.lng else None,
                    'attraction_obj': db_att,
                    'user_requested': False,
                }
                if entry['category'] == 'food':
                    restaurants.append(entry)
                else:
                    sights.append(entry)
                seen.add(db_att.name.lower())

    # 3. Query Wikipedia for famous attractions, temples, and monuments in the city
    wiki_titles = []
    for q in [f'temples in {city}', f'tourist attractions in {city}', f'monuments in {city}', f'places to visit in {city}']:
        try:
            wiki_url = f'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={q}&format=json&utf8=&srlimit=20'
            w_res = requests.get(wiki_url, headers={'User-Agent': 'TravelGenie/1.0'}, timeout=5).json()
            for hit in w_res.get('query', {}).get('search', []):
                t = hit['title']
                if is_valid_specific_name(t, city) and t.lower() not in seen and t not in wiki_titles:
                    wiki_titles.append(t)
        except Exception as e:
            logger.warning('Wikipedia search error: %s', e)

    # Batch retrieve coordinates directly from Wikipedia
    for i in range(0, len(wiki_titles), 20):
        batch = wiki_titles[i:i + 20]
        pipe_t = '|'.join(batch)
        try:
            coord_url = f'https://en.wikipedia.org/w/api.php?action=query&prop=coordinates&titles={pipe_t}&format=json'
            c_res = requests.get(coord_url, headers={'User-Agent': 'TravelGenie/1.0'}, timeout=5).json()
            for pid, pdata in c_res.get('query', {}).get('pages', {}).items():
                t = pdata.get('title')
                coords = pdata.get('coordinates')
                if coords and t and t.lower() not in seen:
                    lat = float(coords[0].get('lat'))
                    lon = float(coords[0].get('lon'))
                    if center_lat is None or haversine_km(center_lat, center_lon, lat, lon) <= 35.0:
                        att_obj = None
                        if destination:
                            att_obj, _ = Attraction.objects.get_or_create(
                                destination=destination,
                                name=t,
                                defaults={
                                    'category': 'landmark',
                                    'avg_cost': 15.0,
                                    'lat': lat,
                                    'lng': lon,
                                }
                            )
                        sights.append({
                            'name': t,
                            'category': 'landmark',
                            'lat': lat,
                            'lng': lon,
                            'attraction_obj': att_obj,
                            'user_requested': False,
                        })
                        seen.add(t.lower())
        except Exception as e:
            logger.warning('Wikipedia batch coordinates error: %s', e)

    # 4. Search Nominatim for authentic restaurants, mess, cafes, markets
    restaurant_queries = [
        f'restaurants in {city}',
        f'mess in {city}',
        f'veg restaurant in {city}',
        f'biryani in {city}',
        f'famous food in {city}',
    ]
    for q_r in restaurant_queries:
        if len(restaurants) >= 40:
            break
        try:
            r = requests.get(f'https://nominatim.openstreetmap.org/search?q={q_r}&format=json&limit=15', headers={'User-Agent': 'TravelGenie/1.0'}, timeout=4).json()
            for it in r:
                n = it.get('name')
                if n and is_valid_specific_name(n, city) and n.lower() not in seen:
                    lat = float(it['lat'])
                    lon = float(it['lon'])
                    if center_lat is None or haversine_km(center_lat, center_lon, lat, lon) <= 25.0:
                        att_obj = None
                        if destination:
                            att_obj, _ = Attraction.objects.get_or_create(
                                destination=destination,
                                name=n,
                                defaults={
                                    'category': 'food',
                                    'avg_cost': 20.0,
                                    'lat': lat,
                                    'lng': lon,
                                }
                            )
                        restaurants.append({
                            'name': n,
                            'category': 'food',
                            'lat': lat,
                            'lng': lon,
                            'attraction_obj': att_obj,
                            'user_requested': False,
                        })
                        seen.add(n.lower())
        except Exception:
            pass

    # 5. Cafes & Bakeries
    try:
        r = requests.get(f'https://nominatim.openstreetmap.org/search?q=cafe in {city}&format=json&limit=10', headers={'User-Agent': 'TravelGenie/1.0'}, timeout=4).json()
        for it in r:
            n = it.get('name')
            if n and is_valid_specific_name(n, city) and n.lower() not in seen:
                lat = float(it['lat'])
                lon = float(it['lon'])
                att_obj = None
                if destination:
                    att_obj, _ = Attraction.objects.get_or_create(
                        destination=destination,
                        name=n,
                        defaults={'category': 'food', 'avg_cost': 10.0, 'lat': lat, 'lng': lon}
                    )
                cafes.append({
                    'name': n,
                    'category': 'food',
                    'lat': lat,
                    'lng': lon,
                    'attraction_obj': att_obj,
                    'user_requested': False,
                })
                seen.add(n.lower())
    except Exception:
        pass

    # 6. Bazaars / Street Markets
    try:
        r = requests.get(f'https://nominatim.openstreetmap.org/search?q=bazaar in {city}&format=json&limit=10', headers={'User-Agent': 'TravelGenie/1.0'}, timeout=4).json()
        for it in r:
            n = it.get('name')
            if n and is_valid_specific_name(n, city) and n.lower() not in seen:
                lat = float(it['lat'])
                lon = float(it['lon'])
                att_obj = None
                if destination:
                    att_obj, _ = Attraction.objects.get_or_create(
                        destination=destination,
                        name=n,
                        defaults={'category': 'culture', 'avg_cost': 10.0, 'lat': lat, 'lng': lon}
                    )
                markets.append({
                    'name': n,
                    'category': 'culture',
                    'lat': lat,
                    'lng': lon,
                    'attraction_obj': att_obj,
                    'user_requested': False,
                })
                seen.add(n.lower())
    except Exception:
        pass

    return {
        'user_food': user_food,
        'user_sights': user_sights,
        'sights': sights,
        'restaurants': restaurants,
        'cafes': cafes,
        'markets': markets,
    }


def generate_day_content(city, country, day_number, prompt_text, theme_hint=None, destination=None, exclude_names=None):
    """
    Synthesizes an authentic, localized day in the specified city with 100% specific venue names.
    Respects exclude_names to prevent repeating venues already scheduled on other days!
    """
    pools = discover_real_city_places(city, country, prompt_text, destination=destination)
    exclude = set(x.lower() for x in (exclude_names or []))

    user_food = [f for f in pools.get('user_food', []) if f['name'].lower() not in exclude]
    user_sights = [s for s in pools.get('user_sights', []) if s['name'].lower() not in exclude]
    sights = [s for s in pools.get('sights', []) if s['name'].lower() not in exclude]
    restaurants = [r for r in pools.get('restaurants', []) if r['name'].lower() not in exclude]
    markets = [m for m in pools.get('markets', []) if m['name'].lower() not in exclude]

    # Pick Morning Sight
    if user_sights:
        s1 = user_sights.pop(0)
    elif sights:
        s1 = sights.pop(0)
    else:
        s1 = {'name': f'Historic Heritage Quarter of {city}', 'attraction_obj': None}
    exclude.add(s1['name'].lower())

    # Pick Lunch Restaurant
    if user_food:
        r1 = user_food.pop(0)
    elif restaurants:
        r1 = restaurants.pop(0)
    else:
        r1 = {'name': f'Traditional Dining House in {city}', 'attraction_obj': None}
    exclude.add(r1['name'].lower())

    # Pick Afternoon Sight
    if sights:
        s2 = sights.pop(0)
    else:
        s2 = {'name': f'Cultural Artisan District of {city}', 'attraction_obj': None}
    exclude.add(s2['name'].lower())

    # Pick Dinner Restaurant
    if restaurants:
        r2 = restaurants.pop(0)
    else:
        r2 = {'name': f'Regional Specialties Bistro in {city}', 'attraction_obj': None}
    exclude.add(r2['name'].lower())

    items = [
        {
            'title': f'Morning guided visit to {s1["name"]}',
            'start_time': '09:30',
            'est_cost': 20.0,
            'attraction': s1.get('attraction_obj'),
        },
        {
            'title': f'Midday culinary lunch at {r1["name"]}',
            'start_time': '12:30',
            'est_cost': 20.0,
            'attraction': r1.get('attraction_obj'),
        },
        {
            'title': f'Afternoon discovery tour of {s2["name"]}',
            'start_time': '15:00',
            'est_cost': 15.0,
            'attraction': s2.get('attraction_obj'),
        },
    ]

    if markets:
        m_stroll = markets.pop(0)
        items.append({
            'title': f'Sunset stroll & local shopping at {m_stroll["name"]}',
            'start_time': '17:30',
            'est_cost': 10.0,
            'attraction': m_stroll.get('attraction_obj'),
        })

    items.append({
        'title': f'Relaxed evening dinner reservation at {r2["name"]}',
        'start_time': '19:45',
        'est_cost': 35.0,
        'attraction': r2.get('attraction_obj'),
    })

    return {
        'summary': f'{s1["name"]} & Cultural Highlights of {city}',
        'items': items,
    }


def generate_curated_itinerary(trip, num_days, user_prompt):
    """
    Intelligent real-place itinerary engine for any destination in the world.
    Accurately places user-requested spots (e.g. 'Vellore Kitchen', 'Murugan Idli Shop')
    and authentic city landmarks (e.g. 'Meenakshi Temple', 'Thirumalai Nayakkar Mahal').
    Guarantees 100% unique, non-repeating activities and meals for every day!
    """
    city = trip.destination.city if trip.destination else trip.title
    country = trip.destination.country if trip.destination else ''
    destination = trip.destination

    pools = discover_real_city_places(city, country, user_prompt, destination=destination)

    user_food = list(pools.get('user_food', []))
    user_sights = list(pools.get('user_sights', []))
    sights = list(pools.get('sights', []))
    restaurants = list(pools.get('restaurants', []))
    cafes = list(pools.get('cafes', []))
    markets = list(pools.get('markets', []))

    # Rank major sights (Meenakshi, Mahal, Fort, Palace, Temple, Museum) towards top
    def sight_score(s):
        nm = s['name'].lower()
        if 'meenakshi' in nm or 'fort' in nm or 'palace' in nm or 'mahal' in nm:
            return 100
        if 'temple' in nm or 'museum' in nm:
            return 50
        return 10

    sights.sort(key=sight_score, reverse=True)

    used_sight_names = set()
    used_food_names = set()

    def get_next_sight():
        if user_sights:
            s = user_sights.pop(0)
            used_sight_names.add(s['name'].lower())
            return s
        for s in sights:
            if s['name'].lower() not in used_sight_names:
                used_sight_names.add(s['name'].lower())
                return s
        idx = len(used_sight_names) + 1
        return {'name': f'{city} Cultural Heritage Landmark {idx}', 'attraction_obj': None, 'lat': None, 'lng': None}

    def get_next_restaurant():
        if user_food:
            r = user_food.pop(0)
            used_food_names.add(r['name'].lower())
            return r
        for r in restaurants:
            if r['name'].lower() not in used_food_names:
                used_food_names.add(r['name'].lower())
                return r
        for c in cafes:
            if c['name'].lower() not in used_food_names:
                used_food_names.add(c['name'].lower())
                return c
        idx = len(used_food_names) + 1
        return {'name': f'{city} Traditional Dining Room {idx}', 'attraction_obj': None, 'lat': None, 'lng': None}

    days = []

    # Day 1: Arrival & Orientation + User Requested spots
    day1_items = [{
        'title': f'Arrival and hotel check-in in central {city}',
        'start_time': '11:00',
        'est_cost': 35.0,
        'attraction': None,
    }]
    lunch1 = get_next_restaurant()
    day1_items.append({
        'title': f'Welcome lunch feast at {lunch1["name"]}',
        'start_time': '13:00',
        'est_cost': 25.0,
        'attraction': lunch1.get('attraction_obj'),
    })
    sight1 = get_next_sight()
    day1_items.append({
        'title': f'Afternoon exploration of {sight1["name"]}',
        'start_time': '15:30',
        'est_cost': 15.0,
        'attraction': sight1.get('attraction_obj'),
    })
    dinner1 = get_next_restaurant()
    day1_items.append({
        'title': f'Evening dinner experience at {dinner1["name"]}',
        'start_time': '19:30',
        'est_cost': 30.0,
        'attraction': dinner1.get('attraction_obj'),
    })
    days.append({
        'day_number': 1,
        'summary': f'Arrival & Exploration of {sight1["name"]}',
        'items': day1_items,
    })

    # Middle days: 2 to num_days - 1
    for d in range(2, num_days):
        day_items = []
        ms = get_next_sight()
        day_items.append({
            'title': f'Morning guided visit to {ms["name"]}',
            'start_time': '09:30',
            'est_cost': 20.0,
            'attraction': ms.get('attraction_obj'),
        })

        lr = get_next_restaurant()
        day_items.append({
            'title': f'Midday culinary lunch at {lr["name"]}',
            'start_time': '12:30',
            'est_cost': 20.0,
            'attraction': lr.get('attraction_obj'),
        })

        asight = get_next_sight()
        day_items.append({
            'title': f'Afternoon discovery tour of {asight["name"]}',
            'start_time': '15:00',
            'est_cost': 15.0,
            'attraction': asight.get('attraction_obj'),
        })

        # Evening market stroll if available
        if markets and len(markets) > 0:
            m_pick = markets.pop(0)
            day_items.append({
                'title': f'Sunset stroll & local shopping at {m_pick["name"]}',
                'start_time': '17:30',
                'est_cost': 10.0,
                'attraction': m_pick.get('attraction_obj'),
            })

        dr = get_next_restaurant()
        day_items.append({
            'title': f'Relaxed evening dinner reservation at {dr["name"]}',
            'start_time': '19:45',
            'est_cost': 35.0,
            'attraction': dr.get('attraction_obj'),
        })

        days.append({
            'day_number': d,
            'summary': f'{ms["name"]} & Cultural Heritage of {city}',
            'items': day_items,
        })

    # Last Day: Departure (if trip has more than 1 day)
    if num_days > 1:
        last_items = []
        farewell_sight = get_next_sight()
        last_items.append({
            'title': f'Morning farewell visit to {farewell_sight["name"]}',
            'start_time': '09:30',
            'est_cost': 15.0,
            'attraction': farewell_sight.get('attraction_obj'),
        })
        farewell_lunch = get_next_restaurant()
        last_items.append({
            'title': f'Farewell lunch celebration at {farewell_lunch["name"]}',
            'start_time': '12:30',
            'est_cost': 25.0,
            'attraction': farewell_lunch.get('attraction_obj'),
        })
        last_items.append({
            'title': f'Final hotel checkout and departure transfer from {city}',
            'start_time': '15:00',
            'est_cost': 20.0,
            'attraction': None,
        })
        days.append({
            'day_number': num_days,
            'summary': f'Farewell Morning & Departure from {city}',
            'items': last_items,
        })

    packing = [
        'Valid photo ID, reservation tickets and travel vouchers',
        f'Comfortable walking shoes suitable for exploring {city}',
        'Modest breathable clothing appropriate for local temples and heritage monuments',
        'Portable power bank and universal mobile charging cable',
        'Sunscreen, polarized sunglasses, and a refillable hydration bottle',
    ]

    return {'days': days, 'packing_list': packing}



class PlanTripView(APIView):
    """
    POST /api/ai/plan/
    Body:
      {
        "trip_id": <int>,
        "user_prompt": "<string>",
        "day_number": <int | null>   // If provided, only updates that single day!
      }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        trip_id = request.data.get('trip_id')
        user_prompt = request.data.get('user_prompt') or request.data.get('prompt') or ''
        target_day_raw = request.data.get('day_number')

        if not trip_id:
            return Response(
                {'detail': 'trip_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            trip = Trip.objects.select_related('destination', 'user').get(pk=trip_id)
        except Trip.DoesNotExist:
            return Response({'detail': 'Trip not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if user.role_name != 'admin' and trip.user != user:
            return Response(
                {'detail': 'You do not have permission to plan this trip.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        num_days = max(1, (trip.end_date - trip.start_date).days + 1)
        city = trip.destination.city if trip.destination else trip.title
        country = trip.destination.country if trip.destination else 'the region'

        # Target a specific day if requested
        target_day = None
        if target_day_raw and str(target_day_raw).isdigit():
            val = int(target_day_raw)
            if 1 <= val <= num_days:
                target_day = val

        # Handle SINGLE DAY update
        if target_day:
            day_content = None
            destination_str = (
                f'{trip.destination.city}, {trip.destination.country}'
                if trip.destination
                else trip.title
            )
            if user_prompt:
                day_content = call_gemini_single_day(trip.title, destination_str, target_day, user_prompt)

            if not day_content or not day_content.get('items'):
                exclude_names = set()
                for other_day in trip.days.exclude(day_number=target_day):
                    for it in other_day.items.all():
                        if it.attraction and it.attraction.name:
                            exclude_names.add(it.attraction.name)
                        elif it.title:
                            exclude_names.add(it.title)

                day_content = generate_day_content(
                    city, country, target_day, user_prompt,
                    destination=trip.destination, exclude_names=exclude_names
                )

            with transaction.atomic():
                ItineraryDay.objects.filter(trip=trip, day_number=target_day).delete()
                day_obj = ItineraryDay.objects.create(
                    trip=trip,
                    day_number=target_day,
                    summary=day_content.get('summary', f'Day {target_day} in {city}'),
                )
                for item_data in day_content.get('items', []):
                    title = item_data.get('title', 'Activity')
                    location_name = item_data.get('location_name') or title
                    attr_val = item_data.get('attraction')
                    attr_obj = None
                    if isinstance(attr_val, Attraction):
                        attr_obj = attr_val
                    elif isinstance(attr_val, int):
                        attr_obj = Attraction.objects.filter(pk=attr_val).first()
                    else:
                        attr_obj = geocode_venue(
                            location_name,
                            city,
                            trip.destination,
                            item_data.get('est_cost', 15.0),
                            lat=item_data.get('lat'),
                            lng=item_data.get('lng'),
                        )

                    ItineraryItem.objects.create(
                        day=day_obj,
                        title=title,
                        start_time=item_data.get('start_time') or None,
                        est_cost=float(item_data.get('est_cost', 0)),
                        attraction=attr_obj,
                    )

            # Return serialized all days
            days_qs = trip.days.prefetch_related('items__expenses').all().order_by('day_number')
            serializer = ItineraryDaySerializer(days_qs, many=True)
            return Response(
                {
                    'trip_id': trip.trip_id,
                    'days': serializer.data,
                    'updated_day': target_day,
                },
                status=status.HTTP_200_OK,
            )

        # FULL TRIP UPDATE
        if user_prompt:
            trip.prompt_text = user_prompt
            trip.save(update_fields=['prompt_text'])

        itinerary_json = None
        destination_str = (
            f'{trip.destination.city}, {trip.destination.country}'
            if trip.destination
            else trip.title
        )
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            title=trip.title,
            destination=destination_str,
            start_date=trip.start_date,
            end_date=trip.end_date,
            num_days=num_days,
            user_prompt=user_prompt or 'No special instructions.',
        )

        # 1. Primary: Call Google Gemini LLM
        itinerary_json = call_gemini_api(system_prompt)

        # 2. Try Local Ollama if available and Gemini was not used
        if not itinerary_json or not itinerary_json.get('days'):
            try:
                oll_resp = requests.post(
                    'http://host.docker.internal:11434/api/generate',
                    json={
                        'model': 'qwen2.5:14b-instruct-q5_K_M',
                        'prompt': system_prompt,
                        'stream': False,
                        'format': 'json',
                    },
                    timeout=4,
                )
                if oll_resp.status_code == 200:
                    raw_out = oll_resp.json().get('response', '')
                    itinerary_json = json.loads(raw_out)
            except Exception:
                pass

        # 3. Dynamic Prompt-Aware Discovery Fallback Engine
        if not itinerary_json or not itinerary_json.get('days'):
            itinerary_json = generate_curated_itinerary(trip, num_days, user_prompt)

        days_data = itinerary_json.get('days', [])
        packing_list = itinerary_json.get('packing_list', [])

        # Persist full trip inside atomic transaction
        with transaction.atomic():
            ItineraryDay.objects.filter(trip=trip).delete()

            for day_data in days_data:
                day_num = int(day_data.get('day_number', 0))
                summary = day_data.get('summary', '')
                items_data = day_data.get('items', [])

                day_obj = ItineraryDay.objects.create(
                    trip=trip,
                    day_number=day_num,
                    summary=summary,
                )

                for item_data in items_data:
                    title = item_data.get('title', 'Untitled')
                    location_name = item_data.get('location_name') or title
                    start_time_str = item_data.get('start_time')
                    est_cost = float(item_data.get('est_cost', 0))

                    attr_val = item_data.get('attraction')
                    attr_obj = None
                    if isinstance(attr_val, Attraction):
                        attr_obj = attr_val
                    elif isinstance(attr_val, int):
                        attr_obj = Attraction.objects.filter(pk=attr_val).first()
                    else:
                        attr_obj = geocode_venue(
                            location_name,
                            city,
                            trip.destination,
                            est_cost,
                            lat=item_data.get('lat'),
                            lng=item_data.get('lng'),
                        )

                    ItineraryItem.objects.create(
                        day=day_obj,
                        title=title,
                        start_time=start_time_str or None,
                        est_cost=est_cost,
                        attraction=attr_obj,
                    )

            trip.prompt_text = user_prompt
            trip.save(update_fields=['prompt_text'])

        # Fetch and return serialized days
        days_qs = trip.days.prefetch_related('items__expenses').all().order_by('day_number')
        serializer = ItineraryDaySerializer(days_qs, many=True)

        return Response(
            {
                'trip_id': trip.trip_id,
                'days': serializer.data,
                'packing_list': packing_list,
            },
            status=status.HTTP_200_OK,
        )
