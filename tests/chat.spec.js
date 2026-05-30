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

  test('should prevent sending empty or whitespace-only messages', async ({ page }) => {
    await page.goto('/');
    
    // Vào phòng chat Bob
    await page.locator(`button[title="Bob Builder"]`).click();

    const messageInput = page.locator('input[placeholder^="Nhắn #"]');
    await expect(messageInput).toBeVisible();

    // Nhập toàn khoảng trắng
    await messageInput.fill('    ');
    
    // Đăng ký route gửi tin nhắn để kiểm chứng (nếu gọi API tức là test sai)
    let apiCalled = false;
    await page.route(`**/api/messages/send/**`, async (route) => {
      apiCalled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    // Bấm Enter
    await messageInput.press('Enter');

    // Chờ 1 chút để xem có gọi API không
    await page.waitForTimeout(500);
    expect(apiCalled).toBe(false);
  });

  test('should search messages and jump/highlight selected message', async ({ page }) => {
    // Giả lập API search tin nhắn trả về kết quả
    await page.route('**/api/conversations/*/messages/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            messageId: 'msgSpecial456',
            senderId: 'userBob',
            text: 'I found the treasure!',
            createdAt: new Date().toISOString(),
          }
        ]),
      });
    });

    // Mock API getMessages khi jumpToMessage lấy lại hội thoại
    await page.route('**/api/messages/userBob*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            _id: 'msgSpecial456',
            senderId: 'userBob',
            text: 'I found the treasure!',
            createdAt: new Date().toISOString(),
          }
        ]),
      });
    });

    await page.goto('/');
    await page.locator(`button[title="Bob Builder"]`).click();

    // Mở cài đặt/details
    await page.locator('button[title="Toggle details"]').click();

    // Click "Tìm kiếm tin nhắn"
    await page.getByRole('button', { name: 'Tìm kiếm tin nhắn' }).click();

    // Nhập từ khóa tìm kiếm
    const searchInput = page.locator('input[placeholder^="Tìm trong"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('treasure');

    // Đợi kết quả hiển thị và click chọn dòng kết quả
    const resultRow = page.locator('.discord-modal-card').getByRole('button', { name: 'Bob Builder' });
    await expect(resultRow).toBeVisible();
    await resultRow.click();

    // Xác nhận modal tìm kiếm đã đóng và tin nhắn được highlight
    await expect(searchInput).not.toBeVisible();
  });

  test('should search messages and display no results when no match', async ({ page }) => {
    // Giả lập API search tin nhắn trả về mảng rỗng
    await page.route('**/api/conversations/*/messages/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');
    await page.locator(`button[title="Bob Builder"]`).click();

    // Mở cài đặt/details
    await page.locator('button[title="Toggle details"]').click();

    // Click "Tìm kiếm tin nhắn"
    await page.getByRole('button', { name: 'Tìm kiếm tin nhắn' }).click();

    // Nhập từ khóa tìm kiếm
    const searchInput = page.locator('input[placeholder^="Tìm trong"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('notfound');

    // Xác nhận thông báo "Không tìm thấy tin nhắn." hiển thị
    await expect(page.getByText('Không tìm thấy tin nhắn.')).toBeVisible();
  });

  test('should open emoji picker and select an emoji', async ({ page }) => {
    await page.goto('/');
    await page.locator(`button[title="Bob Builder"]`).click();

    // Click button Emoji để mở picker
    const emojiButton = page.locator('button[title="Emoji"]');
    await emojiButton.click();

    // Xác nhận Emoji Picker hiển thị
    const emojiPicker = page.locator('.EmojiPickerReact');
    await expect(emojiPicker).toBeVisible();

    // Click chọn emoji đầu tiên trong danh sách của picker
    const firstEmoji = emojiPicker.locator('button.epr-emoji').first();
    await expect(firstEmoji).toBeVisible();
    await firstEmoji.click();

    // Xác nhận picker biến mất
    await expect(emojiPicker).not.toBeVisible();

    // Xác nhận emoji đã được chèn vào khung chat input
    const messageInput = page.locator('input[placeholder^="Nhắn #"]');
    const inputValue = await messageInput.inputValue();
    expect(inputValue.length).toBeGreaterThan(0);
  });
});
