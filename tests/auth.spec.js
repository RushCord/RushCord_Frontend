import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  // Mock API Base
  const apiPattern = '**/api/auth/**';

  test('should redirect unauthenticated users to login page', async ({ page }) => {
    // Giả lập checkAuth trả về lỗi 401 (chưa đăng nhập)
    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    await page.goto('/');
    
    // Đợi trang tự động chuyển hướng về /login
    await expect(page).toHaveURL(/\/login/);
    
    // Kiểm tra các thành phần của trang login có hiển thị
    await expect(page.locator('form')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome Back', exact: true })).toBeVisible();
  });

  test('should show error toast on login failure', async ({ page }) => {
    // Giả lập checkAuth trả về lỗi 401
    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    // Giả lập login API trả về lỗi 400 Bad Request
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid email or password' }),
      });
    });

    await page.goto('/login');

    // Nhập email và password
    await page.getByPlaceholder('you@example.com').fill('wrong@example.com');
    await page.getByPlaceholder('••••••••').fill('wrongpassword');

    // Click Sign in
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Đợi toast thông báo lỗi hiển thị
    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });

  test('should login successfully and redirect to homepage', async ({ page }) => {
    // Giả lập ban đầu chưa đăng nhập
    let isLoggedIn = false;

    await page.route('**/api/auth/check', async (route) => {
      if (!isLoggedIn) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Unauthorized' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            _id: 'user123',
            email: 'test@example.com',
            displayName: 'Test User',
            profilePic: '',
          }),
        });
      }
    });

    // Giả lập login API trả về access token
    await page.route('**/api/auth/login', async (route) => {
      isLoggedIn = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'fake_access_token',
          refreshToken: 'fake_refresh_token',
        }),
      });
    });

    await page.goto('/login');

    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByPlaceholder('••••••••').fill('Password123!');

    await page.getByRole('button', { name: 'Sign in' }).click();

    // Đợi toast thông báo đăng nhập thành công
    await expect(page.getByText('Logged in successfully')).toBeVisible();

    // Đợi chuyển hướng về trang chủ
    await expect(page).toHaveURL('/');
  });

  test('should navigate to signup and complete registration flow', async ({ page }) => {
    // Giả lập API checkAuth trả về 401
    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    // Giả lập API register
    await page.route('**/api/auth/register', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userSub: 'fake-sub-id',
          pendingConfirmation: true,
        }),
      });
    });

    await page.goto('/login');

    // Nhấp vào link chuyển sang màn Đăng ký
    await page.getByRole('link', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/signup/);

    // Điền thông tin đăng ký
    await page.getByPlaceholder('John Doe').fill('New User');
    await page.getByPlaceholder('you@example.com').fill('newuser@example.com');
    // Trường password có hint Cognito, điền đúng định dạng
    await page.getByPlaceholder('••••••••').fill('NewUser123!');

    // Click submit
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Check toast
    await expect(page.getByText('Check your email for the verification code')).toBeVisible();

    // Phải chuyển hướng đến trang xác nhận email confirm-email
    await expect(page).toHaveURL(/\/confirm-email/);
  });
});
