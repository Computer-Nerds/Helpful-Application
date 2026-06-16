import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { filename, contentType, base64 } = await req.json();

    if (!base64 || !filename) {
      return Response.json({ error: 'Missing filename or base64' }, { status: 400 });
    }

    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const file = new File([bytes], filename, { type: contentType || 'audio/wav' });

    const url = await base44.storage.uploadFile(file);
    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
