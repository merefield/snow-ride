const r = await Deno.emit("app.ts", { bundle: "module" }); console.log(Object.keys(r.files));
