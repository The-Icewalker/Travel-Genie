from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BudgetViewSet, ExpenseViewSet

router = DefaultRouter()
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'budgets', BudgetViewSet, basename='budget')

urlpatterns = [
    path('by-category/', ExpenseViewSet.as_view({'get': 'summary'}), name='expense-by-category'),
    path('', include(router.urls)),
]
