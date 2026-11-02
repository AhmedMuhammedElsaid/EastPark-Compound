import { FlatOwnershipService } from 'src/common/finance/flat-ownership.service';

/**
 * FlatOwnershipService stand-in for unit specs. Defaults keep the legacy
 * behaviour (unknown flat → no link, no period); specs that cover ownership
 * override `resolveFlatId` and assert the writer calls.
 */
export function mockFlatOwnership() {
    const batch = { count: 0 };
    return {
        resolveFlatId: jest.fn().mockResolvedValue(null),
        openForNewUnit: jest.fn().mockResolvedValue(undefined),
        linkAndOpen: jest.fn().mockResolvedValue(undefined),
        moveLink: jest.fn().mockResolvedValue(undefined),
        closeForUnit: jest.fn().mockResolvedValue(batch),
        closeAllForUser: jest.fn().mockReturnValue(
            Promise.resolve(batch) as unknown
        ),
        reopenForUser: jest.fn().mockResolvedValue([]),
        goLiveAt: jest.fn().mockResolvedValue(null),
    };
}

export const asOwnership = (
    mock: ReturnType<typeof mockFlatOwnership>
): FlatOwnershipService => mock as unknown as FlatOwnershipService;
