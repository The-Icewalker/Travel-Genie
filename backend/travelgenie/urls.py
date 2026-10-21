"""
URL configuration for TravelGenie AI.
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView

admin.site.site_header = 'TravelGenie Database Mission Control'
admin.site.site_title = 'TravelGenie Admin'
admin.site.index_title = 'PostgreSQL Database Tables & Records'

urlpatterns = [
    path('admin/', admin.site.urls),
    # Auth (register, login, logout, me, change-password)
    path('api/auth/', include('accounts.urls')),
    # Token refresh
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # Trips, destinations, attractions, itinerary
    path('api/', include('trips.urls')),
    # Bookings
    path('api/bookings/', include('bookings.urls')),
    # Budget & expenses
    path('api/budget/', include('budget.urls')),
    # AI planner
    path('api/ai/', include('ai_planner.urls')),
    # Admin panel analytics
    path('api/admin-panel/', include('admin_panel.urls')),
    path('api/admin/', include('admin_panel.urls')),
]

from django.conf import settings
from django.urls import re_path
from django.views.static import serve

urlpatterns += [
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
]
