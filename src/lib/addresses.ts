import { getDb, nowIso, run } from "./db";

export interface CustomerAddress {
  id: number;
  accountId: number;
  label: string;
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddressInput {
  label?: string;
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefault?: boolean;
}

interface AddressRow {
  id: number;
  accountId: number;
  label: string;
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: number;
  createdAt: string;
  updatedAt: string;
}

const mapRow = (r: AddressRow): CustomerAddress => ({
  ...r,
  isDefault: r.isDefault === 1,
});

export function listCustomerAddresses(accountId: number): CustomerAddress[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM customerAddresses WHERE accountId = ? ORDER BY isDefault DESC, id DESC")
    .all(accountId) as unknown as AddressRow[];
  return rows.map(mapRow);
}

export function getCustomerAddress(id: number, accountId: number): CustomerAddress | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM customerAddresses WHERE id = ? AND accountId = ?")
    .get(id, accountId) as unknown as AddressRow | undefined;
  return row ? mapRow(row) : null;
}

export function getDefaultCustomerAddress(accountId: number): CustomerAddress | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM customerAddresses WHERE accountId = ? AND isDefault = 1 LIMIT 1")
    .get(accountId) as unknown as AddressRow | undefined;
  if (row) return mapRow(row);
  const fallback = db
    .prepare("SELECT * FROM customerAddresses WHERE accountId = ? ORDER BY id DESC LIMIT 1")
    .get(accountId) as unknown as AddressRow | undefined;
  return fallback ? mapRow(fallback) : null;
}

export function createCustomerAddress(accountId: number, input: AddressInput): CustomerAddress {
  const db = getDb();
  const ts = nowIso();
  const count = Number(
    (db.prepare("SELECT COUNT(*) as n FROM customerAddresses WHERE accountId = ?").get(accountId) as { n: number })?.n ?? 0
  );

  const shouldBeDefault = input.isDefault || count === 0;

  if (shouldBeDefault) {
    run(db.prepare("UPDATE customerAddresses SET isDefault = 0 WHERE accountId = ?"), accountId);
  }

  const res = run(
    db.prepare(`
      INSERT INTO customerAddresses (accountId, label, name, phone, addressLine, city, state, pincode, country, isDefault, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    accountId,
    input.label?.trim() || "Home",
    input.name.trim(),
    input.phone.trim(),
    input.addressLine.trim(),
    input.city.trim(),
    input.state.trim(),
    input.pincode.trim(),
    input.country?.trim() || "India",
    shouldBeDefault ? 1 : 0,
    ts,
    ts
  );

  return {
    id: res.id,
    accountId,
    label: input.label?.trim() || "Home",
    name: input.name.trim(),
    phone: input.phone.trim(),
    addressLine: input.addressLine.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    pincode: input.pincode.trim(),
    country: input.country?.trim() || "India",
    isDefault: shouldBeDefault,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function updateCustomerAddress(id: number, accountId: number, input: AddressInput): CustomerAddress | null {
  const db = getDb();
  const existing = getCustomerAddress(id, accountId);
  if (!existing) return null;

  const ts = nowIso();

  if (input.isDefault) {
    run(db.prepare("UPDATE customerAddresses SET isDefault = 0 WHERE accountId = ?"), accountId);
  }

  run(
    db.prepare(`
      UPDATE customerAddresses
      SET label = ?, name = ?, phone = ?, addressLine = ?, city = ?, state = ?, pincode = ?, country = ?, isDefault = ?, updatedAt = ?
      WHERE id = ? AND accountId = ?
    `),
    input.label !== undefined ? input.label.trim() : existing.label,
    input.name !== undefined ? input.name.trim() : existing.name,
    input.phone !== undefined ? input.phone.trim() : existing.phone,
    input.addressLine !== undefined ? input.addressLine.trim() : existing.addressLine,
    input.city !== undefined ? input.city.trim() : existing.city,
    input.state !== undefined ? input.state.trim() : existing.state,
    input.pincode !== undefined ? input.pincode.trim() : existing.pincode,
    input.country !== undefined ? input.country.trim() : existing.country,
    input.isDefault !== undefined ? (input.isDefault ? 1 : 0) : (existing.isDefault ? 1 : 0),
    ts,
    id,
    accountId
  );

  return getCustomerAddress(id, accountId);
}

export function deleteCustomerAddress(id: number, accountId: number): boolean {
  const db = getDb();
  const existing = getCustomerAddress(id, accountId);
  if (!existing) return false;

  run(db.prepare("DELETE FROM customerAddresses WHERE id = ? AND accountId = ?"), id, accountId);

  // If we deleted the default address, promote the latest remaining address to default
  if (existing.isDefault) {
    const next = db
      .prepare("SELECT id FROM customerAddresses WHERE accountId = ? ORDER BY id DESC LIMIT 1")
      .get(accountId) as { id: number } | undefined;
    if (next) {
      run(db.prepare("UPDATE customerAddresses SET isDefault = 1 WHERE id = ?"), next.id);
    }
  }

  return true;
}

export function setDefaultCustomerAddress(id: number, accountId: number): boolean {
  const db = getDb();
  const existing = getCustomerAddress(id, accountId);
  if (!existing) return false;

  run(db.prepare("UPDATE customerAddresses SET isDefault = 0 WHERE accountId = ?"), accountId);
  run(db.prepare("UPDATE customerAddresses SET isDefault = 1 WHERE id = ? AND accountId = ?"), id, accountId);
  return true;
}
