export const mockExpoInstance = {
    chunkPushNotifications: jest.fn((msgs: unknown[]) => [msgs]),
    sendPushNotificationsAsync: jest.fn(async () => [{ status: 'ok' }]),
};

const ExpoMock = jest.fn(() => mockExpoInstance);
(ExpoMock as any).isExpoPushToken = jest.fn((token: string) =>
    token.startsWith('ExponentPushToken[')
);

export default ExpoMock;
