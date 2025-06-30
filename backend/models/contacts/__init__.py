# Import all contact models to make them available when importing from models.contacts
from .campaign_contact import CampaignContact

# Make these available at the package level
__all__ = [
    'CampaignContact',
]
