import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface EvidenceUpload {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export type ResolvedEvidence =
  | { mode: 'redirect'; url: string }
  | { mode: 'local'; absolutePath: string };

const BUCKET = 'report-evidence'; // Must be created as a PRIVATE Supabase Storage bucket.
const MAX_SIZE = 3 * 1024 * 1024;
const LOCAL_PREFIX = 'local:';
const LOCAL_STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'private', 'report-evidence');

// Feature F13: Private photo evidence validation & storage (Supabase private bucket with safe local fallback).
@Injectable()
export class ReportEvidenceService {
  private client: SupabaseClient | null = null;

  private isSupabaseStorageConfigured(): boolean {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const url = process.env.SUPABASE_URL;
    // Never use an anon key for server-managed private complaint evidence.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new ServiceUnavailableException('Private photo evidence storage is not configured');
    }
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.client;
  }

  // Feature F13: Reject oversized, spoofed, or unsupported image uploads via MIME + magic bytes.
  validatePhoto(photo: EvidenceUpload) {
    if (!photo || !photo.buffer || !photo.size || photo.size > MAX_SIZE) {
      throw new BadRequestException('Photo must be smaller than 3 MB');
    }
    const buf = photo.buffer;
    const jpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const png =
      buf.length >= 8 &&
      buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp =
      buf.length >= 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP';
    const detected = jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : null;
    if (!detected || photo.mimetype !== detected) {
      throw new BadRequestException('Only JPEG, PNG or WebP photos are supported');
    }
    return detected;
  }

  // Feature F13: Upload to private Supabase bucket when configured, otherwise private local disk directory.
  async upload(filePath: string, photo: EvidenceUpload, contentType: string): Promise<string> {
    if (this.isSupabaseStorageConfigured()) {
      const { error } = await this.getClient().storage.from(BUCKET).upload(filePath, photo.buffer, {
        contentType,
        upsert: false,
      });
      if (error) throw new ServiceUnavailableException('Unable to save private photo evidence');
      return filePath;
    }

    const safeFileName = path.basename(filePath);
    await fs.mkdir(LOCAL_STORAGE_ROOT, { recursive: true });
    const destination = this.resolveSafeLocalPath(safeFileName);
    await fs.writeFile(destination, photo.buffer);
    return `${LOCAL_PREFIX}${safeFileName}`;
  }

  async remove(filePath: string): Promise<void> {
    if (filePath.startsWith(LOCAL_PREFIX)) {
      const safeName = path.basename(filePath.slice(LOCAL_PREFIX.length));
      await fs.unlink(this.resolveSafeLocalPath(safeName)).catch(() => undefined);
      return;
    }
    if (this.isSupabaseStorageConfigured()) {
      await this.getClient().storage.from(BUCKET).remove([filePath]);
    }
  }

  async signedUrl(filePath: string): Promise<string> {
    const { data, error } = await this.getClient().storage.from(BUCKET).createSignedUrl(filePath, 60);
    if (error || !data?.signedUrl) {
      throw new ServiceUnavailableException('Unable to open photo evidence');
    }
    return data.signedUrl;
  }

  async resolveEvidence(filePath: string): Promise<ResolvedEvidence> {
    if (filePath.startsWith(LOCAL_PREFIX)) {
      const safeName = path.basename(filePath.slice(LOCAL_PREFIX.length));
      const absolutePath = this.resolveSafeLocalPath(safeName);
      try {
        await fs.access(absolutePath);
      } catch {
        throw new NotFoundException('Photo evidence file is no longer available on disk');
      }
      return { mode: 'local', absolutePath };
    }

    const url = await this.signedUrl(filePath);
    return { mode: 'redirect', url };
  }

  private resolveSafeLocalPath(fileName: string): string {
    const resolved = path.resolve(LOCAL_STORAGE_ROOT, path.basename(fileName));
    if (!resolved.startsWith(LOCAL_STORAGE_ROOT)) {
      throw new BadRequestException('Invalid evidence path');
    }
    return resolved;
  }
}
