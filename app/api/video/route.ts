import { bucket, database } from '@/lib/storage';

export async function POST(req: Request) {
  try {
    const code = new URL(req.url).searchParams.get('room') || '';
    const row = await database().prepare('SELECT state FROM rooms WHERE code=?').bind(code).first<{state:string}>();
    const game = row && JSON.parse(row.state);
    if (!game || game.host !== req.headers.get('authorization')?.replace('Bearer ', ''))
      return Response.json({error:'Only the host can add a video.'},{status:403});
    if (game.phase !== 'lobby') return Response.json({error:'Add videos before starting the game.'},{status:400});
    const file = (await req.formData()).get('file');
    if (!(file instanceof File) || !['video/mp4','video/webm','video/quicktime'].includes(file.type) || !file.size || file.size > 50*1024*1024)
      return Response.json({error:'Choose an MOV, MP4 or WebM video up to 50 MB.'},{status:400});
    const key = code + '/video-' + crypto.randomUUID();
    await bucket().put(key, file.stream(), {httpMetadata:{contentType:file.type}});
    return Response.json({url:'/api/video?key='+key});
  } catch { return Response.json({error:'Video upload failed. Please try again.'},{status:500}); }
}

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') || '';
  if (!/^[A-Z]{6}\/video-[a-f0-9-]+$/.test(key)) return new Response('Not found',{status:404});
  try {
    const meta = await bucket().head(key);
    if (!meta) return new Response('Not found',{status:404});
    const headers = new Headers({'Content-Type':meta.httpMetadata?.contentType || 'video/mp4','Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'});
    let range: {offset:number;length:number} | undefined;
    const raw = req.headers.get('range');
    if (raw) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(raw);
      const start = match?.[1] ? Number(match[1]) : Math.max(0, meta.size-Number(match?.[2]));
      const end = match?.[1] && match[2] ? Math.min(Number(match[2]),meta.size-1) : meta.size-1;
      if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || start > end || start < 0)
        return new Response(null,{status:416,headers:{'Content-Range':`bytes */${meta.size}`}});
      range = {offset:start,length:end-start+1};
      headers.set('Content-Range',`bytes ${start}-${end}/${meta.size}`);
    }
    const object = await bucket().get(key, range ? {range} : undefined);
    if (!object) return new Response('Not found',{status:404});
    headers.set('Content-Length',String(range?.length ?? meta.size));
    return new Response(object.body,{status:range ? 206 : 200,headers});
  } catch { return new Response('Video unavailable',{status:503}); }
}
