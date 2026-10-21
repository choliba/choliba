import { isDeviceOn } from '../../index';

const DEVICES = ['chromium', 'firefox', 'webkit', 'mobile-chrome'];

/** The devices that run for a project with `projectDevices` and `ticket`. */
function running(projectDevices: Readonly<Record<string, unknown>> | undefined, ticket?: unknown): string[] {
  return DEVICES.filter((device) => isDeviceOn(device, projectDevices, ticket));
}

describe('isDeviceOn', () => {
  it('runs only the devices the project turns on, a device it leaves out being off', () => {
    expect(running({ chromium: true, firefox: false, webkit: false, 'mobile-chrome': false })).toEqual(['chromium']);
    expect(running({ chromium: true })).toEqual(['chromium']);
    expect(running({ chromium: true, webkit: true, firefox: 'sim' })).toEqual(['chromium', 'webkit']);
  });

  it('runs every device for a project with no devices', () => {
    expect(running(undefined)).toEqual(DEVICES);
  });

  it('lets the ticket or one of its criteria turn on a device the project leaves off', () => {
    expect(running({ chromium: true }, { devices: { firefox: true } })).toEqual(['chromium', 'firefox']);
    expect(
      running({ chromium: true }, { criterios: [{ id: 'CA-01' }, { devices: { 'mobile-chrome': true } }] }),
    ).toEqual(['chromium', 'mobile-chrome']);
    expect(running({ chromium: true }, { devices: { firefox: false }, criterios: 'x' })).toEqual(['chromium']);
    expect(running({ chromium: true }, ['x'])).toEqual(['chromium']);
  });
});
