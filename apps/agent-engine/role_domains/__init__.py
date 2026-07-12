"""AgentNet — role-detection domain taxonomy.

Each profession domain (name, keywords, recommended agents, dashboard
widgets, quick actions) lives in its own module in this package. This
module just collects them into the ``DOMAINS`` lookup used by
``role_detection.py``.
"""
from __future__ import annotations

from typing import Any

from . import (
    agriculture,
    construction,
    education,
    finance,
    food_service,
    general,
    government,
    healthcare,
    industry,
    law,
    media,
    religion,
    retail,
    sports,
    tech,
    transport,
)

DOMAINS: dict[str, dict[str, Any]] = {
    "healthcare": healthcare.DOMAIN,
    "law": law.DOMAIN,
    "government": government.DOMAIN,
    "education": education.DOMAIN,
    "agriculture": agriculture.DOMAIN,
    "retail": retail.DOMAIN,
    "finance": finance.DOMAIN,
    "tech": tech.DOMAIN,
    "construction": construction.DOMAIN,
    "transport": transport.DOMAIN,
    "food_service": food_service.DOMAIN,
    "industry": industry.DOMAIN,
    "religion": religion.DOMAIN,
    "media": media.DOMAIN,
    "sports": sports.DOMAIN,
    "general": general.DOMAIN,
}
