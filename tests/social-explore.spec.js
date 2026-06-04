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

  test('should allow declining incoming friend request and canceling outgoing request', async ({ page }) => {
    // Mock incoming request từ Charlie
    await page.route('**/api/friends/requests?type=incoming', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ otherUserId: 'userCharlie' }]),
      });
    });

    // Mock outgoing request tới Bob
    await page.route('**/api/friends/requests?type=outgoing', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ otherUserId: 'userBob' }]),
      });
    });

    await page.route('**/api/messages/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { _id: 'userBob', email: 'bob@example.com', fullName: 'Bob Builder' },
          { _id: 'userCharlie', email: 'charlie@example.com', fullName: 'Charlie Chaplin' }
        ]),
      });
    });

    // Mock API xóa/từ chối lời mời
    await page.route('**/api/friends/requests/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Request removed' }),
        });
      }
    });

    await page.goto('/friends');

    // 1. Từ chối lời mời đến (Decline)
    await expect(page.getByText('Charlie Chaplin')).toBeVisible();
    await page.getByRole('button', { name: 'Decline' }).click();
    await expect(page.getByText('Request removed').first()).toBeVisible();

    // 2. Hủy lời mời đi (Cancel)
    await expect(page.getByText('Bob Builder')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Request removed').first()).toBeVisible();
  });

  test('should display empty message when search results are empty', async ({ page }) => {
    // Mock tìm kiếm user rỗng
    await page.route('**/api/users/search*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // Mock tìm kiếm nhóm rỗng
    await page.route('**/api/conversations/explore*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/explore');

    // Tìm kiếm user không tồn tại
    const userSearchInput = page.locator('input[placeholder="Tìm theo tên, email hoặc ID..."]');
    await userSearchInput.fill('nonexistentuser');
    await expect(page.getByText('Không có người dùng phù hợp.')).toBeVisible();

    // Tìm kiếm nhóm không tồn tại
    await page.getByRole('button', { name: 'Nhóm', exact: true }).click();
    const groupSearchInput = page.locator('input[placeholder="Tìm nhóm theo tên..."]');
    await groupSearchInput.fill('nonexistentgroup');
    await expect(page.getByText('Không có nhóm phù hợp.')).toBeVisible();
  });

  test('should display error message for expired or invalid invite code', async ({ page }) => {
    // Mock API preview trả về null (lỗi / hết hạn)
    await page.route('**/api/invites/expiredCode/preview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null), // null biểu thị không tồn tại
      });
    });

    await page.goto('/invite/expiredCode');

    // Kiểm tra thông báo lỗi
    await expect(page.getByText('Lời mời không tồn tại hoặc đã hết hiệu lực')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tham gia nhóm' })).not.toBeVisible();
  });
});
