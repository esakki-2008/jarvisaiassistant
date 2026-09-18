import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const hash=(v)=>crypto.createHash('sha256').update(String(v)).digest('hex')
const admin=()=>createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

export default async function handler(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed.'})
    const action=String(req.query?.action||'')
    const db=admin()

    if(action==='pair-start'){
      if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({error:'Supabase is not configured.'})
      const code=String(crypto.randomInt(100000,1000000))
      const clientToken=crypto.randomBytes(32).toString('hex')
      const expiresAt=new Date(Date.now()+10*60*1000).toISOString()
      const {data,error}=await db.from('mobile_pairing_requests').insert({code_hash:hash(code),client_token_hash:hash(clientToken),expires_at:expiresAt}).select('id').single()
      if(error) throw error
      return res.status(200).json({pairingId:data.id,code,clientToken,expiresAt})
    }

    if(action==='pair-complete'){
      const {code,deviceName='Android Phone'}=req.body||{}
      if(!/^\d{6}$/.test(String(code||''))) return res.status(400).json({error:'Pairing code must be exactly 6 digits.'})
      const {data:request,error}=await db.from('mobile_pairing_requests').select('id,expires_at,used').eq('code_hash',hash(code)).eq('used',false).gt('expires_at',new Date().toISOString()).maybeSingle()
      if(error) throw error
      if(!request) return res.status(400).json({error:'Invalid or expired pairing code.'})
      const deviceToken=crypto.randomBytes(32).toString('hex')
      const {data:device,error:deviceError}=await db.from('mobile_devices').insert({device_name:String(deviceName).slice(0,100),device_token_hash:hash(deviceToken),platform:'android'}).select('id,device_name').single()
      if(deviceError) throw deviceError
      const {error:updateError}=await db.from('mobile_pairing_requests').update({used:true,used_at:new Date().toISOString(),device_id:device.id}).eq('id',request.id).eq('used',false)
      if(updateError) throw updateError
      return res.status(200).json({deviceId:device.id,deviceToken,deviceName:device.device_name})
    }

    if(action==='pair-status'){
      const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')
      if(!token) return res.status(401).json({error:'Missing pairing token.'})
      const {data:request,error}=await db.from('mobile_pairing_requests').select('id,expires_at,used,device_id').eq('client_token_hash',hash(token)).maybeSingle()
      if(error) throw error
      if(!request) return res.status(401).json({error:'Invalid pairing token.'})
      if(request.used&&request.device_id){
        const {data:device}=await db.from('mobile_devices').select('id,device_name,enabled').eq('id',request.device_id).maybeSingle()
        return res.status(200).json({paired:Boolean(device?.enabled),deviceName:device?.device_name||''})
      }
      if(new Date(request.expires_at).getTime()<Date.now()) return res.status(200).json({paired:false,expired:true})
      return res.status(200).json({paired:false,expired:false})
    }

    if(action==='command'){
      const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')
      if(!token) return res.status(401).json({error:'Missing phone pairing token.'})
      const {action:commandAction,value}=req.body||{}
      if(!['call_contact','call_number'].includes(commandAction)) return res.status(400).json({error:'Unsupported phone action.'})
      const {data:device}=await db.from('mobile_devices').select('id,enabled').eq('device_token_hash',hash(token)).maybeSingle()
      if(!device?.enabled) return res.status(401).json({error:'Phone is not authorized.'})
      const safeValue=String(value||'').trim()
      if(!safeValue||safeValue.length>200) return res.status(400).json({error:'Invalid call target.'})
      const {data:command,error}=await db.from('mobile_commands').insert({device_id:device.id,action:commandAction,value:safeValue}).select('id').single()
      if(error) throw error
      return res.status(200).json({ok:true,commandId:command.id,message:'Call request sent to your phone.'})
    }

    if(action==='poll'){
      const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')
      if(!token) return res.status(401).json({error:'Missing phone authentication.'})
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
    }

    if(action==='result'){
      const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')
      if(!token) return res.status(401).json({error:'Missing phone authentication.'})
      const {commandId,ok,message,error:actionError}=req.body||{}
      if(!commandId) return res.status(400).json({error:'commandId is required.'})
      const {data:device}=await db.from('mobile_devices').select('id,enabled').eq('device_token_hash',hash(token)).maybeSingle()
      if(!device?.enabled) return res.status(401).json({error:'Phone is not authorized.'})
      const {error}=await db.from('mobile_commands').update({status:ok?'completed':'failed',result:String(ok?message||'Completed.':actionError||'Phone action failed.').slice(0,4000),completed_at:new Date().toISOString()}).eq('id',commandId).eq('device_id',device.id).eq('status','claimed')
      if(error) throw error
      return res.status(200).json({ok:true})
    }

    return res.status(404).json({error:'Unknown mobile action.'})
  }catch(error){
    console.error('Mobile bridge error:',error)
    return res.status(500).json({error:'Mobile bridge request failed.'})
  }
}
