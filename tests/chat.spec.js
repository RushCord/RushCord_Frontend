import { test, expect } from '@playwright/test';

test.describe('Real-time Chatting & Inbox', () => {
  const conversationId = 'DM#userAlice_userBob';

  test.beforeEach(async ({ page }) => {
    // Giả lập token trong localStorage để checkAuth không tự động return null
    await page.addInitScript(() => {
      window.localStorage.setItem('rushcord_access_token', 'fake_access_token');
      window.localStorage.setItem('rushcord_refresh_token', 'fake_refresh_token');
    });

    // Giả lập trạng thái đã đăng nhập dưới tên Alice
    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'userAlice',
          email: 'alice@example.com',
          displayName: 'Alice Watson',
          profilePic: '',
        }),
      });
    });

    // Giả lập danh sách bạn bè
    await page.route('**/api/friends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { _id: 'userBob', email: 'bob@example.com', fullName: 'Bob Builder', profilePic: '' }
        ]),
      });
    });
    
    await page.route('**/api/friends/requests**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Giả lập danh sách các cuộc hội thoại gần đây (Inbox)
    await page.route('**/api/conversations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            conversationId: conversationId,
            type: 'DM',
            otherUserId: 'userBob',
            title: 'Bob Builder',
            lastMessage: {
              _id: 'msg1',
              senderId: 'userBob',
              text: 'Hey Alice, are you there?',
              createdAt: new Date().toISOString(),
            },
          },
        ]),
      });
    });

    // Giả lập danh sách User trong hệ thống
    await page.route('**/api/messages/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { _id: 'userBob', email: 'bob@example.com', fullName: 'Bob Builder', profilePic: '' }
        ]),
      });
    });

    // Giả lập lịch sử tin nhắn của cuộc hội thoại (API gọi dạng /messages/userBob)
    await page.route('**/api/messages/userBob*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            _id: 'msg1',
            senderId: 'userBob',
            text: 'Hey Alice, are you there?',
            createdAt: new Date(Date.now() - 60000).toISOString(),
          }
        ]),
      });
    });
  });

  test('should display conversations sidebar and allow selecting a chat', async ({ page }) => {
    await page.goto('/');

    // Kiểm tra xem danh sách tin nhắn trực tiếp có hiển thị tên Bob Builder không
    const chatButton = page.locator(`button[title="Bob Builder"]`);
    await expect(chatButton).toBeVisible();

    // Click chọn phòng chat của Bob
    await chatButton.click();

    // Kiểm tra xem lịch sử tin nhắn đã tải lên đúng tin nhắn "Hey Alice, are you there?"
    await expect(page.getByText('Hey Alice, are you there?', { exact: true })).toBeVisible();
  });

  test('should allow user to type and send a text message', async ({ page }) => {
    // Giả lập gửi tin nhắn thành công
    await page.route(`**/api/messages/send/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'msgNew123',
          senderId: 'userAlice',
          text: 'Hello Bob! I am here.',
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/');

    // Vào phòng chat Bob
    await page.locator(`button[title="Bob Builder"]`).click();

    // Tìm input nhắn tin (sử dụng placeholder Nhắn #...)
    const messageInput = page.locator('input[placeholder^="Nhắn #"]');
    await expect(messageInput).toBeVisible();

    // Gõ tin nhắn
    await messageInput.fill('Hello Bob! I am here.');

    // Bấm Enter hoặc bấm nút Send
    await messageInput.press('Enter');

    // Xác nhận input đã trống sau khi gửi
    await expect(messageInput).toHaveValue('');
  });
});
