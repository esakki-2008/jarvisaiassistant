import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex')
const admin = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false } })

export default async function handler(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed.'})
    if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({error:'Supabase is not configured.'})
    const db=admin()
    const code=String(crypto.randomInt(100000,1000000))
    const clientToken=crypto.randomBytes(32).toString('hex')
    const expiresAt=new Date(Date.now()+10*60*1000).toISOString()
    const {data,error}=await db.from('mobile_pairing_requests').insert({code_hash:hash(code),client_token_hash:hash(clientToken),expires_at:expiresAt}).select('id').single()
    if(error) throw error
    return res.status(200).json({pairingId:data.id,code,clientToken,expiresAt})
  }catch(error){ console.error('Mobile pair start error:',error); return res.status(500).json({error:'Could not start phone pairing.'}) }
}