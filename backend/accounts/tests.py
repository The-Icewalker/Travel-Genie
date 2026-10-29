from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class AuthAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.traveler = User.objects.create_user(
            email='traveler@travelgenie.com',
            password='Travel@123',
            full_name='Traveler Test',
        )
        self.admin = User.objects.create_superuser(
            email='admin@travelgenie.com',
            password='admin123',
            full_name='Admin Test',
        )

    def test_traveler_login_success(self):
        res = self.client.post(
            '/api/auth/login/',
            {'email': 'traveler@travelgenie.com', 'password': 'Travel@123'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)

    def test_admin_login_success(self):
        res = self.client.post(
            '/api/auth/login/',
            {'email': 'admin@travelgenie.com', 'password': 'admin123'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)

    def test_admin_login_alt_password_success(self):
        res = self.client.post(
            '/api/auth/login/',
            {'email': 'admin@travelgenie.com', 'password': 'Admin@123'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)

    def test_login_invalid_password(self):
        res = self.client.post(
            '/api/auth/login/',
            {'email': 'traveler@travelgenie.com', 'password': 'WrongPassword999!'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_authenticated(self):
        login_res = self.client.post(
            '/api/auth/login/',
            {'email': 'traveler@travelgenie.com', 'password': 'Travel@123'},
            format='json',
        )
        token = login_res.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        me_res = self.client.get('/api/auth/me/')
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)
        self.assertEqual(me_res.data.get('email'), 'traveler@travelgenie.com')

    def test_me_unauthenticated(self):
        me_res = self.client.get('/api/auth/me/')
        self.assertEqual(me_res.status_code, status.HTTP_401_UNAUTHORIZED)
