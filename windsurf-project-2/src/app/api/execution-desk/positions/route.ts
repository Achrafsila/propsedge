import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const fail=(message:string,status:number)=>NextResponse.json({error:message},{status});
async function clientWithUser(){const db=await createClient();const {data:{user},error}=await db.auth.getUser();return {db,user:user&&!error?user:null};}
export async function GET(){const {db,user}=await clientWithUser();if(!user)return fail('Sign in required',401);
 const {data,error}=await db.from('execution_positions').select('*').eq('user_id',user.id).eq('status','open').maybeSingle();
 if(error)return fail('Position storage unavailable: apply migration 011',503);
 if(!data)return NextResponse.json({position:null,alerts:[]});
 const {data:alerts}=await db.from('execution_alerts').select('id,candle_time,kind,message,created_at').eq('position_id',data.id).order('created_at',{ascending:false}).limit(20);
 return NextResponse.json({position:data,alerts:alerts||[]},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request){const {db,user}=await clientWithUser();if(!user)return fail('Sign in required',401);
 let b:Record<string,unknown>;try{b=await req.json()}catch{return fail('Invalid request',400)}
 const side=b.side,entry=Number(b.entry),sl=Number(b.sl),tp=Number(b.tp);
 if(b.symbol!=='XAU/USD'||![1,-1].includes(Number(side))||!['5m','15m','30m','1h','4h'].includes(String(b.timeframe))||![entry,sl,tp].every(x=>Number.isFinite(x)&&x>0)|| !((side===1&&sl<entry&&tp>entry)||(side===-1&&sl>entry&&tp<entry)))return fail('Invalid setup',400);
 if(typeof b.title!=='string'||b.title.length>140||typeof b.reason!=='string'||b.reason.length>2000)return fail('Invalid description',400);
 const {data,error}=await db.from('execution_positions').insert({user_id:user.id,symbol:'XAU/USD',timeframe:b.timeframe,side,entry,sl,tp,title:b.title,reason:b.reason,source_candle_time:typeof b.source_candle_time==='number'?b.source_candle_time:null}).select().single();
 if(error)return fail(error.code==='23505'?'An open position already exists':'Could not save position',error.code==='23505'?409:503);
 return NextResponse.json({position:data},{status:201});
}
export async function PATCH(req:Request){const {db,user}=await clientWithUser();if(!user)return fail('Sign in required',401);
 let b:{id?:string};try{b=await req.json()}catch{return fail('Invalid request',400)}
 if(!b.id||!/^[-a-f0-9]{36}$/i.test(b.id))return fail('Invalid position ID',400);
 const {data,error}=await db.from('execution_positions').update({status:'closed',closed_at:new Date().toISOString()}).eq('user_id',user.id).eq('id',b.id).eq('status','open').select().maybeSingle();
 if(error)return fail('Could not close position',503);if(!data)return fail('Active position not found',404);
 return NextResponse.json({position:data});
}
