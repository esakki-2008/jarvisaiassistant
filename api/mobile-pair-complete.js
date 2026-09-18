import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex')
const admin = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false } })

export default async function handler(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed.'})
    const {code,deviceName='Android Phone'}=req.body||{}
    if(!/^\d{6}$/.test(String(code||''))) return res.status(400).json({error:'Pairing code must be exactly 6 digits.'})
    const db=admin()
    const {data:request,error}=await db.from('mobile_pairing_requests').select('id,expires_at,used').eq('code_hash',hash(code)).eq('used',false).gt('expires_at',new Date().toISOString()).maybeSingle()
    if(error) throw error
    if(!request) return res.status(400).json({error:'Invalid or expired pairing code.'})
    const deviceToken=crypto.randomBytes(32).toString('hex')
    const {data:device,error:deviceError}=await db.from('mobile_devices').insert({device_name:String(deviceName).slice(0,100),device_token_hash:hash(deviceToken),platform:'android'}).select('id,device_name').single()
    if(deviceError) throw deviceError
    const {error:updateError}=await db.from('mobile_pairing_requests').update({used:true,used_at:new Date().toISOString(),device_id:device.id}).eq('id',request.id).eq('used',false)
    if(updateError) throw updateError
    return res.status(200).json({deviceId:device.id,deviceToken,deviceName:device.device_name})
  }catch(error){ console.error('Mobile pair complete error:',error); return res.status(500).json({error:'Could not pair phone.'}) }
}