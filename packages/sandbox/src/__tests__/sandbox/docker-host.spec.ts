import type { NetworkInterfaceInfo } from 'node:os';

import { dockerHostAddress } from '../../index';

function address(family: 'IPv4' | 'IPv6', value: string): NetworkInterfaceInfo {
  const common = { netmask: '', mac: '00:00:00:00:00:00', internal: false, cidr: null };
  return family === 'IPv4' ? { ...common, family, address: value } : { ...common, family, address: value, scopeid: 0 };
}

describe('dockerHostAddress', () => {
  it("is the IPv4 of Docker's bridge, where a container's host-gateway leads", () => {
    expect(
      dockerHostAddress({
        lo: [address('IPv4', '127.0.0.1')],
        docker0: [address('IPv6', 'fe80::1'), address('IPv4', '172.17.0.1')],
      }),
    ).toBe('172.17.0.1');
  });

  it('is unknown without the bridge, or with no IPv4 on it', () => {
    expect(dockerHostAddress({ lo: [address('IPv4', '127.0.0.1')] })).toBeUndefined();
    expect(dockerHostAddress({ docker0: [address('IPv6', 'fe80::1')] })).toBeUndefined();
  });

  it("reads this machine's interfaces by default", () => {
    expect(['string', 'undefined']).toContain(typeof dockerHostAddress());
  });
});
