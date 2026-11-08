# APK readers

Two read-only parsers written for the analysis in
[../docs/REVERSE_ENGINEERING.md](../docs/REVERSE_ENGINEERING.md). They only read; neither writes to
or repackages an APK.

They exist because the facts that analysis needed are structural - the manifest, the class, method
and field inventory, the string constants - and a 200-line parser whose behaviour is fully known is
easier to trust for those than a decompiler's reconstruction of control flow.

```sh
unzip -d extracted app.apk

python3 -I tools/axml.py extracted/AndroidManifest.xml      # binary XML -> text

python3 -I tools/dex.py stats   extracted/classes*.dex      # per-file counts
python3 -I tools/dex.py classes extracted/classes*.dex      # class names
python3 -I tools/dex.py methods extracted/classes*.dex      # Class#method
python3 -I tools/dex.py fields  extracted/classes*.dex      # Class.field : Type
python3 -I tools/dex.py strings extracted/classes*.dex      # string pool
```

`-I` matters: an extracted APK is untrusted input, and isolated mode keeps Python from importing
anything out of the directory it is pointed at.

`axml.py` was also run against this project's own release APK, which is how the permission
comparison in the analysis was checked rather than asserted.

## Coverage

`axml.py` reads the chunk types a manifest uses: string pool, resource map, namespace start/end,
element start/end and CDATA. Attribute values are resolved for the primitive types; a reference
(`@ref/0x...`) is printed as its resource id, because resolving it needs `resources.arsc`, which
these readers do not parse.

`dex.py` reads the header and the four id tables plus `class_defs`. It does not decode method
bodies - no bytecode, no control flow.
