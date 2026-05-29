import { test, expect } from '@playwright/test';

test.describe('Social, Explore & Invite E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Giả lập token để bypass checkAuth
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
        }),
      });
    });

    // Mock API sidebar/app cơ bản
    await page.route('**/api/conversations', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  });

  test('should manage friends requests and unfriend correctly', async ({ page }) => {
    // Mock dữ liệu danh sách bạn bè và lời mời
    await page.route('**/api/friends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { _id: 'f1', otherUserId: 'userBob' }
        ]),
      });
    });

    await page.route('**/api/messages/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { _id: 'userBob', email: 'bob@example.com', fullName: 'Bob Builder', profilePic: '' },
          { _id: 'userCharlie', email: 'charlie@example.com', fullName: 'Charlie Chaplin', profilePic: '' },
          { _id: 'userDave', email: 'dave@example.com', fullName: 'Dave Builder', profilePic: '' }
        ]),
      });
    });

    await page.route('**/api/friends/requests?type=incoming', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { otherUserId: 'userCharlie' }
        ]),
      });
    });

    await page.route('**/api/friends/requests?type=outgoing', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // 1. Chấp nhận lời mời kết bạn (Accept Friend Request)
    await page.route('**/api/friends/requests/userCharlie/accept', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Success' }),
      });
    });

    // 2. Gửi lời mời kết bạn mới
    await page.route('**/api/friends/requests', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Request sent' }),
        });
      }
    });

    // 3. Hủy kết bạn (Unfriend)
    await page.route('**/api/friends/userBob', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Friend removed' }),
        });
      }
    });

    await page.goto('/friends');

    // Kiểm tra danh sách bạn bè
    await expect(page.getByText('Friends (1)')).toBeVisible();
    await expect(page.getByText('Bob Builder')).toBeVisible();

    // Chấp nhận lời mời của Charlie
    await expect(page.getByText('Charlie Chaplin')).toBeVisible();
    await page.getByRole('button', { name: 'Accept' }).click();
    await expect(page.getByText('Friend request accepted')).toBeVisible();

    // Gửi lời mời kết bạn mới qua email (sử dụng email của Dave để tránh trùng lặp trong knownIds)
    const emailInput = page.locator('input[placeholder="Enter friend\'s email (e.g. name@gmail.com)"]');
    await emailInput.fill('dave@example.com');
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText('Friend request sent')).toBeVisible();

    // Hủy kết bạn với Bob Builder
    // Cần setup dialog handler vì hành động Unfriend kích hoạt window.confirm
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Bạn chắc chắn muốn hủy kết bạn');
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Hủy kết bạn' }).click();
    await expect(page.getByText('Friend removed')).toBeVisible();
  });

  test('should search users and explore public groups', async ({ page }) => {
    // Mock tìm kiếm user
    await page.route('**/api/users/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { _id: 'userCharlie', email: 'charlie@example.com', fullName: 'Charlie Chaplin', profilePic: '' }
        ]),
      });
    });

    // Mock khám phá nhóm
    await page.route('**/api/conversations/explore*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            conversationId: 'GROUP#groupExplore',
            title: 'Developers Club',
            topic: 'TECH',
            description: 'Public community for coders',
            memberCount: 42,
            isMember: false,
            avatar: '',
            cover: '',
            createdAt: new Date().toISOString(),
          }
        ]),
      });
    });

    // Mock tham gia nhóm
    await page.route('**/api/conversations/GROUP%23groupExplore/join', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId: 'GROUP#groupExplore',
          title: 'Developers Club',
          type: 'GROUP',
        }),
      });
    });

    await page.goto('/explore');

    // --- 1. Tìm kiếm Người dùng ---
    const userSearchInput = page.locator('input[placeholder="Tìm theo tên, email hoặc ID..."]');
    await userSearchInput.fill('Charlie');
    // Chờ debounce tìm kiếm và xác nhận hiển thị
    await expect(page.getByText('Charlie Chaplin')).toBeVisible();

    // --- 2. Khám phá & Tham gia Nhóm ---
    await page.getByRole('button', { name: 'Nhóm', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Developers Club' })).toBeVisible();

    // Click xem chi tiết nhóm
    await page.getByRole('heading', { name: 'Developers Club' }).click();
    await expect(page.getByText('Public community for coders')).toBeVisible();

    // Click Tham gia nhóm
    await page.getByRole('button', { name: 'Tham gia nhóm' }).click();
    await expect(page.getByText('Đã tham gia nhóm')).toBeVisible();

    // Đợi chuyển hướng về trang chủ
    await expect(page).toHaveURL('/');
  });

  test('should load invite preview and join group via link', async ({ page }) => {
    // Mock preview invite
    await page.route('**/api/invites/inviteCode123/preview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Awesome Coders',
          avatar: '',
          memberCount: 100,
          canJoin: true,
          joinPolicy: 'OPEN'
        }),
      });
    });

    // Mock accept invite
    await page.route('**/api/invites/inviteCode123/join', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId: 'GROUP#awesomeCoders',
          title: 'Awesome Coders',
        }),
      });
    });

    await page.goto('/invite/inviteCode123');

    // Kiểm tra thông tin preview hiển thị chính xác
    await expect(page.getByRole('heading', { name: 'Awesome Coders' })).toBeVisible();
    await expect(page.getByText('100 thành viên')).toBeVisible();

    // Click Tham gia
    await page.getByRole('button', { name: 'Tham gia nhóm' }).click();
    await expect(page.getByText('Đã tham gia nhóm')).toBeVisible();

    // Chuyển hướng thành công về trang chủ
    await expect(page).toHaveURL('/');
  });
});
