import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex')
const admin = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false } })

export default async function handler(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed.'})
    const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')
    if(!token) return res.status(401).json({error:'Missing pairing token.'})
    const db=admin()
    const {data:request,error}=await db.from('mobile_pairing_requests').select('id,expires_at,used,device_id').eq('client_token_hash',hash(token)).maybeSingle()
    if(error) throw error
    if(!request) return res.status(401).json({error:'Invalid pairing token.'})
    if(request.used && request.device_id){
      const {data:device}=await db.from('mobile_devices').select('id,device_name,enabled').eq('id',request.device_id).maybeSingle()
      return res.status(200).json({paired:Boolean(device?.enabled),deviceName:device?.device_name||''})
    }
    if(new Date(request.expires_at).getTime()<Date.now()) return res.status(200).json({paired:false,expired:true})
    return res.status(200).json({paired:false,expired:false})
  }catch(error){ console.error('Mobile pair status error:',error); return res.status(500).json({error:'Could not check phone pairing.'}) }
}