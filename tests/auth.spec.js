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

  test('should persist session after page reload', async ({ page }) => {
    // Giả lập token trong localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('rushcord_access_token', 'fake_access_token');
      window.localStorage.setItem('rushcord_refresh_token', 'fake_refresh_token');
    });

    // Giả lập checkAuth thành công
    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'user123',
          email: 'test@example.com',
          fullName: 'Test User',
        }),
      });
    });

    await page.goto('/');
    // Vẫn ở trang chủ
    await expect(page).toHaveURL('/');
    
    // Reload trang
    await page.reload();
    await expect(page).toHaveURL('/');
  });

  test('should clear tokens and redirect to login on logout', async ({ page }) => {
    // Giả lập token và trạng thái đăng nhập
    await page.addInitScript(() => {
      window.localStorage.setItem('rushcord_access_token', 'fake_access_token');
      window.localStorage.setItem('rushcord_refresh_token', 'fake_refresh_token');
    });

    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ _id: 'user123', fullName: 'Test User' }),
      });
    });

    // Mock API logout
    await page.route('**/api/auth/logout', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    // Mock các endpoint phụ trợ để tránh kẹt
    await page.route('**/api/conversations', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/friends**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/messages/users', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/');

    // Mở UserSettingsModal bằng cách click nút Cài đặt ở SidebarUserBar
    await page.locator('button[title="Cài đặt"]').click();

    // Click Đăng Xuất
    await page.getByRole('button', { name: 'Đăng Xuất' }).click();

    // Xác nhận đã chuyển hướng về trang login
    await expect(page).toHaveURL(/\/login/);

    // Xác nhận localStorage đã bị xóa sạch token
    const token = await page.evaluate(() => window.localStorage.getItem('rushcord_access_token'));
    expect(token).toBeNull();
  });

  test('should validate password complexity on signup', async ({ page }) => {
    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    // Mock API register báo lỗi độ phức tạp mật khẩu
    await page.route('**/api/auth/register', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Password must have uppercase, lowercase, numbers, and special characters' }),
      });
    });

    await page.goto('/signup');

    await page.getByPlaceholder('John Doe').fill('New User');
    await page.getByPlaceholder('you@example.com').fill('new@example.com');
    await page.getByPlaceholder('••••••••').fill('simplepassword');

    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Password must have uppercase, lowercase, numbers, and special characters')).toBeVisible();
  });

  test('should validate forgot password flow with success', async ({ page }) => {
    // Giả lập checkAuth trả về 401
    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    // Mock API forgot-password thành công
    await page.route('**/api/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Success' }),
      });
    });

    await page.goto('/forgot-password');

    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    // Check success toast
    await expect(page.getByText('If an account exists for this email, we sent a reset link')).toBeVisible();
  });

  test('should validate forgot password flow with email not found error', async ({ page }) => {
    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    // Mock API forgot-password trả về lỗi 404
    await page.route('**/api/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Could not send reset link' }),
      });
    });

    await page.goto('/forgot-password');

    await page.getByPlaceholder('you@example.com').fill('nonexistent@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    // Check error toast
    await expect(page.getByText('Could not send reset link')).toBeVisible();
  });

  test('should validate reset password flow successfully', async ({ page }) => {
    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    // Mock API reset-password thành công
    await page.route('**/api/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Success' }),
      });
    });

    // Truy cập trực tiếp link Reset Password với search params hợp lệ
    await page.goto('/reset-password?email=test@example.com&code=123456');

    // Điền mật khẩu mới và xác nhận mật khẩu mới
    const newPassField = page.locator('div:has-text("New password") > div > input').first();
    const confirmPassField = page.locator('div:has-text("Confirm password") > div > input');

    await newPassField.fill('NewPass123!');
    await confirmPassField.fill('NewPass123!');

    await page.getByRole('button', { name: 'Update password' }).click();

    // Đợi toast thông báo thành công
    await expect(page.getByText('Password updated. You can sign in now.')).toBeVisible();

    // Chuyển hướng về login
    await expect(page).toHaveURL(/\/login/);
  });
});
