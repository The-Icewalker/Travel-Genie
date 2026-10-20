from django.db.models import Sum
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from accounts.permissions import IsAdmin
from trips.models import Trip
from .models import Budget, Expense
from .serializers import BudgetSerializer, CategorySummarySerializer, ExpenseSerializer


class BudgetViewSet(viewsets.ModelViewSet):
    """
    CRUD for trip budgets.
    Travellers see only their own trips' budgets; admins see all.
    Supports update_or_create so setting a budget never fails on existing trips.
    """

    serializer_class = BudgetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Budget.objects.select_related('trip__user')
        if user.role_name == 'admin':
            qs = qs.all()
        else:
            qs = qs.filter(trip__user=user)
        trip_param = self.request.query_params.get('trip')
        if trip_param:
            qs = qs.filter(trip_id=trip_param)
        return qs

    def create(self, request, *args, **kwargs):
        trip_id = request.data.get('trip')
        total_amount = request.data.get('total_amount')
        currency = request.data.get('currency', 'USD')

        if not trip_id:
            return Response({'trip': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
        if total_amount is None:
            return Response({'total_amount': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

        try:
            trip = Trip.objects.get(pk=trip_id)
        except Trip.DoesNotExist:
            return Response({'trip': ['Trip not found.']}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if user.role_name != 'admin' and trip.user != user:
            raise PermissionDenied('You can only set budgets for your own trips.')

        budget_obj, created = Budget.objects.update_or_create(
            trip=trip,
            defaults={
                'total_amount': total_amount,
                'currency': currency,
            }
        )
        serializer = self.get_serializer(budget_obj)
        res_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=res_status)

    def perform_create(self, serializer):
        trip = serializer.validated_data['trip']
        user = self.request.user
        if user.role_name != 'admin' and trip.user != user:
            raise PermissionDenied('You can only set budgets for your own trips.')
        serializer.save()

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if user.role_name != 'admin' and obj.trip.user != user:
            raise PermissionDenied('You do not have permission to access this budget.')
        return obj


class ExpenseViewSet(viewsets.ModelViewSet):
    """
    CRUD for expenses.
    Travellers see only their own trips' expenses; admins see all.
    Includes a summary action aggregating spend per category.
    """

    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Expense.objects.select_related('trip__user', 'itinerary_item__day')
        if user.role_name == 'admin':
            qs = qs.all()
        else:
            qs = qs.filter(trip__user=user)
        trip_param = self.request.query_params.get('trip') or self.request.query_params.get('trip_id')
        if trip_param:
            qs = qs.filter(trip_id=trip_param)
        return qs

    def perform_create(self, serializer):
        trip = serializer.validated_data['trip']
        user = self.request.user
        if user.role_name != 'admin' and trip.user != user:
            raise PermissionDenied('You can only add expenses for your own trips.')
        serializer.save()

    def perform_destroy(self, instance):
        item = instance.itinerary_item
        instance.delete()
        if item:
            item.delete()

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if user.role_name != 'admin' and obj.trip.user != user:
            raise PermissionDenied('You do not have permission to access this expense.')
        return obj

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        Returns spend per category, optionally filtered by trip_id.
        Example: GET /api/budget/expenses/summary/?trip_id=5 or ?trip=5
        """
        user = request.user
        trip_id = request.query_params.get('trip_id') or request.query_params.get('trip')

        qs = Expense.objects.all()

        if trip_id:
            try:
                trip = Trip.objects.get(pk=trip_id)
            except Trip.DoesNotExist:
                raise NotFound('Trip not found.')
            if user.role_name != 'admin' and trip.user != user:
                raise PermissionDenied('You do not have access to this trip.')
            qs = qs.filter(trip_id=trip_id)
        else:
            if user.role_name != 'admin':
                qs = qs.filter(trip__user=user)

        data = (
            qs.values('category')
            .annotate(total=Sum('amount'))
            .order_by('category')
        )

        serializer = CategorySummarySerializer(data, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
