import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex')
const admin = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false } })

export default async function handler(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed.'})
    const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')
    if(!token) return res.status(401).json({error:'Missing phone authentication.'})
    const db=admin()
    const {data:device,error:deviceError}=await db.from('mobile_devices').select('id,device_name,enabled').eq('device_token_hash',hash(token)).maybeSingle()
    if(deviceError) throw deviceError
    if(!device?.enabled) return res.status(401).json({error:'Phone is not authorized.'})
    await db.from('mobile_devices').update({last_seen_at:new Date().toISOString()}).eq('id',device.id)
    const {data:command,error}=await db.from('mobile_commands').select('id,action,value').eq('device_id',device.id).eq('status','queued').order('created_at',{ascending:true}).limit(1).maybeSingle()
    if(error) throw error
    if(!command) return res.status(200).json({command:null})
    const {error:claimError}=await db.from('mobile_commands').update({status:'claimed',claimed_at:new Date().toISOString()}).eq('id',command.id).eq('status','queued')
    if(claimError) throw claimError
    return res.status(200).json({command})
  }catch(error){ console.error('Mobile poll error:',error); return res.status(500).json({error:'Phone polling failed.'}) }
}