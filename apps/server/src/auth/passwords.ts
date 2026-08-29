import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id 参数：NAS 设备性能有限，使用保守的默认内存/时间参数，
 * 在安全性与低配 CPU 之间平衡。
 */
const ARGON2_OPTIONS = {
  algorithm: 2, // Argon2id
  memoryCost: 19456, // 19 MiB（OWASP 推荐下限）
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
