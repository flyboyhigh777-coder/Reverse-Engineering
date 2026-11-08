#!/usr/bin/env python3
"""Read-only DEX reader: strings, types, classes, methods, fields."""
import struct, sys, os

def uleb(buf, p):
    r=0; s=0
    while True:
        b=buf[p]; p+=1
        r |= (b & 0x7f) << s
        if not (b & 0x80): break
        s += 7
    return r, p

class Dex:
    def __init__(self, path):
        self.buf = open(path,'rb').read()
        b=self.buf
        assert b[:4]==b'dex\n', 'not dex'
        f='<' 
        (self.string_ids_size,self.string_ids_off,self.type_ids_size,self.type_ids_off,
         self.proto_ids_size,self.proto_ids_off,self.field_ids_size,self.field_ids_off,
         self.method_ids_size,self.method_ids_off,self.class_defs_size,self.class_defs_off,
         self.data_size,self.data_off) = struct.unpack_from(f+'14I', b, 56)
        self._strings=None
    @property
    def strings(self):
        if self._strings is None:
            b=self.buf
            offs=struct.unpack_from('<%dI'%self.string_ids_size, b, self.string_ids_off)
            out=[]
            for o in offs:
                n,p=uleb(b,o)
                e=b.index(b'\x00', p)
                out.append(b[p:e].decode('utf-8','replace'))
            self._strings=out
        return self._strings
    def type_str(self, i):
        ti=struct.unpack_from('<I', self.buf, self.type_ids_off + 4*i)[0]
        return self.strings[ti]
    def classes(self):
        b=self.buf
        for i in range(self.class_defs_size):
            o=self.class_defs_off + 32*i
            ci,af,si,io,sf,ao,cdo,svo = struct.unpack_from('<8I', b, o)
            yield {'name':self.type_str(ci),'access':af,
                   'super': self.type_str(si) if si!=0xffffffff else None,
                   'source': self.strings[sf] if sf!=0xffffffff else None,
                   'data_off':cdo, 'interfaces_off': io}
    def methods(self):
        b=self.buf
        for i in range(self.method_ids_size):
            o=self.method_ids_off + 8*i
            ci,pi,ni = struct.unpack_from('<HHI', b, o)
            yield self.type_str(ci), self.strings[ni]
    def fields(self):
        b=self.buf
        for i in range(self.field_ids_size):
            o=self.field_ids_off + 8*i
            ci,ti,ni = struct.unpack_from('<HHI', b, o)
            yield self.type_str(ci), self.type_str(ti), self.strings[ni]

def desc_to_java(d):
    arr=0
    while d.startswith('['): arr+=1; d=d[1:]
    if d.startswith('L'): s=d[1:-1].replace('/','.')
    else: s={'V':'void','Z':'boolean','B':'byte','S':'short','C':'char','I':'int','J':'long','F':'float','D':'double'}.get(d,d)
    return s+'[]'*arr

if __name__=='__main__':
    mode=sys.argv[1]; paths=sys.argv[2:]
    for p in paths:
        d=Dex(p)
        if mode=='strings':
            for s in d.strings: print(s)
        elif mode=='classes':
            for c in d.classes(): print(desc_to_java(c['name']))
        elif mode=='methods':
            for cn,mn in d.methods(): print(desc_to_java(cn)+'#'+mn)
        elif mode=='fields':
            for cn,tn,fn in d.fields(): print(desc_to_java(cn)+'.'+fn+' : '+desc_to_java(tn))
        elif mode=='stats':
            print(os.path.basename(p), 'strings',d.string_ids_size,'types',d.type_ids_size,'methods',d.method_ids_size,'fields',d.field_ids_size,'classes',d.class_defs_size)
