import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex')
const admin = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false } })

export default async function handler(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed.'})
    const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')
    if(!token) return res.status(401).json({error:'Missing phone pairing token.'})
    const {action,value}=req.body||{}
    if(!['call_contact','call_number'].includes(action)) return res.status(400).json({error:'Unsupported phone action.'})
    const db=admin()
    const {data:device}=await db.from('mobile_devices').select('id,enabled').eq('device_token_hash',hash(token)).maybeSingle()
    if(!device?.enabled) return res.status(401).json({error:'Phone is not authorized.'})
    const safeValue=String(value||'').trim()
    if(!safeValue || safeValue.length>200) return res.status(400).json({error:'Invalid call target.'})
    const {data:command,error}=await db.from('mobile_commands').insert({device_id:device.id,action,value:safeValue}).select('id').single()
    if(error) throw error
    return res.status(200).json({ok:true,commandId:command.id,message:'Call request sent to your phone.'})
  }catch(error){ console.error('Mobile command error:',error); return res.status(500).json({error:'Could not send phone command.'}) }
}