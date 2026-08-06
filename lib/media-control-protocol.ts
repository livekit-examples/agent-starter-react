export const MEDIA_CONTROL_TOPIC = 'lk.media.control';
export const MEDIA_STATE_TOPIC = 'lk.media.state';

const SCHEMA_VERSION = 1;
const MAX_PACKET_BYTES = 16 * 1024;
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export type MediaControlCommand = {
  readonly schema_version: 1;
  readonly type: typeof MEDIA_CONTROL_TOPIC;
  readonly command_id: string;
  readonly policy_epoch: string;
  readonly sequence: number;
  readonly target_identity: string;
  readonly desired_listening: 'open' | 'closed';
  readonly issued_at_unix_ms: number;
  readonly expires_at_unix_ms: number;
  readonly reason: string | null;
};

export type MediaStateSnapshot = {
  readonly schema_version: 1;
  readonly type: typeof MEDIA_STATE_TOPIC;
  readonly target_identity: string;
  readonly state_epoch: string;
  readonly state_sequence: number;
  readonly observed_at_unix_ms: number;
  readonly capture_active: boolean;
  readonly track_published: boolean;
  readonly track_muted: boolean;
  readonly user_muted: boolean;
  readonly blocked_by: readonly string[];
  readonly command_id: string | null;
  readonly policy_epoch: string | null;
  readonly command_sequence: number | null;
  readonly command_status: 'applied' | 'rejected' | 'expired' | 'unsupported' | null;
  readonly error_code: string | null;
};

type JsonObject = Record<string, unknown>;

type ParsedValue = {
  value: unknown;
  integerToken: boolean;
};

class StrictJsonParser {
  private index = 0;
  private readonly rootIntegerFields = new Set<string>();

  constructor(private readonly text: string) {}

  parse(): { value: unknown; rootIntegerFields: ReadonlySet<string> } {
    this.skipWhitespace();
    const { value } = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.text.length) {
      invalid('payload is not valid JSON');
    }
    return { value, rootIntegerFields: this.rootIntegerFields };
  }

  private parseValue(depth: number): ParsedValue {
    const character = this.text[this.index];
    if (character === '{') return { value: this.parseObject(depth), integerToken: false };
    if (character === '[') return { value: this.parseArray(depth), integerToken: false };
    if (character === '"') return { value: this.parseString(), integerToken: false };
    if (character === 't') return { value: this.parseLiteral('true', true), integerToken: false };
    if (character === 'f') return { value: this.parseLiteral('false', false), integerToken: false };
    if (character === 'n') return { value: this.parseLiteral('null', null), integerToken: false };
    if (character === '-' || isDigit(character)) return this.parseNumber();
    return invalid('payload is not valid JSON');
  }

  private parseObject(depth: number): JsonObject {
    this.index += 1;
    this.skipWhitespace();
    const result: JsonObject = Object.create(null) as JsonObject;
    const keys = new Set<string>();
    if (this.consume('}')) return result;

    while (true) {
      if (this.text[this.index] !== '"') invalid('payload is not valid JSON');
      const key = this.parseString();
      if (keys.has(key)) invalid(`duplicate JSON field ${JSON.stringify(key)}`);
      keys.add(key);
      this.skipWhitespace();
      this.expect(':');
      this.skipWhitespace();
      const parsed = this.parseValue(depth + 1);
      if (depth === 0 && parsed.integerToken) this.rootIntegerFields.add(key);
      Object.defineProperty(result, key, {
        value: parsed.value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      this.skipWhitespace();
      if (this.consume('}')) return result;
      this.expect(',');
      this.skipWhitespace();
    }
  }

  private parseArray(depth: number): unknown[] {
    this.index += 1;
    this.skipWhitespace();
    const result: unknown[] = [];
    if (this.consume(']')) return result;

    while (true) {
      result.push(this.parseValue(depth + 1).value);
      this.skipWhitespace();
      if (this.consume(']')) return result;
      this.expect(',');
      this.skipWhitespace();
    }
  }

  private parseString(): string {
    const start = this.index;
    this.index += 1;
    while (this.index < this.text.length) {
      const character = this.text[this.index];
      this.index += 1;
      if (character === '"') {
        try {
          return JSON.parse(this.text.slice(start, this.index)) as string;
        } catch {
          return invalid('payload is not valid JSON');
        }
      }
      if (character === '\\') {
        const escape = this.text[this.index];
        this.index += 1;
        if (escape === 'u') {
          const digits = this.text.slice(this.index, this.index + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(digits)) invalid('payload is not valid JSON');
          this.index += 4;
        } else if (!'"\\/bfnrt'.includes(escape ?? '')) {
          invalid('payload is not valid JSON');
        }
      } else if (character.charCodeAt(0) < 0x20) {
        invalid('payload is not valid JSON');
      }
    }
    return invalid('payload is not valid JSON');
  }

  private parseNumber(): ParsedValue {
    const start = this.index;
    if (this.consume('-') && this.index === this.text.length) {
      return invalid('payload is not valid JSON');
    }
    if (this.consume('0')) {
      if (isDigit(this.text[this.index])) return invalid('payload is not valid JSON');
    } else {
      if (!isNonzeroDigit(this.text[this.index])) return invalid('payload is not valid JSON');
      while (isDigit(this.text[this.index])) this.index += 1;
    }

    let integerToken = true;
    if (this.consume('.')) {
      integerToken = false;
      if (!isDigit(this.text[this.index])) return invalid('payload is not valid JSON');
      while (isDigit(this.text[this.index])) this.index += 1;
    }
    if (this.text[this.index] === 'e' || this.text[this.index] === 'E') {
      integerToken = false;
      this.index += 1;
      if (this.text[this.index] === '+' || this.text[this.index] === '-') this.index += 1;
      if (!isDigit(this.text[this.index])) return invalid('payload is not valid JSON');
      while (isDigit(this.text[this.index])) this.index += 1;
    }

    const token = this.text.slice(start, this.index);
    if (integerToken) {
      let value: bigint;
      try {
        value = BigInt(token);
      } catch {
        return invalid('payload is not valid JSON');
      }
      if (value < -MAX_SAFE_INTEGER_BIGINT || value > MAX_SAFE_INTEGER_BIGINT) {
        return invalid('JSON integer exceeds the protocol safe-integer bound');
      }
    }
    const value = Number(token);
    return { value: Object.is(value, -0) ? 0 : value, integerToken };
  }

  private parseLiteral<T>(token: string, value: T): T {
    if (this.text.slice(this.index, this.index + token.length) !== token) {
      return invalid('payload is not valid JSON');
    }
    this.index += token.length;
    return value;
  }

  private skipWhitespace(): void {
    while (' \n\r\t'.includes(this.text[this.index] ?? '\0')) this.index += 1;
  }

  private consume(character: string): boolean {
    if (this.text[this.index] !== character) return false;
    this.index += 1;
    return true;
  }

  private expect(character: string): void {
    if (!this.consume(character)) invalid('payload is not valid JSON');
  }
}

export function decodeMediaControl(payload: Uint8Array | string): MediaControlCommand {
  const text = decodePayload(payload);
  let parsed: { value: unknown; rootIntegerFields: ReadonlySet<string> };
  try {
    parsed = new StrictJsonParser(text).parse();
  } catch (error) {
    if (error instanceof Error) throw error;
    return invalid('payload is not valid JSON');
  }
  const values = requireObject(parsed.value);
  validateEnvelope(values, parsed.rootIntegerFields, MEDIA_CONTROL_TOPIC);

  const command: MediaControlCommand = {
    schema_version: SCHEMA_VERSION,
    type: MEDIA_CONTROL_TOPIC,
    command_id: requireNonemptyString(values, 'command_id'),
    policy_epoch: requireNonemptyString(values, 'policy_epoch'),
    sequence: requirePositiveInteger(values, parsed.rootIntegerFields, 'sequence'),
    target_identity: requireNonemptyString(values, 'target_identity'),
    desired_listening: requireListening(values, 'desired_listening'),
    issued_at_unix_ms: requireNonnegativeInteger(
      values,
      parsed.rootIntegerFields,
      'issued_at_unix_ms'
    ),
    expires_at_unix_ms: requireInteger(values, parsed.rootIntegerFields, 'expires_at_unix_ms'),
    reason: Object.hasOwn(values, 'reason') ? requireNonemptyString(values, 'reason') : null,
  };
  if (command.expires_at_unix_ms <= command.issued_at_unix_ms) {
    invalid('expires_at_unix_ms must be greater than issued_at_unix_ms');
  }
  return Object.freeze(command);
}

export function encodeMediaState(message: MediaStateSnapshot): Uint8Array {
  const values = requireObject(message);
  validateMediaState(values);
  const ordered = Object.fromEntries(
    Object.entries({
      schema_version: values.schema_version,
      type: values.type,
      target_identity: values.target_identity,
      state_epoch: values.state_epoch,
      state_sequence: values.state_sequence,
      observed_at_unix_ms: values.observed_at_unix_ms,
      capture_active: values.capture_active,
      track_published: values.track_published,
      track_muted: values.track_muted,
      user_muted: values.user_muted,
      blocked_by: values.blocked_by,
      command_id: values.command_id,
      policy_epoch: values.policy_epoch,
      command_sequence: values.command_sequence,
      command_status: values.command_status,
      error_code: values.error_code,
    }).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  );
  const encoded = new TextEncoder().encode(JSON.stringify(ordered));
  enforcePacketSize(encoded.byteLength);
  return encoded;
}

function decodePayload(payload: Uint8Array | string): string {
  if (typeof payload === 'string') {
    if (payload.length > MAX_PACKET_BYTES) enforcePacketSize(payload.length);
    requireWellFormed(payload, 'payload');
    enforcePacketSize(new TextEncoder().encode(payload).byteLength);
    return payload;
  }
  if (!(payload instanceof Uint8Array)) invalid('payload must be bytes or text');
  enforcePacketSize(payload.byteLength);
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(payload);
  } catch {
    return invalid('payload is not valid UTF-8');
  }
}

function validateEnvelope(
  values: JsonObject,
  integerFields: ReadonlySet<string>,
  expectedType: string
): void {
  const version = requireInteger(values, integerFields, 'schema_version');
  if (version !== SCHEMA_VERSION) invalid(`schema_version ${version} is not supported`);
  if (required(values, 'type') !== expectedType) invalid(`expected message type ${expectedType}`);
}

function validateMediaState(values: JsonObject): void {
  if (required(values, 'schema_version') !== SCHEMA_VERSION) invalid('unsupported schema_version');
  if (required(values, 'type') !== MEDIA_STATE_TOPIC) invalid('wrong media state type');
  requireNonemptyString(values, 'target_identity');
  requireNonemptyString(values, 'state_epoch');
  requireRuntimePositiveInteger(values, 'state_sequence');
  requireRuntimeNonnegativeInteger(values, 'observed_at_unix_ms');
  requireBoolean(values, 'capture_active');
  requireBoolean(values, 'track_published');
  requireBoolean(values, 'track_muted');
  requireBoolean(values, 'user_muted');

  const blockers = required(values, 'blocked_by');
  if (!Array.isArray(blockers)) invalid('blocked_by must be a list');
  const uniqueBlockers = new Set<string>();
  for (const blocker of blockers) {
    if (typeof blocker !== 'string' || blocker.length === 0) {
      invalid('blocked_by items must be non-empty strings');
    }
    requireWellFormed(blocker, 'blocked_by item');
    if (uniqueBlockers.has(blocker)) invalid('blocked_by must not contain duplicates');
    uniqueBlockers.add(blocker);
  }

  const correlation = [
    required(values, 'command_id'),
    required(values, 'policy_epoch'),
    required(values, 'command_sequence'),
    required(values, 'command_status'),
  ];
  const presentCount = correlation.filter((value) => value !== null).length;
  if (presentCount !== 0 && presentCount !== correlation.length) {
    invalid('command correlation must be entirely null or entirely non-null');
  }
  if (presentCount > 0) {
    requireNonemptyString(values, 'command_id');
    requireNonemptyString(values, 'policy_epoch');
    requireRuntimePositiveInteger(values, 'command_sequence');
    if (
      !['applied', 'rejected', 'expired', 'unsupported'].includes(values.command_status as string)
    ) {
      invalid('command_status is not supported');
    }
  }

  const errorCode = required(values, 'error_code');
  if (errorCode !== null) requireNonemptyString(values, 'error_code');
  for (const field of [
    'target_identity',
    'state_epoch',
    'command_id',
    'policy_epoch',
    'error_code',
  ]) {
    const value = values[field];
    if (typeof value === 'string') requireWellFormed(value, field);
  }
}

function requireObject(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalid('payload must contain a JSON object');
  }
  return value as JsonObject;
}

function required(values: JsonObject, field: string): unknown {
  if (!Object.hasOwn(values, field)) invalid(`required field ${field} is missing`);
  return values[field];
}

function requireNonemptyString(values: JsonObject, field: string): string {
  const value = required(values, field);
  if (typeof value !== 'string' || value.length === 0) {
    return invalid(`${field} must be a non-empty string`);
  }
  requireWellFormed(value, field);
  return value;
}

function requireInteger(
  values: JsonObject,
  integerFields: ReadonlySet<string>,
  field: string
): number {
  const value = required(values, field);
  if (!integerFields.has(field) || typeof value !== 'number' || !Number.isSafeInteger(value)) {
    return invalid(`${field} must be a safe integer token`);
  }
  return value;
}

function requirePositiveInteger(
  values: JsonObject,
  integerFields: ReadonlySet<string>,
  field: string
): number {
  const value = requireInteger(values, integerFields, field);
  if (value <= 0) return invalid(`${field} must be positive`);
  return value;
}

function requireNonnegativeInteger(
  values: JsonObject,
  integerFields: ReadonlySet<string>,
  field: string
): number {
  const value = requireInteger(values, integerFields, field);
  if (value < 0) return invalid(`${field} must be non-negative`);
  return value;
}

function requireRuntimePositiveInteger(values: JsonObject, field: string): number {
  const value = required(values, field);
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return invalid(`${field} must be a positive safe integer`);
  }
  return value;
}

function requireRuntimeNonnegativeInteger(values: JsonObject, field: string): number {
  const value = required(values, field);
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return invalid(`${field} must be a non-negative safe integer`);
  }
  return value;
}

function requireListening(values: JsonObject, field: string): 'open' | 'closed' {
  const value = required(values, field);
  if (value !== 'open' && value !== 'closed') {
    return invalid(`${field} must be 'open' or 'closed'`);
  }
  return value;
}

function requireBoolean(values: JsonObject, field: string): boolean {
  const value = required(values, field);
  if (typeof value !== 'boolean') return invalid(`${field} must be a boolean`);
  return value;
}

function requireWellFormed(value: string, field: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) invalid(`${field} is not valid UTF-8 text`);
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      invalid(`${field} is not valid UTF-8 text`);
    }
  }
}

function enforcePacketSize(byteLength: number): void {
  if (byteLength > MAX_PACKET_BYTES) invalid('payload exceeds the 16 KiB packet limit');
}

function isDigit(character: string | undefined): boolean {
  return character !== undefined && character >= '0' && character <= '9';
}

function isNonzeroDigit(character: string | undefined): boolean {
  return character !== undefined && character >= '1' && character <= '9';
}

function invalid(message: string): never {
  throw new Error(message);
}
