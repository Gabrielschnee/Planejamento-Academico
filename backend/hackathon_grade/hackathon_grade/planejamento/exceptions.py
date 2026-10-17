from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler


def handler(exc, context):
    """Converte ValidationError do Django (regras de negócio nos models) em HTTP 400."""
    if isinstance(exc, DjangoValidationError):
        detail = exc.message_dict if hasattr(exc, "error_dict") else exc.messages
        exc = ValidationError(detail)
    return exception_handler(exc, context)
