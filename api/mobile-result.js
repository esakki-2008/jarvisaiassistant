import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex')
const admin = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false } })

export default async function handler(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed.'})
    const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')
    if(!token) return res.status(401).json({error:'Missing phone authentication.'})
    const {commandId,ok,message,error:actionError}=req.body||{}
    if(!commandId) return res.status(400).json({error:'commandId is required.'})
    const db=admin()
    const {data:device}=await db.from('mobile_devices').select('id,enabled').eq('device_token_hash',hash(token)).maybeSingle()
    if(!device?.enabled) return res.status(401).json({error:'Phone is not authorized.'})
    const {error}=await db.from('mobile_commands').update({status:ok?'completed':'failed',result:String(ok?message||'Completed.':actionError||'Phone action failed.').slice(0,4000),completed_at:new Date().toISOString()}).eq('id',commandId).eq('device_id',device.id).eq('status','claimed')
    if(error) throw error
    return res.status(200).json({ok:true})
  }catch(error){ console.error('Mobile result error:',error); return res.status(500).json({error:'Could not save phone action result.'}) }
}