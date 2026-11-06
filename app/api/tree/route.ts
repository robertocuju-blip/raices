import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { familyTrees } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { validateFamily } from '../../../lib/family';
export const dynamic='force-dynamic';
export async function GET() {
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Inicia sesión para guardar tu árbol.'},{status:401});
  const rows=await getDb().select().from(familyTrees).where(eq(familyTrees.owner,user.userId));
  return Response.json(rows[0]?{tree:JSON.parse(rows[0].content),revision:rows[0].revision}:{tree:null,revision:0},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Inicia sesión para guardar tu árbol.'},{status:401});
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origen no válido.'},{status:403});
  const raw=await request.text();if(raw.length>2000000)return Response.json({error:'El árbol supera el tamaño permitido.'},{status:413});
  let data;try{data=JSON.parse(raw);validateFamily(data.tree);if(!Number.isInteger(data.revision)||data.revision<0)throw new Error('Revisión no válida.');}catch(e){return Response.json({error:e instanceof Error?e.message:'Datos no válidos.'},{status:400});}
  const db=getDb(), values={content:JSON.stringify(data.tree),revision:data.revision+1,updatedAt:new Date().toISOString()};
  if(data.revision===0){const result=await db.insert(familyTrees).values({owner:user.userId,...values}).onConflictDoNothing().returning({revision:familyTrees.revision});if(!result.length)return Response.json({error:'El árbol cambió en otra pestaña. Descarga una copia de tus cambios y recarga la página.'},{status:409});}
  else {const result=await db.update(familyTrees).set(values).where(and(eq(familyTrees.owner,user.userId),eq(familyTrees.revision,data.revision))).returning({revision:familyTrees.revision});if(!result.length)return Response.json({error:'El árbol cambió en otra pestaña. Descarga una copia de tus cambios y recarga la página.'},{status:409});}
  return Response.json({revision:values.revision});
}
