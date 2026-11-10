import { nextSlot, nextSlots } from './slots';

const tz = 'Africa/Dar_es_Salaam'; // UTC+3, no DST

describe('release slots', () => {
  it('daily: next 18:00 East Africa time after a morning instant', () => {
    const after = new Date('2026-11-10T06:00:00Z'); // 09:00 EAT
    const s = nextSlot({ releasePlan: 'daily', releaseTime: '18:00', releaseWeekdays: [], timezone: tz }, after);
    expect(s?.toISOString()).toBe('2026-11-10T15:00:00.000Z');
  });

  it('daily: rolls to tomorrow once today\'s time has passed', () => {
    const after = new Date('2026-11-10T15:00:00Z'); // exactly 18:00 EAT
    const s = nextSlot({ releasePlan: 'daily', releaseTime: '18:00', releaseWeekdays: [], timezone: tz }, after);
    expect(s?.toISOString()).toBe('2026-11-11T15:00:00.000Z');
  });

  it('weekly: Mondays and Thursdays at 07:00', () => {
    // 2026-11-10 is a Tuesday.
    const after = new Date('2026-11-10T06:00:00Z');
    const s = nextSlots(
      { releasePlan: 'weekly', releaseTime: '07:00', releaseWeekdays: [1, 4], timezone: tz },
      after,
      3,
    );
    expect(s.map((d) => d.toISOString())).toEqual([
      '2026-11-12T04:00:00.000Z', // Thu
      '2026-11-16T04:00:00.000Z', // Mon
      '2026-11-19T04:00:00.000Z', // Thu
    ]);
  });

  it('manual and all-at-once plans have no slots', () => {
    expect(nextSlot({ releasePlan: 'manual', releaseTime: '18:00', releaseWeekdays: [], timezone: tz }, new Date())).toBeNull();
    expect(nextSlot({ releasePlan: 'all_at_once', releaseTime: '18:00', releaseWeekdays: [], timezone: tz }, new Date())).toBeNull();
  });
});
