import { emit } from 'https://deno.land/std@0.171.0/compiler/mod.ts'; console.log('emit type',typeof emit); const r = await emit('app.ts',{bundle:'module'}); console.log(Object.keys(r.files));
