import { test, expect } from '@playwright/test';

test.describe('Profile & Settings Page E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Giả lập token để checkAuth thành công
    await page.addInitScript(() => {
      window.localStorage.setItem('rushcord_access_token', 'fake_access_token');
      window.localStorage.setItem('rushcord_refresh_token', 'fake_refresh_token');
    });

    // Giả lập người dùng đăng nhập
    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'userAlice',
          email: 'alice@example.com',
          fullName: 'Alice Watson',
          profilePic: '',
          coverPic: '',
          dateOfBirth: '1990-01-01',
          gender: 'FEMALE',
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      });
    });

    // Mock các API phụ trợ của Sidebar/App để tránh kẹt loading
    await page.route('**/api/conversations', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/friends', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/friends/requests**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/messages/users', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  });

  test('should allow user to change themes in settings page', async ({ page }) => {
    await page.goto('/settings');

    // Mặc định app container có theme dark
    const appShell = page.locator('.discord-app-shell');
    await expect(appShell).toHaveAttribute('data-theme', 'dark');

    // Click chọn theme "Cupcake"
    const cupcakeThemeCard = page.getByRole('button', { name: 'Cupcake' });
    await expect(cupcakeThemeCard).toBeVisible();
    await cupcakeThemeCard.click();

    // Xác nhận preview panel đổi sang cupcake theme nhưng app shell chính vẫn chưa đổi
    const previewPanel = page.locator('.p-5 [data-theme="cupcake"]').first();
    await expect(previewPanel).toBeVisible();
    await expect(appShell).toHaveAttribute('data-theme', 'dark');

    // Thử nút Hoàn tác (Undo)
    const undoButton = page.getByRole('button', { name: 'Hoàn tác' });
    await undoButton.click();
    // Preview panel phải quay lại theme dark (do Undo)
    const previewPanelDark = page.locator('.p-5 [data-theme="dark"]').first();
    await expect(previewPanelDark).toBeVisible();

    // Click lại Cupcake và bấm Áp dụng (Apply)
    await cupcakeThemeCard.click();
    const applyButton = page.getByRole('button', { name: 'Áp dụng' });
    await applyButton.click();

    // Xác nhận app shell đổi màu sang cupcake thành công
    await expect(appShell).toHaveAttribute('data-theme', 'cupcake');
  });

  test('should allow user to edit personal profile details', async ({ page }) => {
    // Thiết lập mock cho API update profile
    await page.route('**/api/auth/update-profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'userAlice',
          email: 'alice@example.com',
          fullName: 'Trần Văn B',
          profilePic: '',
          coverPic: '',
          dateOfBirth: '1995-05-15',
          gender: 'MALE',
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      });
    });

    await page.goto('/profile');

    // Kiểm tra tên ban đầu hiển thị
    await expect(page.getByRole('heading', { name: 'Alice Watson' })).toBeVisible();

    // Bấm nút Chỉnh sửa
    await page.getByRole('button', { name: 'Chỉnh sửa' }).click();

    // Điền thông tin cá nhân mới
    await page.locator('input[placeholder="Nguyễn"]').fill('Trần');
    await page.locator('input[placeholder="Văn An"]').fill('Văn B');
    await page.locator('input[type="date"]').fill('1995-05-15');
    await page.locator('select').selectOption('MALE');

    // Click Lưu
    await page.getByRole('button', { name: 'Lưu' }).click();

    // Đợi cập nhật và toast success hiển thị
    await expect(page.getByText('Profile updated successfully')).toBeVisible();

    // Tên mới đã được hiển thị trên banner
    await expect(page.getByRole('heading', { name: 'Trần Văn B' })).toBeVisible();
  });

  test('should validate changing email and password in security section', async ({ page }) => {
    // Mock các API bảo mật
    await page.route('**/api/auth/request-email-change', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Link sent' }),
      });
    });

    await page.route('**/api/auth/change-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Password updated' }),
      });
    });

    await page.goto('/profile');

    // Chuyển sang danh mục "Thông tin bảo mật"
    await page.getByRole('button', { name: 'Thông tin bảo mật' }).click();
    await expect(page.getByText('Email đăng nhập', { exact: true })).toBeVisible();

    // Bấm Chỉnh sửa
    await page.getByRole('button', { name: 'Chỉnh sửa' }).click();

    // --- 1. Test đổi Email ---
    await page.locator('input[placeholder="email.moi@example.com"]').fill('new.email@example.com');
    await page.locator('input[autoComplete="current-password"]').first().fill('MyPassword123!');
    await page.getByRole('button', { name: 'Gửi link xác nhận' }).click();

    // Xác nhận đã thông báo gửi link email thành công
    await expect(page.getByText('Đã gửi link — kiểm tra hộp thư email hiện tại')).toBeVisible();

    // --- 2. Test đổi Mật khẩu ---
    const currentPassInput = page.locator('div:has-text("Mật khẩu hiện tại") > div > input');
    const newPassInput = page.locator('div:has-text("Mật khẩu mới") > div > input').first();
    const confirmPassInput = page.locator('div:has-text("Xác nhận mật khẩu mới") > div > input');

    // Nhập sai mật khẩu xác nhận
    await currentPassInput.fill('OldPassword123!');
    await newPassInput.fill('NewPassword123!');
    await confirmPassInput.fill('Different123!');
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();

    // Hiển thị toast cảnh báo không khớp
    await expect(page.getByText('Mật khẩu xác nhận không khớp')).toBeVisible();

    // Nhập đúng mật khẩu xác nhận và đổi thành công
    await confirmPassInput.fill('NewPassword123!');
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    await expect(page.getByText('Đã đổi mật khẩu thành công')).toBeVisible();
  });
});
