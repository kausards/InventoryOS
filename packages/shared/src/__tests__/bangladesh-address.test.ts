import { describe, it, expect } from 'vitest';
import {
  getBangladeshDivisions,
  getDistrictsByDivision,
  isValidBangladeshDistrict,
  BANGLADESH_DIVISIONS,
  BANGLADESH_DISTRICTS,
} from '../bangladesh-address.js';

describe('Bangladesh Address Hierarchy', () => {
  it('contains all 8 official divisions of Bangladesh', () => {
    const divisions = getBangladeshDivisions();
    expect(divisions.length).toBe(8);
    const names = divisions.map((d) => d.name);
    expect(names).toContain('Dhaka');
    expect(names).toContain('Chattogram');
    expect(names).toContain('Rajshahi');
    expect(names).toContain('Khulna');
    expect(names).toContain('Barishal');
    expect(names).toContain('Sylhet');
    expect(names).toContain('Rangpur');
    expect(names).toContain('Mymensingh');
  });

  it('contains all 64 official districts across divisions', () => {
    expect(BANGLADESH_DISTRICTS.length).toBe(64);
  });

  it('returns correct districts for a given division by name or id', () => {
    const dhakaDistricts = getDistrictsByDivision('Dhaka');
    expect(dhakaDistricts.length).toBe(13);
    const dhakaNames = dhakaDistricts.map((d) => d.name);
    expect(dhakaNames).toContain('Dhaka');
    expect(dhakaNames).toContain('Gazipur');
    expect(dhakaNames).toContain('Narayanganj');

    const sylhetDistricts = getDistrictsByDivision('sylhet');
    expect(sylhetDistricts.length).toBe(4);
  });

  it('validates district existence correctly', () => {
    expect(isValidBangladeshDistrict('Dhaka')).toBe(true);
    expect(isValidBangladeshDistrict('Bogura')).toBe(true);
    expect(isValidBangladeshDistrict('Cox\'s Bazar')).toBe(true);
    expect(isValidBangladeshDistrict('NonExistentCity')).toBe(false);
  });
});
