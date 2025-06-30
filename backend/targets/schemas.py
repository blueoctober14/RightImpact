from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum

class ImportStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class TargetListBase(BaseModel):
    name: str
    description: Optional[str] = None

class TargetListCreate(TargetListBase):
    pass

class TargetListUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ImportStatus] = None

class TargetListInDBBase(TargetListBase):
    id: int
    status: ImportStatus
    total_contacts: int = 0
    imported_contacts: int = 0
    failed_contacts: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TargetList(TargetListInDBBase):
    pass

class TargetContactBase(BaseModel):
    voter_id: str
    first_name: str
    last_name: str
    zip_code: str
    address_1: Optional[str] = None
    address_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    county: Optional[str] = None
    precinct: Optional[str] = None
    cell_1: Optional[str] = None
    cell_2: Optional[str] = None
    cell_3: Optional[str] = None
    landline_1: Optional[str] = None
    landline_2: Optional[str] = None
    landline_3: Optional[str] = None

class TargetContactCreate(TargetContactBase):
    pass

class TargetContactInDBBase(TargetContactBase):
    id: int
    list_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TargetContact(TargetContactInDBBase):
    pass

class TargetImportRequest(BaseModel):
    list_name: str
    description: Optional[str] = None
    field_mapping: Dict[str, str]

class TargetImportResponse(BaseModel):
    import_id: int
    status: str
    message: Optional[str] = None

class TargetListResponse(BaseModel):
    lists: List[TargetList]
    total: int

class TargetContactResponse(BaseModel):
    contacts: List[TargetContact]
    total: int
    list_id: Optional[int] = None
    list_name: Optional[str] = None
