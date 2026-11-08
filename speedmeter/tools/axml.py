#!/usr/bin/env python3
"""Minimal Android binary XML (AXML) decoder. Read-only parser, no external code."""
import struct, sys

RES_STRING_POOL=0x0001; RES_XML=0x0003; RES_XML_START_NS=0x0100; RES_XML_END_NS=0x0101
RES_XML_START_ELEM=0x0102; RES_XML_END_ELEM=0x0103; RES_XML_CDATA=0x0104; RES_XML_RES_MAP=0x0180

def parse_string_pool(buf, off):
    hdr_type, hdr_size, size = struct.unpack_from('<HHI', buf, off)
    cnt, style_cnt, flags, strs_start, styles_start = struct.unpack_from('<IIIII', buf, off+8)
    utf8 = bool(flags & (1<<8))
    offs = struct.unpack_from('<%dI'%cnt, buf, off+28)
    out=[]
    base=off+strs_start
    for o in offs:
        p=base+o
        if utf8:
            n=buf[p]; p+=1
            if n & 0x80: n=((n&0x7f)<<8)|buf[p]; p+=1
            n2=buf[p]; p+=1
            if n2 & 0x80: n2=((n2&0x7f)<<8)|buf[p]; p+=1
            out.append(buf[p:p+n2].decode('utf-8','replace'))
        else:
            n=struct.unpack_from('<H',buf,p)[0]; p+=2
            if n & 0x8000:
                n=((n&0x7fff)<<16)|struct.unpack_from('<H',buf,p)[0]; p+=2
            out.append(buf[p:p+n*2].decode('utf-16-le','replace'))
    return out, size

TYPE_NAMES={0x00:'null',0x01:'reference',0x02:'attribute',0x03:'string',0x04:'float',
 0x05:'dimension',0x06:'fraction',0x10:'int',0x11:'hex',0x12:'bool'}

def fmt_val(strs, t, data):
    if t==0x03: return strs[data] if data < len(strs) else '@str/%d'%data
    if t==0x01: return '@ref/0x%08x'%data
    if t==0x02: return '?attr/0x%08x'%data
    if t==0x12: return 'true' if data else 'false'
    if t==0x11: return '0x%08x'%data
    if t==0x10: return str(struct.unpack('<i',struct.pack('<I',data))[0])
    if t==0x04: return str(struct.unpack('<f',struct.pack('<I',data))[0])
    return '<%s:0x%08x>'%(TYPE_NAMES.get(t,'t%d'%t),data)

def decode(path):
    buf=open(path,'rb').read()
    t,hs,sz=struct.unpack_from('<HHI',buf,0)
    assert t==RES_XML, 'not AXML: 0x%x'%t
    off=hs; strs=[]; res_map=[]
    lines=[]; depth=0; ns={}
    while off < min(sz,len(buf)):
        ct,chs,csz=struct.unpack_from('<HHI',buf,off)
        if csz==0: break
        if ct==RES_STRING_POOL:
            strs,_=parse_string_pool(buf,off)
        elif ct==RES_XML_RES_MAP:
            n=(csz-chs)//4
            res_map=list(struct.unpack_from('<%dI'%n,buf,off+chs))
        elif ct==RES_XML_START_NS:
            p=struct.unpack_from('<II',buf,off+chs)
            ns[strs[p[1]]]=strs[p[0]] if p[0]<len(strs) else ''
        elif ct==RES_XML_START_ELEM:
            p=off+chs
            nsi,namei=struct.unpack_from('<iI',buf,p)
            attr_start,attr_size,attr_cnt=struct.unpack_from('<HHH',buf,p+8)
            name=strs[namei]
            attrs=[]
            ap=p+attr_start
            for i in range(attr_cnt):
                a_ns,a_name,a_raw=struct.unpack_from('<iiI',buf,ap)
                a_t=buf[ap+15]; a_data=struct.unpack_from('<I',buf,ap+16)[0]
                an=strs[a_name] if a_name>=0 and a_name<len(strs) else '?'
                pfx=''
                if a_ns>=0 and a_ns<len(strs):
                    u=strs[a_ns]
                    pfx = 'android:' if 'android' in u else (ns.get(u,'ns')+':' if u else '')
                if not an and a_name>=0:
                    an='attr0x%08x'%(res_map[a_name] if a_name<len(res_map) else a_name)
                v=strs[a_raw] if (a_raw>=0 and a_raw<len(strs) and a_t==0x03) else fmt_val(strs,a_t,a_data)
                attrs.append((pfx+an,v))
                ap+=attr_size
            ind='  '*depth
            if attrs:
                lines.append(ind+'<'+name)
                for k,v in attrs: lines.append(ind+'    '+k+'="'+str(v)+'"')
                lines.append(ind+'>')
            else:
                lines.append(ind+'<'+name+'>')
            depth+=1
        elif ct==RES_XML_END_ELEM:
            depth-=1
            nsi,namei=struct.unpack_from('<iI',buf,off+chs)
            lines.append('  '*depth+'</'+strs[namei]+'>')
        elif ct==RES_XML_CDATA:
            d=struct.unpack_from('<I',buf,off+chs)[0]
            txt=strs[d] if d<len(strs) else ''
            if txt.strip(): lines.append('  '*depth+txt.strip())
        off+=csz
    return '\n'.join(lines)

if __name__=='__main__':
    print(decode(sys.argv[1]))
