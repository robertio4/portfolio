import { createHash } from 'node:crypto';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import { env } from '../env.js';

export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
}

export interface UAInfo {
  browser: string | null;
  os: string | null;
  device: 'desktop' | 'mobile' | 'tablet' | null;
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip + env.IP_SALT).digest('hex');
}

export function lookupGeo(ip: string): GeoInfo {
  const g = geoip.lookup(ip);
  if (!g) return { country: null, region: null, city: null };
  return {
    country: g.country || null,
    region: g.region || null,
    city: g.city || null,
  };
}

export function parseUA(uaString: string | undefined | null): UAInfo {
  if (!uaString) return { browser: null, os: null, device: null };
  const ua = new UAParser(uaString).getResult();
  const browser = [ua.browser.name, ua.browser.major].filter(Boolean).join(' ') || null;
  const os = [ua.os.name, ua.os.version].filter(Boolean).join(' ') || null;
  const dt = ua.device.type;
  const device: UAInfo['device'] =
    dt === 'mobile' ? 'mobile' : dt === 'tablet' ? 'tablet' : 'desktop';
  return { browser, os, device };
}
