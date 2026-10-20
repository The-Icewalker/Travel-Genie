from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AttractionViewSet,
    DestinationViewSet,
    ItineraryDayViewSet,
    ItineraryItemViewSet,
    TripViewSet,
)

router = DefaultRouter()
router.register(r'trips', TripViewSet, basename='trip')
router.register(r'destinations', DestinationViewSet, basename='destination')
router.register(r'attractions', AttractionViewSet, basename='attraction')
router.register(r'itinerary-days', ItineraryDayViewSet, basename='itinerary-day')
router.register(r'itinerary-items', ItineraryItemViewSet, basename='itinerary-item')

urlpatterns = [
    path('', include(router.urls)),
]
