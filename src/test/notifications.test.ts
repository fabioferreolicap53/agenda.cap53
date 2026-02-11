import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationService } from '../../lib/notifications';
import { pb } from '../../lib/pocketbase';

// Mock PocketBase
const mockCollection = {
  getList: vi.fn(),
  create: vi.fn(),
};

vi.mock('../../lib/pocketbase', () => ({
  pb: {
    collection: vi.fn(() => mockCollection),
    authStore: {
      model: { id: 'test-user-id' }
    }
  }
}));

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.getList.mockResolvedValue({ totalItems: 0, items: [] });
    mockCollection.create.mockResolvedValue({ id: 'new-notif-id' });
  });

  it('should create a notification when no duplicate exists', async () => {
    const params = {
      user: 'user123',
      title: 'Test Title',
      message: 'Test Message',
      type: 'event_invite' as const,
      event: 'event456'
    };

    const result = await notificationService.createNotification(params);

    expect(mockCollection.getList).toHaveBeenCalled();
    expect(mockCollection.create).toHaveBeenCalledWith(expect.objectContaining({
      user: 'user123',
      title: 'Test Title',
      type: 'event_invite'
    }));
    expect(result.id).toBe('new-notif-id');
  });

  it('should not create a notification if a duplicate exists for event_invite', async () => {
    mockCollection.getList.mockResolvedValue({ 
      totalItems: 1, 
      items: [{ id: 'existing-notif-id' }] 
    });

    const params = {
      user: 'user123',
      title: 'Test Title',
      message: 'Test Message',
      type: 'event_invite' as const,
      event: 'event456'
    };

    const result = await notificationService.createNotification(params);

    expect(mockCollection.getList).toHaveBeenCalled();
    expect(mockCollection.create).not.toHaveBeenCalled();
    expect(result.id).toBe('existing-notif-id');
  });

  it('should bulk create notifications', async () => {
    const users = ['user1', 'user2', 'user3'];
    const params = {
      title: 'Bulk Title',
      message: 'Bulk Message',
      type: 'system' as const
    };

    await notificationService.bulkCreateNotifications(users, params);

    // 3 notifications + 3 audit logs = 6 calls to create
    expect(mockCollection.create).toHaveBeenCalledTimes(6);
  });
});
