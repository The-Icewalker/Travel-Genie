from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookingViewSet, FlightViewSet, HotelViewSet

router = DefaultRouter()
router.register(r'', BookingViewSet, basename='booking')
router.register(r'flights', FlightViewSet, basename='flight')
router.register(r'hotels', HotelViewSet, basename='hotel')

urlpatterns = [
    path('', include(router.urls)),
]
