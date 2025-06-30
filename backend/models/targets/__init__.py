# Import all target models to make them available when importing from models.targets
from .target_list import TargetList
from .target_contact import TargetContact

# Make these available at the package level
__all__ = [
    'TargetList',
    'TargetContact',
]
