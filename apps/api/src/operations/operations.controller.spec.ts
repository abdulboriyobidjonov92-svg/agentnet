import { OperationsController } from './operations.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeSvc() {
  return {
    listEmployees: jest.fn(async () => []),
    addEmployee: jest.fn(async () => ({})),
    removeEmployee: jest.fn(async () => ({})),
    generateSchedule: jest.fn(async () => ({})),
    listShifts: jest.fn(async () => []),
    setShiftStatus: jest.fn(async () => ({})),
    listTimeOff: jest.fn(async () => []),
    requestTimeOff: jest.fn(async () => ({})),
    decideTimeOff: jest.fn(async () => ({})),
    payroll: jest.fn(async () => ({})),
    listOutbound: jest.fn(async () => []),
    draftOutbound: jest.fn(async () => ({})),
    updateOutbound: jest.fn(async () => ({})),
    approveAndSend: jest.fn(async () => ({})),
  } as any;
}

describe('OperationsController — parametrlar to\'g\'ri uzatiladi', () => {
  it('employees / addEmployee / removeEmployee', async () => {
    const ops = makeSvc();
    const controller = new OperationsController(ops);
    const body = { name: 'Ali', hourlyRate: 20_000 };

    await controller.employees(user);
    await controller.addEmployee(user, body);
    await controller.removeEmployee(user, 'e1');

    expect(ops.listEmployees).toHaveBeenCalledWith(user);
    expect(ops.addEmployee).toHaveBeenCalledWith(user, body);
    expect(ops.removeEmployee).toHaveBeenCalledWith(user, 'e1');
  });

  it("generate — instructions va weekStart'ni uzatadi", async () => {
    const ops = makeSvc();
    const controller = new OperationsController(ops);

    await controller.generate(user, { instructions: 'haftalik jadval', weekStart: '2026-07-27' });
    expect(ops.generateSchedule).toHaveBeenCalledWith(user, 'haftalik jadval', '2026-07-27');
  });

  it('shifts / shiftStatus', async () => {
    const ops = makeSvc();
    const controller = new OperationsController(ops);

    await controller.shifts(user, '2026-07-01', '2026-07-07');
    await controller.shiftStatus(user, 's1', { status: 'completed' });

    expect(ops.listShifts).toHaveBeenCalledWith(user, '2026-07-01', '2026-07-07');
    expect(ops.setShiftStatus).toHaveBeenCalledWith(user, 's1', 'completed');
  });

  it('timeoff / requestTimeOff / decideTimeOff', async () => {
    const ops = makeSvc();
    const controller = new OperationsController(ops);
    const body = { employeeId: 'e1', startDate: '2026-08-01', endDate: '2026-08-05' };

    await controller.timeoff(user);
    await controller.requestTimeOff(user, body);
    await controller.decideTimeOff(user, 't1', { decision: 'approved' });

    expect(ops.listTimeOff).toHaveBeenCalledWith(user);
    expect(ops.requestTimeOff).toHaveBeenCalledWith(user, body);
    expect(ops.decideTimeOff).toHaveBeenCalledWith(user, 't1', 'approved');
  });

  it("payroll — from/to query'larini uzatadi", async () => {
    const ops = makeSvc();
    const controller = new OperationsController(ops);

    await controller.payroll(user, '2026-07-01', '2026-07-31');
    expect(ops.payroll).toHaveBeenCalledWith(user, '2026-07-01', '2026-07-31');
  });

  it('outbound / draft / updateOutbound / send', async () => {
    const ops = makeSvc();
    const controller = new OperationsController(ops);
    const draftBody = { purpose: 'eslatma', recipientContact: '998901234567' };

    await controller.outbound(user);
    await controller.draft(user, draftBody);
    await controller.updateOutbound(user, 'm1', { body: 'yangi matn' });
    await controller.send(user, 'm1');

    expect(ops.listOutbound).toHaveBeenCalledWith(user);
    expect(ops.draftOutbound).toHaveBeenCalledWith(user, draftBody);
    expect(ops.updateOutbound).toHaveBeenCalledWith(user, 'm1', { body: 'yangi matn' });
    expect(ops.approveAndSend).toHaveBeenCalledWith(user, 'm1');
  });
});
