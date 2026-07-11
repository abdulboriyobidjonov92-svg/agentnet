import { isPrivateAddress, urlBlockedReason } from './ssrf';

describe('SSRF guard — isPrivateAddress', () => {
  it.each([
    ['127.0.0.1', true], // loopback
    ['10.0.0.5', true], // private A
    ['172.16.0.1', true], // private B (past chegara)
    ['172.31.255.255', true], // private B (yuqori chegara)
    ['192.168.1.1', true], // private C
    ['169.254.169.254', true], // link-local + bulut-metadata
    ['100.64.0.1', true], // CGNAT
    ['0.0.0.0', true],
    ['::1', true], // IPv6 loopback
    ['fc00::1', true], // unique-local
    ['fe80::1', true], // link-local
    ['::ffff:127.0.0.1', true], // IPv4-mapped IPv6
    ['8.8.8.8', false], // public
    ['93.184.216.34', false], // public (example.com)
    ['172.32.0.1', false], // private B chegarasidan tashqarida
  ])('%s -> private=%s', (ip, expected) => {
    expect(isPrivateAddress(ip as string)).toBe(expected);
  });
});

// IP-literal URL'lar DNS'ni chetlab o'tadi (isIP short-circuit) — deterministik, tarmoqsiz.
describe('SSRF guard — urlBlockedReason (IP literal)', () => {
  it('bulut-metadata IP bloklanadi', async () => {
    expect(await urlBlockedReason('http://169.254.169.254/latest/meta-data/')).toBeTruthy();
  });
  it('loopback (ichki API) bloklanadi', async () => {
    expect(await urlBlockedReason('http://127.0.0.1:3001/api/billing/me')).toBeTruthy();
  });
  it('private IP bloklanadi', async () => {
    expect(await urlBlockedReason('http://10.0.0.1/')).toBeTruthy();
  });
  it('http/https bo\'lmagan sxema bloklanadi', async () => {
    expect(await urlBlockedReason('file:///etc/passwd')).toBeTruthy();
    expect(await urlBlockedReason('gopher://127.0.0.1')).toBeTruthy();
  });
  it('yaroqsiz URL bloklanadi', async () => {
    expect(await urlBlockedReason('not a url')).toBeTruthy();
  });
  it('public IP literal ruxsat etiladi', async () => {
    expect(await urlBlockedReason('http://8.8.8.8/')).toBeNull();
  });
});
