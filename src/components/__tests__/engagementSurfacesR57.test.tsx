// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EngagementFlag } from '@/components/staff/EngagementFlag';
import { EngagementTaskClose } from '@/components/tasks/EngagementTaskClose';
import { ENGAGEMENT_DRAFT, ENGAGEMENT_OUTCOMES } from '@/lib/engagementRisk';
import type { CaseTask } from '@/lib/ehr';
const mocks = vi.hoisted(() => ({ role: 'therapist', run: vi.fn(), flag: vi.fn(), gate: vi.fn() }));
vi.mock('@/lib/roles', () => ({ useActingStaff: () => ({ role: mocks.role, staffId: 's-th1' }) }));
vi.mock('@/lib/ehr', () => ({ useEhr: (selector: () => unknown) => selector(), AdelanteEHR: { getPatient: () => ({ id: 'member' }) } }));
vi.mock('@/lib/engagementRiskAutomation', () => ({ engagementFlagFor: mocks.flag, engagementTaskGate: mocks.gate }));
vi.mock('@/lib/actions/runAction', () => ({ runAction: mocks.run }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ lang: 'en' }) }));
vi.mock('@/components/StaffDensity', () => ({ useStaffDensity: () => 'compact' }));
const task = { id: 'engagement-task', patientId: 'member' } as CaseTask;
afterEach(cleanup);
beforeEach(() => { mocks.role = 'therapist'; mocks.gate.mockReturnValue(true); mocks.run.mockReset(); mocks.run.mockReturnValue({ ok: true }); mocks.flag.mockReset(); });
describe('R57 staff-only presentation and outcome controls', () => {
  it.each(['Watch', 'Elevated'] as const)('displays the existing %s flag and neutral reasons', level => {
    mocks.flag.mockReturnValue({ level, label: ENGAGEMENT_DRAFT, signals: [{ key: 'contact', weight: 'High', reason: 'phone changed' }] });
    render(<EngagementFlag actor={{ role: 'therapist', staffId: 's-th1' }} patientId="member" />);
    expect(screen.getByLabelText(`Engagement · ${level}`)).toBeTruthy();
    expect(screen.getByText('phone changed')).toBeTruthy();
    expect(mocks.flag).toHaveBeenCalledWith({ role: 'therapist', staffId: 's-th1' }, 'member');
  });
  it.each(['patient', 'advocate'] as const)('%s receives no badge from the closed projection', role => {
    mocks.flag.mockReturnValue(undefined);
    const { container } = render(<EngagementFlag actor={{ role: role as 'therapist', staffId: 'member' }} patientId="member" />);
    expect(container.childElementCount).toBe(0);
    expect(mocks.flag).toHaveBeenCalledWith({ role, staffId: 'member' }, 'member');
  });
  it('requires one of the four outcomes before running the existing close action', () => {
    render(<EngagementTaskClose task={task} canWrite />);
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
    const close = screen.getByRole('button', { name: 'Close check-in' });
    expect((close as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(close); expect(mocks.run).not.toHaveBeenCalled();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    fireEvent.click(screen.getByRole('radio', { name: ENGAGEMENT_OUTCOMES[1] }));
    expect((close as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Requested support' } });
    fireEvent.click(close);
    expect(mocks.run).toHaveBeenCalledTimes(1);
    expect(mocks.run).toHaveBeenCalledWith('engagement_task_close', { role: 'therapist', staffId: 's-th1' }, { id: 'member' }, { via: 'closeEngagementTask', args: [{ taskId: 'engagement-task', actor: { role: 'therapist', staffId: 's-th1' }, outcome: 'Reached, needs help', note: 'Requested support' }] });
  });
  it('does not offer Close when the existing task gate refuses', () => {
    mocks.gate.mockReturnValue(false);
    render(<EngagementTaskClose task={task} canWrite />);
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });
});