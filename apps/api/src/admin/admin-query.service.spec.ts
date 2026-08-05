import { AdminQueryService } from './admin-query.service';

/**
 * SEC-06 AC — proves AdminQueryService is a pure pass-through: it does
 * NOT add, remove, or otherwise touch the `where` clause it's given.
 * That is the point of it being the explicit, auditable escape hatch
 * rather than an auto-scoping helper (ScopedQuery was explicitly
 * rejected — see SEC-06 plan).
 */
describe('AdminQueryService', () => {
  const svc = new AdminQueryService();

  it('findMany — passes args through unchanged, no implicit scoping added', async () => {
    const args = { where: { plan: 'pro' } };
    const delegate = { findMany: jest.fn(async () => [{ id: 'u1' }]) };

    const result = await svc.findMany(delegate, args);

    expect(delegate.findMany).toHaveBeenCalledWith(args);
    expect(delegate.findMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 'u1' }]);
  });

  it('findFirst — passes args through unchanged, no implicit scoping added', async () => {
    const args = { where: { email: 'x@y.com' } };
    const delegate = { findFirst: jest.fn(async () => ({ id: 'u1' })) };

    const result = await svc.findFirst(delegate, args);

    expect(delegate.findFirst).toHaveBeenCalledWith(args);
    expect(result).toEqual({ id: 'u1' });
  });

  it('findFirst — null result (not found) passes through unchanged', async () => {
    const delegate = { findFirst: jest.fn(async () => null) };

    const result = await svc.findFirst(delegate, { where: { id: 'ghost' } });

    expect(result).toBeNull();
  });
});
