import { test, expect } from '@playwright/test';

test.describe('Voice/Video Call Screen UI', () => {
  const conversationId = 'GROUP#group123';
  const voiceChannelId = 'voice_chan_456';
  const roomName = `${conversationId}#VOICE#${voiceChannelId}`;

  test.beforeEach(async ({ page }) => {
    // Giả lập token trong localStorage để checkAuth không tự động return null
    await page.addInitScript(() => {
      window.localStorage.setItem('rushcord_access_token', 'fake_access_token');
      window.localStorage.setItem('rushcord_refresh_token', 'fake_refresh_token');
    });

    // Giả lập trạng thái đã đăng nhập
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

    // Giả lập danh sách các cuộc hội thoại (Nhóm)
    await page.route('**/api/conversations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            conversationId: conversationId,
            type: 'GROUP',
            title: 'Test Group',
            avatar: '',
          },
        ]),
      });
    });

    // Giả lập danh sách bạn bè để tránh kẹt call thực tế
    await page.route('**/api/friends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/friends/requests**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Giả lập danh sách User trong hệ thống để tránh kẹt loading xương cá (skeleton) ở Sidebar
    await page.route('**/api/messages/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { _id: 'userAlice', email: 'alice@example.com', fullName: 'Alice Watson', profilePic: '' }
        ]),
      });
    });

    // Giả lập danh sách kênh trong nhóm
    await page.route(`**/api/conversations/${encodeURIComponent(conversationId)}/channels`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            channelId: 'chat_chan_123',
            channelType: 'CHAT',
            name: 'general',
          },
          {
            channelId: voiceChannelId,
            channelType: 'VOICE',
            name: 'Voice channel',
          },
        ]),
      });
    });

    // Giả lập danh sách thành viên trong nhóm
    await page.route(`**/api/conversations/${encodeURIComponent(conversationId)}/members`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { userId: 'userAlice', role: 'OWNER' }
        ]),
      });
    });

    // Giả lập API livekit token trả về URL/Token mock
    await page.route('**/api/livekit/token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'ws://localhost:7880', // mock LiveKit Server URL
          token: 'fake_livekit_token',
        }),
      });
    });
  });

  test('should render voice channel in sidebar and open video call ui on click', async ({ page }) => {
    // 1. Vào trang chính
    await page.goto('/');

    // 2. Chuyển sang rail mode 'group'
    // Giả lập click chọn Group trong Sidebar
    const groupButton = page.locator(`button[title="Test Group"]`);
    await groupButton.click();

    // 3. Tìm kênh thoại "Voice channel"
    const voiceChanButton = page.getByRole('button', { name: 'Voice channel' });
    await expect(voiceChanButton).toBeVisible();

    // 4. Click chọn kênh thoại
    await voiceChanButton.click();

    // 5. Kiểm tra xem giao diện gọi Video đã hiển thị
    // Giao diện GroupVideoCall.jsx (embedded) chứa tiêu đề "Kênh thoại · Voice channel"
    const videoCallHeader = page.locator('h1', { hasText: 'Kênh thoại · Voice channel' });
    await expect(videoCallHeader).toBeVisible();

    // 6. Kiểm tra khung hình của local user ("Bạn") hiển thị
    await expect(page.getByText('Bạn')).toBeVisible();

    // 7. Kiểm tra nút "Rời kênh thoại" hiển thị ở user bar bên dưới sidebar
    const leaveButton = page.getByRole('button', { name: 'Rời kênh thoại' });
    await expect(leaveButton).toBeVisible();

    // 8. Thao tác click rời kênh thoại
    await leaveButton.click();

    // Xác nhận giao diện gọi video đã tắt (h1 biến mất)
    await expect(videoCallHeader).not.toBeVisible();
  });

  test('should allow toggling microphone, headphones, and camera during voice call', async ({ page }) => {
    await page.goto('/');
    const groupButton = page.locator(`button[title="Test Group"]`);
    await groupButton.click();

    const voiceChanButton = page.getByRole('button', { name: 'Voice channel' });
    await expect(voiceChanButton).toBeVisible();
    await voiceChanButton.click();

    // Kiểm tra nút mic, tai nghe, camera ban đầu
    const micButton = page.locator('button[title="Tắt mic"]');
    const headButton = page.locator('button[title="Tắt tai nghe"]');
    const camButton = page.locator('button[title="Bật camera"]');

    await expect(micButton).toBeVisible();
    await expect(headButton).toBeVisible();
    await expect(camButton).toBeVisible();

    // Click tắt mic -> chuyển thành "Bật mic"
    await micButton.click();
    await expect(page.locator('button[title="Bật mic"]')).toBeVisible();

    // Click tắt tai nghe -> chuyển thành "Bật tai nghe"
    await headButton.click();
    await expect(page.locator('button[title="Bật tai nghe"]')).toBeVisible();

    // Click bật camera -> chuyển thành "Tắt camera"
    await camButton.click();
    await expect(page.locator('button[title="Tắt camera"]')).toBeVisible();
  });

  test('should allow group owner to create, rename, and delete a channel', async ({ page }) => {
    // Mock API tạo kênh
    await page.route('**/api/conversations/*/channels', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Channel created' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              channelId: 'chat_chan_123',
              channelType: 'CHAT',
              name: 'general',
            },
            {
              channelId: voiceChannelId,
              channelType: 'VOICE',
              name: 'Voice channel',
            },
          ]),
        });
      }
    });

    // Mock API sửa tên kênh
    await page.route('**/api/conversations/*/channels/*', async (route) => {
      const method = route.request().method();
      if (method === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Channel renamed' }),
        });
      } else if (method === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Channel deleted' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.locator(`button[title="Test Group"]`).click();

    // --- 1. Tạo kênh mới ---
    await page.locator('button[title="Thêm kênh thoại"]').click();
    await page.locator('#channel-name-input').fill('kênh-thoại-mới');
    await page.getByRole('button', { name: 'Tạo kênh' }).click();
    await expect(page.getByText('Đã tạo kênh')).toBeVisible();

    // --- 2. Đổi tên kênh (Right click) ---
    const voiceChan = page.getByRole('button', { name: 'Voice channel' });
    await voiceChan.click({ button: 'right' });
    await page.getByRole('button', { name: 'Chỉnh sửa' }).click();
    await page.locator('#channel-name-input').fill('Voice channel edited');
    await page.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Đã đổi tên kênh')).toBeVisible();

    // --- 3. Xóa kênh (Right click) ---
    await voiceChan.click({ button: 'right' });
    await page.getByRole('button', { name: 'Xóa' }).click();
    // Bấm nút Xóa trong modal confirm xóa
    await page.locator('.discord-modal-card').getByRole('button', { name: 'Xóa' }).click();
    await expect(page.getByText('Đã xóa kênh')).toBeVisible();
  });

  test('should prevent group owner from renaming voice channel to empty', async ({ page }) => {
    await page.goto('/');
    await page.locator(`button[title="Test Group"]`).click();

    // Chuẩn bị mở modal edit kênh thoại
    const voiceChan = page.getByRole('button', { name: 'Voice channel' });
    await voiceChan.click({ button: 'right' });
    await page.getByRole('button', { name: 'Chỉnh sửa' }).click();

    const nameInput = page.locator('#channel-name-input');
    await expect(nameInput).toBeVisible();

    // Điền tên rỗng / toàn khoảng trắng
    await nameInput.fill('   ');

    // Xác nhận nút Lưu bị disabled
    const saveBtn = page.getByRole('button', { name: 'Lưu' });
    await expect(saveBtn).toBeDisabled();
  });
});
