import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { StorageProvider } from "./types";

export class R2Storage implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucket ||
      !publicUrl
    ) {
      throw new Error("Missing Cloudflare R2 environment variables");
    }

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      // Cloudflare R2 rejects the AWS SDK v3 default checksums (CRC32 /
      // aws-chunked), so only compute them when an operation requires it.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    this.bucket = bucket;
    // Public bucket base or custom domain; the object key is appended to it.
    this.publicUrl = publicUrl.replace(/\/+$/, "");
  }

  async upload(key: string, file: File, opts: { cacheMaxAge: number }) {
    const body = Buffer.from(await file.arrayBuffer());
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: "application/octet-stream",
        CacheControl: `public, max-age=${opts.cacheMaxAge}`,
      })
    );
    return `${this.publicUrl}/${key}`;
  }

  async delete(url: string) {
    const key = new URL(url).pathname.slice(1);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }
}
