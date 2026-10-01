import { RootController } from 'src/app/controllers/root.controller';

describe('RootController', () => {
    it('returns the API status and health endpoint', () => {
        const controller = new RootController();

        expect(controller.getStatus()).toEqual({
            service: 'EastPark API',
            status: 'ok',
            health: '/health',
        });
    });
});