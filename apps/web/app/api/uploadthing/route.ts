import { NextRequest, NextResponse } from 'next/server';

/**
 * UploadThing proxy — faylni UploadThing serverga yuboradi
 * Bu route Next.js frontend'da ishlaydi.
 * UploadThing REST API'sining v6 versiyasini ishlatadi.
 */

/** v7 token base64(JSON) bo'lishi mumkin — v6 API esa sk_live_... kutadi */
function resolveKey(): string | null {
  const raw = (process.env.UPLOADTHING_TOKEN || process.env.UPLOADTHING_SECRET || '').trim();
  if (!raw) return null;
  if (raw.startsWith('sk_')) return raw;
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    if (typeof decoded?.apiKey === 'string' && decoded.apiKey) return decoded.apiKey;
  } catch {
    // base64 emas
  }
  return raw;
}

export async function POST(req: NextRequest) {
  const token = resolveKey();
  if (!token) {
    return NextResponse.json({ error: 'UPLOADTHING_TOKEN sozlanmagan' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Fayl yuborilmadi' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Faqat rasm fayllari' }, { status: 400 });
    }

    // 1-qadam: UploadThing'dan presigned URL olish
    const prepareRes = await fetch('https://api.uploadthing.com/v6/uploadFiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-uploadthing-api-key': token,
        'x-uploadthing-version': '7.0.0',
      },
      body: JSON.stringify({
        files: [
          {
            name: file.name,
            size: file.size,
            type: file.type,
          },
        ],
        acl: 'public-read',
        metadata: {},
        contentDisposition: 'inline',
      }),
    });

    if (!prepareRes.ok) {
      const err = await prepareRes.text();
      console.error('UploadThing prepare xato:', err);
      return NextResponse.json({ error: 'Yuklash tayyorlanmadi' }, { status: 500 });
    }

    const prepareData = (await prepareRes.json()) as {
      data: Array<{
        url: string;
        fields: Record<string, string>;
        key: string;
        fileUrl: string;
      }>;
    };

    const uploadInfo = prepareData.data[0];

    // 2-qadam: presigned URL'ga faylni yuborish
    const uploadFormData = new FormData();
    for (const [k, v] of Object.entries(uploadInfo.fields)) {
      uploadFormData.append(k, v);
    }
    uploadFormData.append('file', file);

    const uploadRes = await fetch(uploadInfo.url, {
      method: 'POST',
      body: uploadFormData,
    });

    if (!uploadRes.ok) {
      console.error('UploadThing upload xato:', await uploadRes.text());
      return NextResponse.json({ error: 'Fayl yuklanmadi' }, { status: 500 });
    }

    return NextResponse.json({
      url: uploadInfo.fileUrl,
      fileKey: uploadInfo.key,
      name: file.name,
      size: file.size,
    });
  } catch (err: any) {
    console.error('UploadThing xato:', err);
    return NextResponse.json({ error: err.message || 'Server xatosi' }, { status: 500 });
  }
}
