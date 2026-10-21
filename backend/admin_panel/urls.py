from django.urls import path
from .views import (
    AnalyticsView,
    AvgHotelPriceAnalyticsView,
    SiteStatsView,
    TripsPerUserAnalyticsView,
    UserDetailView,
    UserListView,
)

urlpatterns = [
    path('users/', UserListView.as_view(), name='admin-users'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='admin-user-detail'),
    path('analytics/', AnalyticsView.as_view(), name='admin-analytics'),
    path('analytics/trips-per-user/', TripsPerUserAnalyticsView.as_view(), name='admin-trips-per-user'),
    path('analytics/avg-hotel-price/', AvgHotelPriceAnalyticsView.as_view(), name='admin-avg-hotel-price'),
    path('analytics/stats/', SiteStatsView.as_view(), name='admin-site-stats'),
]
