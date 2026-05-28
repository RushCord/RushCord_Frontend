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
});
