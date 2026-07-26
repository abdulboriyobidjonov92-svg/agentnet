import { UsersController } from './users.controller';
import type { User } from '@prisma/client';

function makeSvc() {
  const users = {
    getProfile: jest.fn(async () => ({})),
    getStats: jest.fn(async () => ({})),
    exportData: jest.fn(async () => ({})),
    deleteAccount: jest.fn(async () => ({ deleted: true })),
    updateProfile: jest.fn(async () => ({})),
    updateValues: jest.fn(async () => ({})),
  } as any;
  const onboarding = {
    completeOnboarding: jest.fn(async () => ({})),
    getRecommendations: jest.fn(async () => ({})),
    installRecommendations: jest.fn(async () => ({})),
  } as any;
  return { users, onboarding };
}

describe('UsersController — user.id bilan servisga to\'g\'ri uzatiladi', () => {
  it('getProfile / getStats / exportData / deleteAccount — hammasi user.id ni uzatadi', async () => {
    const { users, onboarding } = makeSvc();
    const controller = new UsersController(users, onboarding);
    const user = { id: 'u1' } as unknown as User;

    await controller.getProfile(user);
    await controller.getStats(user);
    await controller.exportData(user);
    await controller.deleteAccount(user);

    expect(users.getProfile).toHaveBeenCalledWith('u1');
    expect(users.getStats).toHaveBeenCalledWith('u1');
    expect(users.exportData).toHaveBeenCalledWith('u1');
    expect(users.deleteAccount).toHaveBeenCalledWith('u1');
  });

  it("updateProfile — user.id va dto'ni uzatadi", async () => {
    const { users, onboarding } = makeSvc();
    const controller = new UsersController(users, onboarding);
    const user = { id: 'u1' } as unknown as User;

    await controller.updateProfile(user, { name: 'Ali' });
    expect(users.updateProfile).toHaveBeenCalledWith('u1', { name: 'Ali' });
  });

  it("setValues — user.id va dto'ni uzatadi", async () => {
    const { users, onboarding } = makeSvc();
    const controller = new UsersController(users, onboarding);
    const user = { id: 'u1' } as unknown as User;

    await controller.setValues(user, { tradition: 'islamic', statements: ['halol'] });
    expect(users.updateValues).toHaveBeenCalledWith('u1', { tradition: 'islamic', statements: ['halol'] });
  });

  it("completeOnboarding / getRecommendations / installRecommendations — OnboardingService'ga to'liq user obyekti bilan uzatadi", async () => {
    const { users, onboarding } = makeSvc();
    const controller = new UsersController(users, onboarding);
    const user = { id: 'u1' } as unknown as User;
    const onboardingDto = { text: 'matn' } as any;
    const installDto = { agents: [] } as any;

    await controller.completeOnboarding(user, onboardingDto);
    await controller.getRecommendations(user);
    await controller.installRecommendations(user, installDto);

    expect(onboarding.completeOnboarding).toHaveBeenCalledWith(user, onboardingDto);
    expect(onboarding.getRecommendations).toHaveBeenCalledWith(user);
    expect(onboarding.installRecommendations).toHaveBeenCalledWith(user, installDto);
  });
});

describe("UsersController.getValues — servisga murojaat qilmaydi, standart qiymatga tushadi", () => {
  it("user.valuesProfile bo'lsa -> aynan shuni qaytaradi", () => {
    const { users, onboarding } = makeSvc();
    const controller = new UsersController(users, onboarding);
    const user = { id: 'u1', valuesProfile: { tradition: 'secular', statements: ['adolat'] } } as unknown as User;

    expect(controller.getValues(user)).toEqual({ tradition: 'secular', statements: ['adolat'] });
  });

  it("user.valuesProfile null bo'lsa -> standart {tradition:'islamic', statements:[]}", () => {
    const { users, onboarding } = makeSvc();
    const controller = new UsersController(users, onboarding);
    const user = { id: 'u1', valuesProfile: null } as unknown as User;

    expect(controller.getValues(user)).toEqual({ tradition: 'islamic', statements: [] });
  });
});
