import base64
import io
import mimetypes
import os
import secrets
import time
import zipfile
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
load_dotenv(Path(__file__).with_name('.env'))

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from gemini import chat, MODEL
from security import require_api_key, MAX_TEXT_CHARS, MAX_IMAGE_BYTES

app=FastAPI(title='ZOMA AI API',version='1.1.0')
origins=[x.strip() for x in os.getenv('ALLOWED_ORIGINS','https://mohamkhamis209-hub.github.io,http://127.0.0.1:5500,http://localhost:5500').split(',') if x.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=False,allow_methods=['GET','POST','OPTIONS'],allow_headers=['*'])

class Message(BaseModel):
    role:str=Field(pattern='^(user|assistant)$')
    text:str=Field(min_length=1,max_length=MAX_TEXT_CHARS)
class ChatRequest(BaseModel):
    messages:list[Message]=Field(min_length=1,max_length=40)
class TransferCreate(BaseModel):
    payload:dict[str,Any]
class TransferReceive(BaseModel):
    code:str=Field(min_length=6,max_length=6)

TRANSFER_TTL=600
transfer_store:dict[str,dict[str,Any]]={}

def cleanup_transfers():
    now=time.time()
    for code,item in list(transfer_store.items()):
        if item['expires']<=now: transfer_store.pop(code,None)

@app.get('/')
def root(): return {'name':'ZOMA AI API','status':'ok','model':MODEL}
@app.get('/api/health')
def health(): return {'ok':True,'gemini_configured':bool(os.getenv('GEMINI_API_KEY','').strip()),'model':MODEL}

@app.post('/api/chat')
def api_chat(payload:ChatRequest):
    try: return {'ok':True,'reply':chat([m.model_dump() for m in payload.messages]),'model':MODEL}
    except HTTPException: raise
    except Exception as exc:
        print('ZOMA CHAT ERROR:',type(exc).__name__,repr(exc),flush=True)
        raise HTTPException(status_code=500,detail=f'ZOMA ERROR: {type(exc).__name__}: {str(exc)}') from exc

@app.post('/api/analyze-file')
async def analyze_file(file:UploadFile=File(...),prompt:str=Form('اقرأ الملف أو حلل الصورة ونفذ المطلوب. أجب بالعربية.')):
    data=await file.read(20*1024*1024+1)
    if len(data)>20*1024*1024: raise HTTPException(status_code=413,detail='حجم الملف أكبر من 20MB.')
    name=file.filename or 'file'
    content_type=file.content_type or mimetypes.guess_type(name)[0] or 'application/octet-stream'
    try:
        if content_type.startswith('image/'):
            client=genai.Client(api_key=require_api_key(),http_options=types.HttpOptions(client_args={'proxy':os.getenv('https_proxy') or os.getenv('HTTPS_PROXY') or 'http://proxy.server:3128'},timeout=120000))
            try:
                response=client.models.generate_content(model=MODEL,contents=[types.Part.from_bytes(data=data,mime_type=content_type),prompt[:MAX_TEXT_CHARS]],config=types.GenerateContentConfig(system_instruction='أنت ZOMA AI. حلل الصور بشكل مفيد وآمن، وإذا كانت الصورة لسؤال دراسي فاشرح الحل خطوة بخطوة. أجب بالعربية.',temperature=0.5,max_output_tokens=4096))
                return {'ok':True,'reply':(response.text or '').strip()}
            finally:
                try: client.close()
                except Exception: pass
        if content_type=='application/pdf' or name.lower().endswith('.pdf'):
            client=genai.Client(api_key=require_api_key(),http_options=types.HttpOptions(client_args={'proxy':os.getenv('https_proxy') or os.getenv('HTTPS_PROXY') or 'http://proxy.server:3128'},timeout=120000))
            try:
                response=client.models.generate_content(model=MODEL,contents=[types.Part.from_bytes(data=data,mime_type='application/pdf'),prompt[:MAX_TEXT_CHARS]],config=types.GenerateContentConfig(system_instruction='أنت ZOMA AI. اقرأ الملف المرفق واستخرج المعلومات المهمة ونفذ طلب المستخدم. أجب بالعربية.',temperature=0.4,max_output_tokens=4096))
                return {'ok':True,'reply':(response.text or '').strip()}
            finally:
                try: client.close()
                except Exception: pass
        if name.lower().endswith('.docx') or content_type=='application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                xml=z.read('word/document.xml').decode('utf-8','ignore')
            import re
            text=re.sub(r'<[^>]+>',' ',xml)
            text=' '.join(text.split())[:MAX_TEXT_CHARS]
        elif name.lower().endswith('.zip') or content_type in ('application/zip','application/x-zip-compressed'):
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                infos=[i for i in z.infolist() if not i.is_dir()]
                parts=[f'محتويات ZIP ({len(infos)} ملف):']
                for i in infos[:200]:
                    parts.append(f'- {i.filename} ({i.file_size} bytes)')
                    lower=i.filename.lower()
                    if i.file_size<=500_000 and lower.endswith(('.txt','.md','.json','.csv','.html','.css','.js','.py','.xml')):
                        try: parts.append(z.read(i).decode('utf-8','ignore')[:8000])
                        except Exception: pass
                text='\n'.join(parts)[:MAX_TEXT_CHARS]
        else:
            is_text=content_type.startswith('text/') or name.lower().endswith(('.txt','.md','.json','.csv','.html','.css','.js','.py','.xml'))
            if not is_text: raise HTTPException(status_code=415,detail='هذا النوع من الملفات غير مدعوم حاليًا. جرّب PDF أو DOCX أو ZIP أو ملفًا نصيًا.')
            text=data.decode('utf-8','ignore')[:MAX_TEXT_CHARS]
        r=chat([{'role':'user','text':(prompt or 'اقرأ الملف ونفذ المطلوب.')+'\n\nمحتوى الملف:\n'+text}])
        return {'ok':True,'reply':r}
    except HTTPException: raise
    except zipfile.BadZipFile as exc: raise HTTPException(status_code=400,detail='ملف ZIP تالف أو غير صالح.') from exc
    except Exception as exc:
        print('ZOMA FILE ERROR:',type(exc).__name__,repr(exc),flush=True)
        raise HTTPException(status_code=502,detail=f'تعذر تحليل الملف الآن: {type(exc).__name__}') from exc

@app.post('/api/transfer/create')
def transfer_create(req:TransferCreate):
    cleanup_transfers()
    if not req.payload: raise HTTPException(status_code=400,detail='بيانات النقل فارغة.')
    for _ in range(30):
        code=f'{secrets.randbelow(1000000):06d}'
        if code not in transfer_store: break
    else: raise HTTPException(status_code=503,detail='تعذر إنشاء كود النقل الآن.')
    transfer_store[code]={'payload':req.payload,'expires':time.time()+TRANSFER_TTL}
    return {'ok':True,'code':code,'expiresIn':TRANSFER_TTL}

@app.post('/api/transfer/receive')
def transfer_receive(req:TransferReceive):
    cleanup_transfers()
    item=transfer_store.pop(req.code.strip(),None)
    if not item: raise HTTPException(status_code=404,detail='كود النقل غير موجود أو انتهت صلاحيته.')
    return {'ok':True,'payload':item['payload']}
